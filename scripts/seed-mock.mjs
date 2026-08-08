// 開発・デモ用: 公式サイトにアクセスせず、UI確認用のサンプルデータをDBへ投入するスクリプト。
// 使い方: node scripts/seed-mock.mjs
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "boatrace.db"));
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
    PRIMARY KEY (race_id, lane)
  );
  CREATE TABLE IF NOT EXISTS exhibitions (
    race_id TEXT NOT NULL,
    lane INTEGER NOT NULL,
    exhibition_time REAL,
    tilt REAL,
    start_course INTEGER,
    start_timing REAL,
    PRIMARY KEY (race_id, lane)
  );
  CREATE TABLE IF NOT EXISTS exhibition_fetch_lock (
    race_id TEXT PRIMARY KEY,
    locked_at TEXT NOT NULL DEFAULT (datetime('now'))
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
`);

const ALL_VENUES = [
  { jcd: "01", name: "桐生" },
  { jcd: "02", name: "戸田" },
  { jcd: "03", name: "江戸川" },
  { jcd: "04", name: "平和島" },
  { jcd: "05", name: "多摩川" },
  { jcd: "06", name: "浜名湖" },
  { jcd: "07", name: "蒲郡" },
  { jcd: "08", name: "常滑" },
  { jcd: "09", name: "津" },
  { jcd: "10", name: "三国" },
  { jcd: "11", name: "びわこ" },
  { jcd: "12", name: "住之江" },
  { jcd: "13", name: "尼崎" },
  { jcd: "14", name: "鳴門" },
  { jcd: "15", name: "丸亀" },
  { jcd: "16", name: "児島" },
  { jcd: "17", name: "宮島" },
  { jcd: "18", name: "徳山" },
  { jcd: "19", name: "下関" },
  { jcd: "20", name: "若松" },
  { jcd: "21", name: "芦屋" },
  { jcd: "22", name: "福岡" },
  { jcd: "23", name: "唐津" },
  { jcd: "24", name: "大村" },
];

// レースカードまで投入する場(展示データ・出走表デモ用)
const VENUES = [
  { jcd: "12", name: "住之江" },
  { jcd: "05", name: "多摩川" },
  { jcd: "17", name: "宮島" },
];

const RACER_NAMES = [
  "田中 一郎", "鈴木 大輔", "佐藤 健太", "山本 翔太", "渡辺 直人", "伊藤 光",
  "中村 淳", "小林 誠", "加藤 拓海", "吉田 隼人", "山田 蓮", "斉藤 亮太",
];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

const today = (() => {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;
})();

const upsertRace = db.prepare(`
  INSERT INTO races (id, date, jcd, venue_name, rno, race_title, deadline, fetched_card_at)
  VALUES (@id, @date, @jcd, @venueName, @rno, @raceTitle, @deadline, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET race_title=excluded.race_title, deadline=excluded.deadline, fetched_card_at=excluded.fetched_card_at
`);
const upsertEntry = db.prepare(`
  INSERT INTO entries (race_id, lane, racer_number, racer_name, racer_class, motor_number, boat_number,
    motor_win2_rate, national_win3_rate, national_win2_rate, local_win3_rate, local_win2_rate)
  VALUES (@raceId, @lane, @racerNumber, @racerName, @racerClass, @motorNumber, @boatNumber,
    @motorWin2Rate, @nationalWin3Rate, @nationalWin2Rate, @localWin3Rate, @localWin2Rate)
  ON CONFLICT(race_id, lane) DO UPDATE SET racer_name=excluded.racer_name
`);
const upsertExhibition = db.prepare(`
  INSERT INTO exhibitions (race_id, lane, exhibition_time, tilt, start_course, start_timing)
  VALUES (@raceId, @lane, @exhibitionTime, @tilt, @startCourse, @startTiming)
  ON CONFLICT(race_id, lane) DO UPDATE SET exhibition_time=excluded.exhibition_time, start_course=excluded.start_course, start_timing=excluded.start_timing
`);
const markFetched = db.prepare(
  "UPDATE races SET fetched_exhibition_at = datetime('now') WHERE id = ?"
);
const upsertVenueDay = db.prepare(`
  INSERT INTO venue_days (date, jcd, venue_name, active, event_day_label, period_badge, grade_badge, fetched_at)
  VALUES (@date, @jcd, @venueName, @active, @eventDayLabel, @periodBadge, @gradeBadge, datetime('now'))
  ON CONFLICT(date, jcd) DO UPDATE SET active=excluded.active, event_day_label=excluded.event_day_label,
    period_badge=excluded.period_badge, grade_badge=excluded.grade_badge, fetched_at=excluded.fetched_at
`);

const ACTIVE_JCDS = new Set(VENUES.map((v) => v.jcd));
const DEMO_META = {
  "12": { eventDayLabel: "5日目", periodBadge: "ナイター", gradeBadge: null },
  "05": { eventDayLabel: "初日", periodBadge: "サマータイム", gradeBadge: null },
  "17": { eventDayLabel: "最終日", periodBadge: "デイ", gradeBadge: "G1" },
};

for (const venue of ALL_VENUES) {
  // レースデータを投入していない場をactive扱いにすると /venue/[jcd] が404になるため、
  // 実際にレースを投入するVENUESのみactiveにする
  const active = ACTIVE_JCDS.has(venue.jcd);
  const meta = DEMO_META[venue.jcd] ?? {};
  upsertVenueDay.run({
    date: today,
    jcd: venue.jcd,
    venueName: venue.name,
    active: active ? 1 : 0,
    eventDayLabel: active ? (meta.eventDayLabel ?? "初日") : null,
    periodBadge: active ? (meta.periodBadge ?? "デイ") : null,
    gradeBadge: active ? (meta.gradeBadge ?? null) : null,
  });
}

let raceCount = 0;
for (const venue of VENUES) {
  for (let rno = 1; rno <= 12; rno++) {
    const id = `${today}-${venue.jcd}-${rno}`;
    const hour = 9 + Math.floor((rno - 1) / 2);
    const minute = (rno - 1) % 2 === 0 ? "05" : "35";
    const deadline = `${String(hour).padStart(2, "0")}:${minute}`;

    upsertRace.run({
      id,
      date: today,
      jcd: venue.jcd,
      venueName: venue.name,
      rno,
      raceTitle: rno === 12 ? "優勝戦" : `第${rno}レース`,
      deadline,
    });

    const classes = ["A1", "A1", "A2", "B1", "B1", "B2"].sort(() => Math.random() - 0.5);
    for (let lane = 1; lane <= 6; lane++) {
      upsertEntry.run({
        raceId: id,
        lane,
        racerNumber: String(4000 + Math.floor(rand(0, 999))),
        racerName: RACER_NAMES[Math.floor(rand(0, RACER_NAMES.length))],
        racerClass: classes[lane - 1],
        motorNumber: Math.floor(rand(1, 80)),
        boatNumber: Math.floor(rand(1, 80)),
        motorWin2Rate: Number(rand(25, 55).toFixed(1)),
        nationalWin3Rate: Number(rand(20, 65).toFixed(1)),
        nationalWin2Rate: Number(rand(10, 45).toFixed(1)),
        localWin3Rate: Number(rand(20, 65).toFixed(1)),
        localWin2Rate: Number(rand(10, 45).toFixed(1)),
      });
    }

    // 最初の数レースだけ「展示データ取得済み」のデモにする(締切間近を模擬)
    if (rno <= 2 && venue.jcd === "12") {
      const courses = [1, 2, 3, 4, 5, 6].sort(() => Math.random() - 0.5);
      for (let lane = 1; lane <= 6; lane++) {
        upsertExhibition.run({
          raceId: id,
          lane,
          exhibitionTime: Number(rand(6.6, 7.1).toFixed(2)),
          tilt: Number(rand(-0.5, 2).toFixed(1)),
          startCourse: courses[lane - 1],
          startTiming: Number(rand(0.05, 0.25).toFixed(2)),
        });
      }
      markFetched.run(id);
    }

    raceCount++;
  }
}

console.log(`Seeded ${raceCount} races (mock data) for date ${today}.`);
