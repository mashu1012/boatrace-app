import type { DevelopmentPrediction, ExhibitionEntry } from "@/lib/types";

/**
 * 展示データ(展示タイム・進入コース・スタートタイミング)から、1マーク通過後の隊形を
 * 簡易ルールで推定する。
 *
 * これはAIによる自動予想ではなく、あくまで「展示データを見やすく図示する」ための
 * 補助的なヒューリスティックであり、要件定義書 5.1 のAI自動予想機能とは別物。
 * ルール:
 *   - インコース(1コース)は第1ターンマークで距離的に有利なため基礎点を優遇
 *   - スタートタイミングが早い(値が小さい/フライング側)ほど有利
 *   - 展示タイム(直走のタイム)が同レース内で最速の艇との差が小さいほど有利
 *     (展示タイムは実測のスピード指標であり、1マークまでの伸び・行き足に直結するため)
 */
export function buildDevelopmentPrediction(exhibitions: ExhibitionEntry[]): DevelopmentPrediction | null {
  const withCourse = exhibitions.filter((e) => e.startCourse !== null);
  if (withCourse.length === 0) return null;

  const courseOrder = [...exhibitions]
    .sort((a, b) => (a.startCourse ?? a.lane) - (b.startCourse ?? b.lane))
    .map((e) => e.lane);

  const COURSE_ADVANTAGE: Record<number, number> = { 1: -0.7, 2: -0.1, 3: 0, 4: 0.05, 5: 0.1, 6: 0.15 };

  const validTimes = exhibitions
    .map((e) => e.exhibitionTime)
    .filter((t): t is number => t !== null);
  const bestExhibitionTime = validTimes.length > 0 ? Math.min(...validTimes) : null;

  const EXHIBITION_TIME_WEIGHT = 3.0; // 最速艇との展示タイム差(秒)1つあたりの評価点への影響度
  const DEFAULT_TIME_DELTA = 0.1; // 展示タイム未取得時に用いる平均的な差分

  const scored = exhibitions.map((e) => {
    const course = e.startCourse ?? e.lane;
    const timing = e.startTiming ?? 0.15; // スタートタイミング未取得時は平均的な値で補完
    const exhibitionTimeDelta =
      bestExhibitionTime !== null && e.exhibitionTime !== null
        ? e.exhibitionTime - bestExhibitionTime
        : DEFAULT_TIME_DELTA;
    const score =
      course * 1.0 +
      timing * 2.0 +
      exhibitionTimeDelta * EXHIBITION_TIME_WEIGHT +
      (COURSE_ADVANTAGE[course] ?? 0);
    return { lane: e.lane, score };
  });

  const markOrder = scored.sort((a, b) => a.score - b.score || a.lane - b.lane).map((s) => s.lane);

  return {
    courseOrder,
    markOrder,
    note: "展示タイム・進入コース・スタートタイミングに基づく簡易的な参考表示です(AI予想ではありません)。",
  };
}
