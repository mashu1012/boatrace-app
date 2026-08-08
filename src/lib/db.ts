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
