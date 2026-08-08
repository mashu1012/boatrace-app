import type { DevelopmentPrediction, ExhibitionEntry } from "@/lib/types";

/**
 * 展示データ(進入コース・スタートタイミング)から、1マーク通過後の隊形を
 * 簡易ルールで推定する。
 *
 * これはAIによる自動予想ではなく、あくまで「展示データを見やすく図示する」ための
 * 補助的なヒューリスティックであり、要件定義書 5.1 のAI自動予想機能とは別物。
 * ルール:
 *   - インコース(1コース)は第1ターンマークで距離的に有利なため基礎点を優遇
 *   - スタートタイミングが早い(値が小さい/フライング側)ほど有利
 */
export function buildDevelopmentPrediction(exhibitions: ExhibitionEntry[]): DevelopmentPrediction | null {
  const withCourse = exhibitions.filter((e) => e.startCourse !== null);
  if (withCourse.length === 0) return null;

  const courseOrder = [...exhibitions]
    .sort((a, b) => (a.startCourse ?? a.lane) - (b.startCourse ?? b.lane))
    .map((e) => e.lane);

  const COURSE_ADVANTAGE: Record<number, number> = { 1: -0.7, 2: -0.1, 3: 0, 4: 0.05, 5: 0.1, 6: 0.15 };

  const scored = exhibitions.map((e) => {
    const course = e.startCourse ?? e.lane;
    const timing = e.startTiming ?? 0.15; // 展示データ未取得時は平均的な値で補完
    const score = course * 1.0 + timing * 2.0 + (COURSE_ADVANTAGE[course] ?? 0);
    return { lane: e.lane, score };
  });

  const markOrder = scored.sort((a, b) => a.score - b.score || a.lane - b.lane).map((s) => s.lane);

  return {
    courseOrder,
    markOrder,
    note: "展示タイム・進入コース・スタートタイミングに基づく簡易的な参考表示です(AI予想ではありません)。",
  };
}
