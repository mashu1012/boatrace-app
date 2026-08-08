export type PeriodBadge = "モーニング" | "デイ" | "サマータイム" | "ナイター" | "ミッドナイト";

export type VenueDayStatus = {
  jcd: string;
  venueName: string;
  active: boolean;
  eventDayLabel: string | null; // 初日/2日目/.../最終日
  periodBadge: PeriodBadge | null;
  gradeBadge: string | null; // G1/G2/G3/SG
};

export type RaceSummary = {
  id: string; // `${date}-${jcd}-${rno}`
  date: string; // YYYYMMDD
  jcd: string;
  venueName: string;
  rno: number;
  raceTitle: string | null;
  deadline: string | null; // HH:MM
  hasCard: boolean; // 出走表が取得済みか
  hasExhibition: boolean; // 展示データが取得済みか
};

export type Entry = {
  lane: number; // 1-6 号艇(枠番)
  racerNumber: string | null;
  racerName: string;
  racerClass: string | null; // A1/A2/B1/B2
  motorNumber: number | null;
  boatNumber: number | null;
  motorWin2Rate: number | null; // モーター2連対率
  nationalWin3Rate: number | null; // 全国3連対率
  nationalWin2Rate: number | null; // 全国2連対率
  localWin3Rate: number | null; // 当地3連対率
  localWin2Rate: number | null; // 当地2連対率
};

export type ExhibitionEntry = {
  lane: number; // 号艇(艇番)
  exhibitionTime: number | null; // 展示タイム(秒)
  tilt: number | null;
  startCourse: number | null; // 進入コース予想(1-6)
  startTiming: number | null; // スタートタイミング(秒, 負値はフライング目安)
};

export type RacerCourseProfile = {
  entryCount: number | null;
  placeRate: number | null;
  avgStartTiming: number | null;
  avgStartRank: number | null;
};

/**
 * レーサー期別成績マスタ(racersテーブル)由来のプロフィール。
 * 「複勝率」が2連対率・3連対率のいずれを指すか実データで未検証のため、現状は
 * entries(出走表)の national_win3_rate 等へは自動反映していない
 * (README「過去データ(データベース基盤)について」参照)。
 */
export type RacerProfile = {
  racerNumber: string;
  nameKanji: string;
  nameKana: string;
  branch: string;
  racerClass: string;
  winRate: number | null;
  placeRate: number | null;
  raceCount: number | null;
  avgStartTiming: number | null;
  /** index 0 = 1コース 〜 index 5 = 6コース */
  courses: RacerCourseProfile[];
  termYear: string | null;
  termNo: string | null;
};

export type RaceDetail = {
  summary: RaceSummary;
  entries: Entry[];
  exhibitions: ExhibitionEntry[];
  prediction: DevelopmentPrediction | null;
};

export type MarkLineEntry = {
  lane: number;
  gapSeconds: number; // 先頭艇が1マークに到達した瞬間の推定タイム差(先頭艇は0)
};

export type DevelopmentPrediction = {
  // 進入コース順(1マーク進入予想の左から並び, 値は艇番)
  courseOrder: number[];
  // 1マーク通過後の予想順位(艇番の配列, 先頭が1着予想)
  markOrder: number[];
  // 先頭艇が1マークに到達した瞬間の各艇のライン(markOrder順、先頭艇との推定差付き)
  markLine: MarkLineEntry[];
  note: string;
};
