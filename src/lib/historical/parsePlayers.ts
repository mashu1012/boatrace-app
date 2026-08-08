/**
 * レーサー期別成績データ(boatrace.jp「ダウンロード・他」ページ配布のLZH、解凍後の
 * 固定長テキスト)のパーサー。
 *
 * 1行1選手・143項目の固定長フォーマット。各項目のオフセットは、同フォーマットを
 * 実際に処理している公開実装(GitHub: cstenmt/boatrace の txtTocsv_players.py)の
 * バイト位置定義を参照して構築した。オフセットは「Shift-JISとしてデコードした後の
 * 文字位置」(Pythonの `str[start:end]` と同じ考え方)であり、生バイト位置ではない点に
 * 注意。呼び出し側は decodeShiftJis() でデコード済みの文字列を渡すこと。
 *
 * 実際の配布ファイルでの検証はネットワーク制限により未実施(未検証)。
 */

const FIELD_RANGES: [number, number][] = [
  [0, 4], [4, 12], [12, 27], [27, 29], [29, 31], [31, 32], [32, 38], [38, 39],
  [39, 41], [41, 44], [44, 46], [46, 48], [48, 52], [52, 56], [56, 59], [59, 62], [62, 65],
  [65, 67], [67, 69], [69, 72], [72, 75], [75, 79], [79, 82], [82, 85], [85, 88], [88, 92],
  [92, 95], [95, 98], [98, 101], [101, 105], [105, 108], [108, 111], [111, 114], [114, 118],
  [118, 121], [121, 124], [124, 127], [127, 131], [131, 134], [134, 137], [137, 140],
  [140, 144], [144, 147], [147, 150], [150, 152], [152, 154], [154, 156], [156, 160],
  [160, 164], [164, 168], [168, 169], [169, 177], [177, 185], [185, 188], [188, 191],
  [191, 194], [194, 197], [197, 200], [200, 203], [203, 206], [206, 208], [208, 210],
  [210, 212], [212, 214], [214, 216], [216, 218], [218, 220], [220, 222], [222, 225],
  [225, 228], [228, 231], [231, 234], [234, 237], [237, 240], [240, 242], [242, 244],
  [244, 246], [246, 248], [248, 250], [250, 252], [252, 254], [254, 256], [256, 259],
  [259, 262], [262, 265], [265, 268], [268, 271], [271, 274], [274, 276], [276, 278],
  [278, 280], [280, 282], [282, 284], [284, 286], [286, 288], [288, 290], [290, 293],
  [293, 296], [296, 299], [299, 302], [302, 305], [305, 308], [308, 310], [310, 312],
  [312, 314], [314, 316], [316, 318], [318, 320], [320, 322], [322, 324], [324, 327],
  [327, 330], [330, 333], [333, 336], [336, 339], [339, 342], [342, 344], [344, 346],
  [346, 348], [348, 350], [350, 352], [352, 354], [354, 356], [356, 358], [358, 361],
  [361, 364], [364, 367], [367, 370], [370, 373], [373, 376], [376, 378], [378, 380],
  [380, 382], [382, 384], [384, 386], [386, 388], [388, 390], [390, 392], [392, 394],
  [394, 396], [396, 398], [398, 400], [400, 406],
];

const FIELD_NAMES = (
  "登番,名前漢字,名前カナ,支部,級,年号,生年月日,性別,年齢,身長,体重,血液型,勝率,複勝率," +
  "1着回数,2着回数,出走回数,優出回数,優勝回数,平均スタートタイミング," +
  "1コース進入回数,1コース複勝率,1コース平均スタートタイミング,1コース平均スタート順位," +
  "2コース進入回数,2コース複勝率,2コース平均スタートタイミング,2コース平均スタート順位," +
  "3コース進入回数,3コース複勝率,3コース平均スタートタイミング,3コース平均スタート順位," +
  "4コース進入回数,4コース複勝率,4コース平均スタートタイミング,4コース平均スタート順位," +
  "5コース進入回数,5コース複勝率,5コース平均スタートタイミング,5コース平均スタート順位," +
  "6コース進入回数,6コース複勝率,6コース平均スタートタイミング,6コース平均スタート順位," +
  "前期級,前々期級,前々々期級,前期能力指数,今期能力指数,年,期,算出期間（自）,算出期間（至）,養成期," +
  "1コース1着回数,1コース2着回数,1コース3着回数,1コース4着回数,1コース5着回数,1コース6着回数," +
  "1コースF回数,1コースL0回数,1コースL1回数,1コースK0回数,1コースK1回数,1コースS0回数,1コースS1回数,1コースS2回数," +
  "2コース1着回数,2コース2着回数,2コース3着回数,2コース4着回数,2コース5着回数,2コース6着回数," +
  "2コースF回数,2コースL0回数,2コースL1回数,2コースK0回数,2コースK1回数,2コースS0回数,2コースS1回数,2コースS2回数," +
  "3コース1着回数,3コース2着回数,3コース3着回数,3コース4着回数,3コース5着回数,3コース6着回数," +
  "3コースF回数,3コースL0回数,3コースL1回数,3コースK0回数,3コースK1回数,3コースS0回数,3コースS1回数,3コースS2回数," +
  "4コース1着回数,4コース2着回数,4コース3着回数,4コース4着回数,4コース5着回数,4コース6着回数," +
  "4コースF回数,4コースL0回数,4コースL1回数,4コースK0回数,4コースK1回数,4コースS0回数,4コースS1回数,4コースS2回数," +
  "5コース1着回数,5コース2着回数,5コース3着回数,5コース4着回数,5コース5着回数,5コース6着回数," +
  "5コースF回数,5コースL0回数,5コースL1回数,5コースK0回数,5コースK1回数,5コースS0回数,5コースS1回数,5コースS2回数," +
  "6コース1着回数,6コース2着回数,6コース3着回数,6コース4着回数,6コース5着回数,6コース6着回数," +
  "6コースF回数,6コースL0回数,6コースL1回数,6コースK0回数,6コースK1回数,6コースS0回数,6コースS1回数,6コースS2回数," +
  "コースなしL0回数,コースなしL1回数,コースなしK0回数,コースなしK1回数,出身地"
).split(",");

if (FIELD_NAMES.length !== FIELD_RANGES.length) {
  throw new Error(
    `parsePlayers: フィールド名(${FIELD_NAMES.length})とオフセット定義(${FIELD_RANGES.length})の数が一致しません`
  );
}

export type RacerCourseStat = {
  entryCount: number | null;
  placeRate: number | null;
  avgStartTiming: number | null;
  avgStartRank: number | null;
};

export type RacerRecord = {
  racerNumber: string;
  nameKanji: string;
  nameKana: string;
  branch: string;
  racerClass: string;
  winRate: number | null;
  placeRate: number | null;
  firstCount: number | null;
  secondCount: number | null;
  raceCount: number | null;
  winEventCount: number | null;
  championCount: number | null;
  avgStartTiming: number | null;
  /** index 0 = 1コース 〜 index 5 = 6コース */
  courses: RacerCourseStat[];
  termYear: string | null;
  termNo: string | null;
  calcPeriodFrom: string | null;
  calcPeriodTo: string | null;
  /** 全143項目の生値(トリム済み文字列)。型付きフィールドに含めない項目の参照用。 */
  raw: Record<string, string>;
};

function toNumber(s: string | undefined): number | null {
  const t = (s ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toText(s: string | undefined): string {
  return (s ?? "").trim();
}

/** 固定長テキスト(Shift-JISデコード済み)をレーサー期別成績レコードの配列に変換する */
export function parsePlayersText(text: string): RacerRecord[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const records: RacerRecord[] = [];

  for (const line of lines) {
    const raw: Record<string, string> = {};
    FIELD_RANGES.forEach(([start, end], i) => {
      raw[FIELD_NAMES[i]] = toText(line.slice(start, end));
    });

    if (!raw["登番"]) continue; // 空行・不正行はスキップ

    const courses: RacerCourseStat[] = [1, 2, 3, 4, 5, 6].map((course) => ({
      entryCount: toNumber(raw[`${course}コース進入回数`]),
      placeRate: toNumber(raw[`${course}コース複勝率`]),
      avgStartTiming: toNumber(raw[`${course}コース平均スタートタイミング`]),
      avgStartRank: toNumber(raw[`${course}コース平均スタート順位`]),
    }));

    records.push({
      racerNumber: raw["登番"],
      nameKanji: raw["名前漢字"],
      nameKana: raw["名前カナ"],
      branch: raw["支部"],
      racerClass: raw["級"],
      winRate: toNumber(raw["勝率"]),
      placeRate: toNumber(raw["複勝率"]),
      firstCount: toNumber(raw["1着回数"]),
      secondCount: toNumber(raw["2着回数"]),
      raceCount: toNumber(raw["出走回数"]),
      winEventCount: toNumber(raw["優出回数"]),
      championCount: toNumber(raw["優勝回数"]),
      avgStartTiming: toNumber(raw["平均スタートタイミング"]),
      courses,
      termYear: raw["年"] || null,
      termNo: raw["期"] || null,
      calcPeriodFrom: raw["算出期間（自）"] || null,
      calcPeriodTo: raw["算出期間（至）"] || null,
      raw,
    });
  }

  return records;
}
