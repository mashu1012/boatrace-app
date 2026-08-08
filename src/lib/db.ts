import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "boatrace.db");

declare global {
  var __boatraceDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      jcd TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      rno INTEGER NOT NULL,
      race_title TEXT,
      deadline TEXT,
      fetched_card_at TEXT,
      fetched_exhibition_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_races_date ON races(date);

    CREATE TABLE IF NOT EXISTS entries (
      race_id TEXT NOT NULL,
      lane INTEGER NOT NULL,
      racer_number TEXT,
      racer_name TEXT NOT NULL,
      racer_class TEXT,
      motor_number INTEGER,
      boat_number INTEGER,
      motor_win2_rate REAL,
      national_win3_rate REAL,
      national_win2_rate REAL,
      local_win3_rate REAL,
      local_win2_rate REAL,
      PRIMARY KEY (race_id, lane),
      FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exhibitions (
      race_id TEXT NOT NULL,
      lane INTEGER NOT NULL,
      exhibition_time REAL,
      tilt REAL,
      start_course INTEGER,
      start_timing REAL,
      PRIMARY KEY (race_id, lane),
      FOREIGN KEY (race_id) REFERENCES races(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS venue_days (
      date TEXT NOT NULL,
      jcd TEXT NOT NULL,
      venue_name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      event_day_label TEXT,
      period_badge TEXT,
      grade_badge TEXT,
      fetched_at TEXT,
      PRIMARY KEY (date, jcd)
    );

    -- 展示データの取得ロック: 1レースにつき1回だけ取得したことをDB上で保証するための行。
    -- races.fetched_exhibition_at の更新と同一トランザクションで INSERT することで
    -- 複数プロセス/同時アクセスからの二重取得を防ぐ。
    CREATE TABLE IF NOT EXISTS exhibition_fetch_lock (
      race_id TEXT PRIMARY KEY,
      locked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- レーサー期別成績マスタ(公式サイト「ダウンロード・他」ページのLZH配布データ由来)。
    -- ライブスクレイピングとは別系統の低頻度バッチ(年数回)で更新する想定。
    -- 全166項目のうち主要なものだけを型付きカラムに展開し、残りは raw_json に保持する。
    CREATE TABLE IF NOT EXISTS racers (
      racer_number TEXT PRIMARY KEY,
      name_kanji TEXT NOT NULL,
      name_kana TEXT,
      branch TEXT,
      racer_class TEXT,
      win_rate REAL,
      place_rate REAL,
      first_count INTEGER,
      second_count INTEGER,
      race_count INTEGER,
      win_event_count INTEGER,
      champion_count INTEGER,
      avg_start_timing REAL,
      course1_entry_count INTEGER, course1_place_rate REAL, course1_avg_st REAL, course1_avg_start_rank REAL,
      course2_entry_count INTEGER, course2_place_rate REAL, course2_avg_st REAL, course2_avg_start_rank REAL,
      course3_entry_count INTEGER, course3_place_rate REAL, course3_avg_st REAL, course3_avg_start_rank REAL,
      course4_entry_count INTEGER, course4_place_rate REAL, course4_avg_st REAL, course4_avg_start_rank REAL,
      course5_entry_count INTEGER, course5_place_rate REAL, course5_avg_st REAL, course5_avg_start_rank REAL,
      course6_entry_count INTEGER, course6_place_rate REAL, course6_avg_st REAL, course6_avg_start_rank REAL,
      term_year TEXT,
      term_no TEXT,
      calc_period_from TEXT,
      calc_period_to TEXT,
      raw_json TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 競走成績アーカイブ(mbrace.or.jp Kファイル由来)。過去レース結果の蓄積用で、
    -- 現状の画面表示には未使用(第2段階のAI予想・統計機能のための土台)。
    CREATE TABLE IF NOT EXISTS race_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      venue_name TEXT,
      race_name TEXT,
      round_name TEXT,
      race_type TEXT,
      rno INTEGER,
      finish_position TEXT,
      lane INTEGER,
      racer_number TEXT,
      racer_name TEXT,
      motor_number INTEGER,
      boat_number INTEGER,
      exhibition_time REAL,
      entry_course INTEGER,
      start_timing REAL,
      race_time TEXT,
      raw_json TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_race_results_date ON race_results(date);
    CREATE INDEX IF NOT EXISTS idx_race_results_racer ON race_results(racer_number);

    -- 履歴データ(期別成績・競走成績)の取り込み済み管理。同じ期/日付を再ダウンロードしない
    -- ようにするための冪等性チェック用テーブル(ライブ側のfetched_atと同じ考え方)。
    CREATE TABLE IF NOT EXISTS historical_ingest_log (
      source TEXT NOT NULL,
      key TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (source, key)
    );
  `);
  return db;
}

// Next.js dev server は HMR でモジュールを再評価するため、globalThis にキャッシュして
// better-sqlite3 の接続が重複生成されるのを防ぐ。
export function getDb(): Database.Database {
  if (!globalThis.__boatraceDb) {
    globalThis.__boatraceDb = createDb();
  }
  return globalThis.__boatraceDb;
}
