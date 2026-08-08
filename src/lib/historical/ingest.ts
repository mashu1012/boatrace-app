/**
 * 過去データ(レーサー期別成績・競走成績)の低頻度バッチ取り込み。
 *
 * ライブスクレイピング(src/lib/scraper/*、当日の番組表・展示データ)とは完全に別系統。
 * こちらは公式サイトが明示的に提供している「ダウンロード」機能を使い、まとまった単位
 * (期別ファイル・日別アーカイブ)で取得するため、そもそも高頻度に実行する性質のものでは
 * ない(期別成績は年数回更新、結果アーカイブは1日1ファイル)。
 * scheduler.ts 内で「毎分」の展示データチェックとは別枠の、週1回/日1回の低頻度cronから
 * 呼び出す(scheduler.ts の startHistoricalJobs 参照)。手動での動作確認用に
 * /api/admin/ingest-historical からも呼び出せる。
 */

import { getDb } from "@/lib/db";
import { fetchOfficialPage, fetchOfficialBinary } from "@/lib/scraper/client";
import { fetchMbraceBinary } from "@/lib/scraper/mbraceClient";
import { extractLzh, decodeShiftJis } from "@/lib/lzh";
import { parseDownloadLinks } from "./parseDownloadPage";
import { parsePlayersText, type RacerRecord } from "./parsePlayers";
import { parseResultsText, type RaceResultRow } from "./parseResults";

function alreadyIngested(source: string, key: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT 1 FROM historical_ingest_log WHERE source = ? AND key = ?")
    .get(source, key);
  return row !== undefined;
}

function markIngested(source: string, key: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR REPLACE INTO historical_ingest_log (source, key, fetched_at) VALUES (?, ?, datetime('now'))"
  ).run(source, key);
}

function upsertRacer(r: RacerRecord): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO racers (
      racer_number, name_kanji, name_kana, branch, racer_class,
      win_rate, place_rate, first_count, second_count, race_count, win_event_count, champion_count,
      avg_start_timing,
      course1_entry_count, course1_place_rate, course1_avg_st, course1_avg_start_rank,
      course2_entry_count, course2_place_rate, course2_avg_st, course2_avg_start_rank,
      course3_entry_count, course3_place_rate, course3_avg_st, course3_avg_start_rank,
      course4_entry_count, course4_place_rate, course4_avg_st, course4_avg_start_rank,
      course5_entry_count, course5_place_rate, course5_avg_st, course5_avg_start_rank,
      course6_entry_count, course6_place_rate, course6_avg_st, course6_avg_start_rank,
      term_year, term_no, calc_period_from, calc_period_to, raw_json, fetched_at
    ) VALUES (
      @racerNumber, @nameKanji, @nameKana, @branch, @racerClass,
      @winRate, @placeRate, @firstCount, @secondCount, @raceCount, @winEventCount, @championCount,
      @avgStartTiming,
      @c1ec, @c1pr, @c1st, @c1sr,
      @c2ec, @c2pr, @c2st, @c2sr,
      @c3ec, @c3pr, @c3st, @c3sr,
      @c4ec, @c4pr, @c4st, @c4sr,
      @c5ec, @c5pr, @c5st, @c5sr,
      @c6ec, @c6pr, @c6st, @c6sr,
      @termYear, @termNo, @calcPeriodFrom, @calcPeriodTo, @rawJson, datetime('now')
    )
    ON CONFLICT(racer_number) DO UPDATE SET
      name_kanji=excluded.name_kanji, name_kana=excluded.name_kana, branch=excluded.branch,
      racer_class=excluded.racer_class, win_rate=excluded.win_rate, place_rate=excluded.place_rate,
      first_count=excluded.first_count, second_count=excluded.second_count, race_count=excluded.race_count,
      win_event_count=excluded.win_event_count, champion_count=excluded.champion_count,
      avg_start_timing=excluded.avg_start_timing,
      course1_entry_count=excluded.course1_entry_count, course1_place_rate=excluded.course1_place_rate,
      course1_avg_st=excluded.course1_avg_st, course1_avg_start_rank=excluded.course1_avg_start_rank,
      course2_entry_count=excluded.course2_entry_count, course2_place_rate=excluded.course2_place_rate,
      course2_avg_st=excluded.course2_avg_st, course2_avg_start_rank=excluded.course2_avg_start_rank,
      course3_entry_count=excluded.course3_entry_count, course3_place_rate=excluded.course3_place_rate,
      course3_avg_st=excluded.course3_avg_st, course3_avg_start_rank=excluded.course3_avg_start_rank,
      course4_entry_count=excluded.course4_entry_count, course4_place_rate=excluded.course4_place_rate,
      course4_avg_st=excluded.course4_avg_st, course4_avg_start_rank=excluded.course4_avg_start_rank,
      course5_entry_count=excluded.course5_entry_count, course5_place_rate=excluded.course5_place_rate,
      course5_avg_st=excluded.course5_avg_st, course5_avg_start_rank=excluded.course5_avg_start_rank,
      course6_entry_count=excluded.course6_entry_count, course6_place_rate=excluded.course6_place_rate,
      course6_avg_st=excluded.course6_avg_st, course6_avg_start_rank=excluded.course6_avg_start_rank,
      term_year=excluded.term_year, term_no=excluded.term_no,
      calc_period_from=excluded.calc_period_from, calc_period_to=excluded.calc_period_to,
      raw_json=excluded.raw_json, fetched_at=datetime('now')
    `
  ).run({
    racerNumber: r.racerNumber,
    nameKanji: r.nameKanji,
    nameKana: r.nameKana,
    branch: r.branch,
    racerClass: r.racerClass,
    winRate: r.winRate,
    placeRate: r.placeRate,
    firstCount: r.firstCount,
    secondCount: r.secondCount,
    raceCount: r.raceCount,
    winEventCount: r.winEventCount,
    championCount: r.championCount,
    avgStartTiming: r.avgStartTiming,
    c1ec: r.courses[0].entryCount, c1pr: r.courses[0].placeRate, c1st: r.courses[0].avgStartTiming, c1sr: r.courses[0].avgStartRank,
    c2ec: r.courses[1].entryCount, c2pr: r.courses[1].placeRate, c2st: r.courses[1].avgStartTiming, c2sr: r.courses[1].avgStartRank,
    c3ec: r.courses[2].entryCount, c3pr: r.courses[2].placeRate, c3st: r.courses[2].avgStartTiming, c3sr: r.courses[2].avgStartRank,
    c4ec: r.courses[3].entryCount, c4pr: r.courses[3].placeRate, c4st: r.courses[3].avgStartTiming, c4sr: r.courses[3].avgStartRank,
    c5ec: r.courses[4].entryCount, c5pr: r.courses[4].placeRate, c5st: r.courses[4].avgStartTiming, c5sr: r.courses[4].avgStartRank,
    c6ec: r.courses[5].entryCount, c6pr: r.courses[5].placeRate, c6st: r.courses[5].avgStartTiming, c6sr: r.courses[5].avgStartRank,
    termYear: r.termYear,
    termNo: r.termNo,
    calcPeriodFrom: r.calcPeriodFrom,
    calcPeriodTo: r.calcPeriodTo,
    rawJson: JSON.stringify(r.raw),
  });
}

/**
 * レーサー期別成績を取り込む。ダウンロードページ上の各LZHファイルにつき、
 * 既に取り込み済み(historical_ingest_log)であればスキップする。
 */
export async function ingestRacerPeriodStats(): Promise<{ files: number; racers: number }> {
  const html = await fetchOfficialPage("/owpc/pc/extra/data/download.html");
  const links = parseDownloadLinks(html);

  let fileCount = 0;
  let racerCount = 0;

  for (const link of links) {
    const key = link.split("/").pop() ?? link;
    if (alreadyIngested("racer_period", key)) continue;

    const binary = await fetchOfficialBinary(link);
    const extracted = await extractLzh(binary);

    const tx = getDb().transaction((records: RacerRecord[]) => {
      for (const r of records) upsertRacer(r);
    });

    for (const file of extracted) {
      const text = decodeShiftJis(file.buffer);
      const records = parsePlayersText(text);
      tx(records);
      racerCount += records.length;
    }

    markIngested("racer_period", key);
    fileCount += 1;
  }

  return { files: fileCount, racers: racerCount };
}

function insertRaceResults(rows: RaceResultRow[]): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO race_results (
      date, venue_name, race_name, round_name, race_type, rno,
      finish_position, lane, racer_number, racer_name, motor_number, boat_number,
      exhibition_time, entry_course, start_timing, race_time, raw_json
    ) VALUES (
      @date, @venueName, @raceName, @roundLabel, @raceType, @rno,
      @finishPosition, @lane, @racerNumber, @racerName, @motorNumber, @boatNumber,
      @exhibitionTime, @entryCourse, @startTiming, @raceTime, @rawJson
    )`
  );
  const tx = db.transaction((items: RaceResultRow[]) => {
    for (const row of items) {
      const rno = Number(row.roundLabel.replace(/\D/g, "")) || null;
      insert.run({
        date: row.date.replace(/\//g, ""),
        venueName: row.venueName,
        raceName: row.raceName,
        roundLabel: row.roundLabel,
        raceType: row.raceType,
        rno,
        finishPosition: row.finishPosition,
        lane: row.lane,
        racerNumber: row.racerNumber,
        racerName: row.racerName,
        motorNumber: row.motorNumber,
        boatNumber: row.boatNumber,
        exhibitionTime: row.exhibitionTime,
        entryCourse: row.entryCourse,
        startTiming: row.startTiming,
        raceTime: row.raceTime,
        rawJson: JSON.stringify(row),
      });
    }
  });
  tx(rows);
}

/**
 * 指定日の競走成績アーカイブ(Kファイル)を取り込む。date は YYYYMMDD。
 * 既に取り込み済みならスキップする。
 */
export async function ingestRaceResults(date: string): Promise<{ rows: number; skipped: boolean }> {
  if (alreadyIngested("race_results", date)) {
    return { rows: 0, skipped: true };
  }

  const yyyymm = date.slice(0, 6);
  const yy = date.slice(2, 4);
  const mm = date.slice(4, 6);
  const dd = date.slice(6, 8);
  const path = `/od2/K/${yyyymm}/k${yy}${mm}${dd}.lzh`;

  const binary = await fetchMbraceBinary(path);
  const extracted = await extractLzh(binary);

  let rowCount = 0;
  for (const file of extracted) {
    const text = decodeShiftJis(file.buffer);
    const rows = parseResultsText(text);
    insertRaceResults(rows);
    rowCount += rows.length;
  }

  markIngested("race_results", date);
  return { rows: rowCount, skipped: false };
}
