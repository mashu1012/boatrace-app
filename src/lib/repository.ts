import { getDb } from "@/lib/db";
import { buildDevelopmentPrediction } from "@/lib/prediction";
import { deadlineDateJst } from "@/lib/date";
import { VENUES } from "@/lib/venues";
import type {
  Entry,
  ExhibitionEntry,
  PeriodBadge,
  RaceDetail,
  RaceSummary,
  RacerProfile,
  VenueDayStatus,
} from "@/lib/types";

type RaceRow = {
  id: string;
  date: string;
  jcd: string;
  venue_name: string;
  rno: number;
  race_title: string | null;
  deadline: string | null;
  fetched_card_at: string | null;
  fetched_exhibition_at: string | null;
};

function toSummary(row: RaceRow): RaceSummary {
  return {
    id: row.id,
    date: row.date,
    jcd: row.jcd,
    venueName: row.venue_name,
    rno: row.rno,
    raceTitle: row.race_title,
    deadline: row.deadline,
    hasCard: row.fetched_card_at !== null,
    hasExhibition: row.fetched_exhibition_at !== null,
  };
}

export function listRacesByDate(date: string): RaceSummary[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM races WHERE date = ? ORDER BY jcd ASC, rno ASC")
    .all(date) as RaceRow[];
  return rows.map(toSummary);
}

export function getRaceDetail(raceId: string): RaceDetail | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM races WHERE id = ?").get(raceId) as RaceRow | undefined;
  if (!row) return null;

  const entryRows = db
    .prepare("SELECT * FROM entries WHERE race_id = ? ORDER BY lane ASC")
    .all(raceId) as Array<{
    lane: number;
    racer_number: string | null;
    racer_name: string;
    racer_class: string | null;
    motor_number: number | null;
    boat_number: number | null;
    motor_win2_rate: number | null;
    national_win3_rate: number | null;
    national_win2_rate: number | null;
    local_win3_rate: number | null;
    local_win2_rate: number | null;
  }>;

  const entries: Entry[] = entryRows.map((e) => ({
    lane: e.lane,
    racerNumber: e.racer_number,
    racerName: e.racer_name,
    racerClass: e.racer_class,
    motorNumber: e.motor_number,
    boatNumber: e.boat_number,
    motorWin2Rate: e.motor_win2_rate,
    nationalWin3Rate: e.national_win3_rate,
    nationalWin2Rate: e.national_win2_rate,
    localWin3Rate: e.local_win3_rate,
    localWin2Rate: e.local_win2_rate,
  }));

  const exhibitionRows = db
    .prepare("SELECT * FROM exhibitions WHERE race_id = ? ORDER BY lane ASC")
    .all(raceId) as Array<{
    lane: number;
    exhibition_time: number | null;
    tilt: number | null;
    start_course: number | null;
    start_timing: number | null;
  }>;

  const exhibitions: ExhibitionEntry[] = exhibitionRows.map((e) => ({
    lane: e.lane,
    exhibitionTime: e.exhibition_time,
    tilt: e.tilt,
    startCourse: e.start_course,
    startTiming: e.start_timing,
  }));

  return {
    summary: toSummary(row),
    entries,
    exhibitions,
    prediction: exhibitions.length > 0 ? buildDevelopmentPrediction(exhibitions) : null,
  };
}

/**
 * 指定の場・日について「現在開催中/次に締切を迎えるレース」のIDを返す。
 * 全レースの締切が過ぎている(その日のレースが終了している)場合は最終レースを返す。
 * レースデータが存在しない場合は null。
 */
export function getCurrentOrNextRaceId(date: string, jcd: string): string | null {
  const races = listRacesByDate(date)
    .filter((r) => r.jcd === jcd)
    .sort((a, b) => a.rno - b.rno);
  if (races.length === 0) return null;

  const now = Date.now();
  const next = races.find((r) => {
    if (!r.deadline) return false;
    const dt = deadlineDateJst(date, r.deadline);
    return dt !== null && dt.getTime() >= now;
  });
  return (next ?? races[races.length - 1]).id;
}

export function listVenueDaysByDate(date: string): VenueDayStatus[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM venue_days WHERE date = ?").all(date) as Array<{
    jcd: string;
    venue_name: string;
    active: number;
    event_day_label: string | null;
    period_badge: string | null;
    grade_badge: string | null;
  }>;
  const byJcd = new Map(rows.map((r) => [r.jcd, r]));

  return VENUES.map((v) => {
    const row = byJcd.get(v.jcd);
    if (!row) {
      return {
        jcd: v.jcd,
        venueName: v.name,
        active: false,
        eventDayLabel: null,
        periodBadge: null,
        gradeBadge: null,
      };
    }
    return {
      jcd: row.jcd,
      venueName: row.venue_name,
      active: Boolean(row.active),
      eventDayLabel: row.event_day_label,
      periodBadge: row.period_badge as PeriodBadge | null,
      gradeBadge: row.grade_badge,
    };
  });
}

type RacerRow = {
  racer_number: string;
  name_kanji: string;
  name_kana: string | null;
  branch: string | null;
  racer_class: string | null;
  win_rate: number | null;
  place_rate: number | null;
  race_count: number | null;
  avg_start_timing: number | null;
  term_year: string | null;
  term_no: string | null;
} & Record<`course${1 | 2 | 3 | 4 | 5 | 6}_${"entry_count" | "place_rate" | "avg_st" | "avg_start_rank"}`, number | null>;

/**
 * レーサー期別成績マスタ(racersテーブル、過去データ取り込みバッチで投入)からの読み取り。
 * 現状どの画面からも呼ばれていない(将来、出走表の補強表示や第2段階のAI予想で利用する
 * ための土台)。フィールドの意味(特に複勝率が何連対率を指すか)は実データでの検証が
 * 済むまで、既存のentries表示側には反映しないこと。
 */
export function getRacerProfile(racerNumber: string): RacerProfile | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM racers WHERE racer_number = ?").get(racerNumber) as
    | RacerRow
    | undefined;
  if (!row) return null;

  const courseProfiles = ([1, 2, 3, 4, 5, 6] as const).map((course) => ({
    entryCount: row[`course${course}_entry_count`],
    placeRate: row[`course${course}_place_rate`],
    avgStartTiming: row[`course${course}_avg_st`],
    avgStartRank: row[`course${course}_avg_start_rank`],
  }));

  return {
    racerNumber: row.racer_number,
    nameKanji: row.name_kanji,
    nameKana: row.name_kana ?? "",
    branch: row.branch ?? "",
    racerClass: row.racer_class ?? "",
    winRate: row.win_rate,
    placeRate: row.place_rate,
    raceCount: row.race_count,
    avgStartTiming: row.avg_start_timing,
    courses: courseProfiles,
    termYear: row.term_year,
    termNo: row.term_no,
  };
}

export function listActiveDates(): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT DISTINCT date FROM races ORDER BY date DESC").all() as Array<{
    date: string;
  }>;
  return rows.map((r) => r.date);
}
