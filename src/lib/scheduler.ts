import cron from "node-cron";
import { getDb } from "@/lib/db";
import { todayJst, addDays } from "@/lib/date";
import { ingestDailySchedule, ingestExhibitionOnce } from "@/lib/scraper/ingest";
import { ingestRacerPeriodStats, ingestRaceResults } from "@/lib/historical/ingest";

// 展示データの取得ウィンドウ: 締切のこのくらい前〜このくらい前の間に1回だけ取得する
const WINDOW_START_MIN = 15;
const WINDOW_END_MIN = 10;

function minutesUntilDeadlineJst(date: string, deadline: string): number | null {
  const match = deadline.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, hh, mm] = match;
  const y = Number(date.slice(0, 4));
  const mo = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  // JST(UTC+9)の時刻をUTCのepochに変換
  const deadlineUtcMs = Date.UTC(y, mo - 1, d, Number(hh) - 9, Number(mm));
  return (deadlineUtcMs - Date.now()) / 60000;
}

let started = false;

/**
 * 公式サイトへの負荷を最小限にするためのスケジューラ。
 *   - 毎日1回(08:00 JST): 当日開催場の番組表・出走表をまとめて取得
 *   - 毎分: 締切15分前後の対象レースの展示データを「1回だけ」取得
 *   - 毎日1回(04:00 JST): 前日分の競走成績アーカイブ(Kファイル)を取り込み
 *   - 週1回(月曜 05:00 JST): レーサー期別成績を取り込み(取り込み済みならスキップ)
 * ユーザーのページ閲覧はこのスケジューラの結果(DBキャッシュ)を読むだけで、
 * リクエストのたびに公式サイトへアクセスすることはない。
 */
export function startScheduler(): void {
  if (started) return;
  started = true;

  // 毎日 08:00 JST (=前日23:00 UTC) に当日の番組表を取得
  cron.schedule("0 23 * * *", () => {
    void ingestDailySchedule(todayJst()).catch((err) => {
      console.error("[scheduler] daily ingest failed", err);
    });
  });

  cron.schedule("* * * * *", () => {
    void runExhibitionWindowCheck().catch((err) => {
      console.error("[scheduler] exhibition window check failed", err);
    });
  });

  startHistoricalJobs();

  console.log("[scheduler] started");
}

/**
 * 過去データ(レーサー期別成績・競走成績アーカイブ)の低頻度取り込みジョブ。
 * ライブの当日データ取得(上記)とは完全に独立しており、失敗してもライブ側には影響しない。
 */
function startHistoricalJobs(): void {
  // 毎日 04:00 JST (=前日19:00 UTC) に前日分の競走成績を取り込み
  cron.schedule("0 19 * * *", () => {
    const yesterday = addDays(todayJst(), -1);
    void ingestRaceResults(yesterday).catch((err) => {
      console.error("[scheduler] race results ingest failed", err);
    });
  });

  // 毎週月曜 05:00 JST (=日曜20:00 UTC) にレーサー期別成績を取り込み
  // (期別成績は年数回しか更新されないが、更新済みファイルはhistorical_ingest_logで
  //  スキップされるため、この頻度で確認しても実際のダウンロードはほぼ発生しない)
  cron.schedule("0 20 * * 0", () => {
    void ingestRacerPeriodStats().catch((err) => {
      console.error("[scheduler] racer period stats ingest failed", err);
    });
  });
}

async function runExhibitionWindowCheck(): Promise<void> {
  const db = getDb();
  const date = todayJst();
  const races = db
    .prepare(
      "SELECT jcd, rno, deadline FROM races WHERE date = ? AND deadline IS NOT NULL AND fetched_exhibition_at IS NULL"
    )
    .all(date) as Array<{ jcd: string; rno: number; deadline: string }>;

  for (const race of races) {
    const minutesLeft = minutesUntilDeadlineJst(date, race.deadline);
    if (minutesLeft === null) continue;
    if (minutesLeft <= WINDOW_START_MIN && minutesLeft >= WINDOW_END_MIN - 1) {
      await ingestExhibitionOnce(date, race.jcd, race.rno);
    }
  }
}
