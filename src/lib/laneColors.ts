// ボートレースの艇番(枠)カラーの慣習: 1白 2黒 3赤 4青 5黄 6緑
export const LANE_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "#ffffff", text: "#111111", label: "白" },
  2: { bg: "#111111", text: "#ffffff", label: "黒" },
  3: { bg: "#e11d2e", text: "#ffffff", label: "赤" },
  4: { bg: "#1e5fd9", text: "#ffffff", label: "青" },
  5: { bg: "#f4c518", text: "#111111", label: "黄" },
  6: { bg: "#1a9c4b", text: "#ffffff", label: "緑" },
};

export function laneColor(lane: number) {
  return LANE_COLORS[lane] ?? { bg: "#999999", text: "#ffffff", label: "?" };
}
