import { getDb } from "@/lib/db";
import { venueName } from "@/lib/venues";
import { fetchOfficialPage } from "./client";
import { parseRaceIndex, parseRaceCard, parseBeforeInfo, parseActiveVenues } from "./parse";

function raceId(date: string, jcd: string, rno: number): string {
  return `${date}-${jcd}-${rno}`;
}

/**
 * 当日開催されている場の一覧を取得する(トップページ相当)。
 */
export async function fetchActiveVenues(date: string): Promise<string[]> {
  const html = await fetchOfficialPage(`/owpc/pc/race/index?hd=${date}`);
  return parseActiveVenues(html);
}

/**
 * 当日開催されている全ての場の番組表・出走表を1日1回だけ取得する。
 * (スケジューラから朝に一度だけ呼び出す想定)
 */
export async function ingestDailySchedule(date: string): Promise<{ venue: string; races: number }[]> {
  const venues = await fetchActiveVenues(date);
  const results: { venue: string; races: number }[] = [];
  for (const jcd of venues) {
    const races = await ingestRaceCardsForVenueDay(date, jcd);
    results.push({ venue: jcd, races });
  }
  return results;
}

/**
 * 指定した場・日の番組表と各レースの出走表をまとめて1回だけ取得する。
 * 1日1回程度のバッチ実行を想定(1レースごとの再取得は行わない)。
 */
export async function ingestRaceCardsForVenueDay(date: string, jcd: string): Promise<number> {
  const db = getDb();
  const indexHtml = await fetchOfficialPage(`/owpc/pc/race/raceindex?jcd=${jcd}&hd=${date}`);
  const raceList = parseRaceIndex(indexHtml);
  if (raceList.length === 0) return 0;

  const upsertRace = db.prepare(`
    INSERT INTO races (id, date, jcd, venue_name, rno, race_title, deadline, fetched_card_at)
    VALUES (@id, @date, @jcd, @venueName, @rno, @raceTitle, @deadline, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      race_title = excluded.race_title,
      deadline = excluded.deadline,
      fetched_card_at = excluded.fetched_card_at,
      updated_at = datetime('now')
  `);

  const upsertEntry = db.prepare(`
    INSERT INTO entries (
      race_id, lane, racer_number, racer_name, racer_class,
      motor_number, boat_number, motor_win2_rate,
      national_win3_rate, national_win2_rate, local_win3_rate, local_win2_rate
    ) VALUES (
      @raceId, @lane, @racerNumber, @racerName, @racerClass,
      @motorNumber, @boatNumber, @motorWin2Rate,
      @nationalWin3Rate, @nationalWin2Rate, @localWin3Rate, @localWin2Rate
    )
    ON CONFLICT(race_id, lane) DO UPDATE SET
      racer_number = excluded.racer_number,
      racer_name = excluded.racer_name,
      racer_class = excluded.racer_class,
      motor_number = excluded.motor_number,
      boat_number = excluded.boat_number,
      motor_win2_rate = excluded.motor_win2_rate,
      national_win3_rate = excluded.national_win3_rate,
      national_win2_rate = excluded.national_win2_rate,
      local_win3_rate = excluded.local_win3_rate,
      local_win2_rate = excluded.local_win2_rate
  `);

  let count = 0;
  for (const race of raceList) {
    const id = raceId(date, jcd, race.rno);
    upsertRace.run({
      id,
      date,
      jcd,
      venueName: venueName(jcd),
      rno: race.rno,
      raceTitle: race.raceTitle,
      deadline: race.deadline,
    });

    // 出走表は番組表とは別ページ。低頻度取得の方針上、同一バッチ内で連続取得するため
    // client.ts のスロットリングにより一定間隔が保たれる。
    const cardHtml = await fetchOfficialPage(
      `/owpc/pc/race/racelist?rno=${race.rno}&jcd=${jcd}&hd=${date}`
    );
    const entries = parseRaceCard(cardHtml);
    const tx = db.transaction(() => {
      for (const e of entries) {
        upsertEntry.run({ raceId: id, ...e });
      }
    });
    tx();
    count++;
  }

  return count;
}

/**
 * 指定レースの展示データを「1回だけ」取得する。
 * すでに fetched_exhibition_at が記録されている場合は再取得しない
 * (exhibition_fetch_lock との二重チェックで確実に1回に制限する)。
 */
export async function ingestExhibitionOnce(
  date: string,
  jcd: string,
  rno: number
): Promise<"fetched" | "already_fetched" | "race_not_found"> {
  const db = getDb();
  const id = raceId(date, jcd, rno);

  const race = db.prepare("SELECT fetched_exhibition_at FROM races WHERE id = ?").get(id) as
    | { fetched_exhibition_at: string | null }
    | undefined;
  if (!race) return "race_not_found";
  if (race.fetched_exhibition_at) return "already_fetched";

  // ロック行を先に確保し、同時実行があっても1回しか取得処理が走らないようにする
  try {
    db.prepare("INSERT INTO exhibition_fetch_lock (race_id) VALUES (?)").run(id);
  } catch {
    return "already_fetched"; // 既にロック済み = 他プロセスが取得中/取得済み
  }

  const html = await fetchOfficialPage(`/owpc/pc/race/beforeinfo?rno=${rno}&jcd=${jcd}&hd=${date}`);
  const exhibitions = parseBeforeInfo(html);

  const upsertExhibition = db.prepare(`
    INSERT INTO exhibitions (race_id, lane, exhibition_time, tilt, start_course, start_timing)
    VALUES (@raceId, @lane, @exhibitionTime, @tilt, @startCourse, @startTiming)
    ON CONFLICT(race_id, lane) DO UPDATE SET
      exhibition_time = excluded.exhibition_time,
      tilt = excluded.tilt,
      start_course = excluded.start_course,
      start_timing = excluded.start_timing
  `);

  const tx = db.transaction(() => {
    for (const e of exhibitions) {
      upsertExhibition.run({ raceId: id, ...e });
    }
    db.prepare("UPDATE races SET fetched_exhibition_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(
      id
    );
  });
  tx();

  return "fetched";
}
