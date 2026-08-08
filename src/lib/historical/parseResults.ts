/**
 * 競走成績データ(mbrace.or.jp od2/K/ 配布のLZH、解凍後の固定長テキスト)のパーサー。
 *
 * このフォーマットは公式な仕様書ではなく、実際にこのデータを処理している公開実装
 * (GitHub: cstenmt/boatrace の txtTocsv_results.py)の行解析ロジックを移植したもの。
 * 「開催見出しブロック(競走成績という文字列を含む行を起点に4行先まで読む)」→
 * 「レースごとの見出し行(R と H を含む行)→2行スキップ→着順が続く行を空行まで読む」
 * という行志向の状態機械になっている。
 *
 * parsePlayersText 同様、オフセットはShift-JISデコード後の文字位置。
 * 実際の配布ファイルでの検証はネットワーク制限により未実施(未検証)。
 */

export type RaceResultRow = {
  raceName: string; // レース名(開催名)
  dayLabel: string; // 日にち
  date: string; // 日付(生の文字列、YYYY/MM/DD想定)
  venueName: string; // 開催地
  roundLabel: string; // ラウンド名(レース番号相当の生値)
  raceType: string; // 種別
  finishPosition: string; // 着(数字以外にF/L/S等が入りうるため文字列で保持)
  lane: number | null; // 艇(枠番)
  racerNumber: string; // 登番
  racerName: string; // 選手名
  motorNumber: number | null;
  boatNumber: number | null;
  exhibitionTime: number | null; // 展示
  entryCourse: number | null; // 進入
  startTiming: string; // スタートタイミング(F表記等があるため文字列で保持)
  raceTime: string; // レースタイム(分:秒等の生値)
};

function toNumber(s: string | undefined): number | null {
  const t = (s ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseResultsText(text: string): RaceResultRow[] {
  const lines = text.split(/\r?\n/);
  const rows: RaceResultRow[] = [];

  let meeting: { raceName: string; dayLabel: string; date: string; venueName: string } | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.includes("競走成績")) {
      // 見出しブロック: [基準行+1]スキップ, [+2]=a(開催名), [+3]スキップ, [+4]=b(日付/開催地)
      const a = lines[i + 2] ?? "";
      const b = lines[i + 4] ?? "";
      meeting = {
        raceName: a.trim(),
        dayLabel: (b.slice(3, 7) ?? "").trim(),
        date: (b.slice(17, 27) ?? "").trim(),
        venueName: (b.slice(56, 63) ?? "").trim(),
      };
      i += 5;
      continue;
    }

    if (meeting && line.includes("R") && line.includes("H")) {
      const roundLabel = line.slice(3, 5).trim();
      const raceType = line.slice(12, 15).trim();

      let j = i + 3; // 見出し2行をスキップした先が最初の結果行
      while (j < lines.length && lines[j].trim() !== "") {
        const c = lines[j];
        rows.push({
          raceName: meeting.raceName,
          dayLabel: meeting.dayLabel,
          date: meeting.date,
          venueName: meeting.venueName,
          roundLabel,
          raceType,
          finishPosition: c.slice(2, 4).trim(),
          lane: toNumber(c[6]),
          racerNumber: c.slice(8, 12).trim(),
          racerName: c.slice(13, 20).trim(),
          motorNumber: toNumber(c.slice(22, 24)),
          boatNumber: toNumber(c.slice(27, 29)),
          exhibitionTime: toNumber(c.slice(31, 36)),
          entryCourse: toNumber(c[38]),
          startTiming: c.slice(43, 47).trim(),
          raceTime: c.slice(52, 58).trim(),
        });
        j += 1;
      }
      i = j + 1;
      continue;
    }

    i += 1;
  }

  return rows;
}
