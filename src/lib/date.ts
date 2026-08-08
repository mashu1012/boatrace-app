export function todayJst(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9 に固定変換
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function formatDateJp(date: string): string {
  if (!/^\d{8}$/.test(date)) return date;
  return `${date.slice(0, 4)}年${Number(date.slice(4, 6))}月${Number(date.slice(6, 8))}日`;
}

export function addDays(date: string, delta: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(4, 6));
  const d = Number(date.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}
