export function todayJst(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9 に固定変換
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function formatDateJp(date: string): string {
  if (!/^\d{8}$/.test(date)) return date;
  return `${date.slice(0, 4)}/${date.slice(4, 6)}/${date.slice(6, 8)}`;
}
