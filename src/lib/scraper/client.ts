/**
 * 公式サイトへのアクセスを一本化する薄いHTTPクライアント。
 *
 * 方針(README/requirements.md参照): 公式サイトの利用規約は「大量アクセスの禁止」
 * 「著作権によるコンテンツ再配布の制限」を定めており、スクレイピングを明示的に
 * 許可してはいない。そのためこのアプリでは
 *   - 全リクエストをこのクライアント経由に強制し、最低間隔を空ける
 *   - 呼び出し元(scheduler)側で「1レースにつき1回」の取得に厳しく制限する
 * ことで、サイト運営への負荷を最小限に抑える。
 */

const BASE_URL = "https://www.boatrace.jp";
const MIN_INTERVAL_MS = 3000; // 同一プロセス内でのリクエスト最小間隔
const REQUEST_TIMEOUT_MS = 10000;
const USER_AGENT =
  "boatrace-app-demo/0.1 (non-commercial demo; low-frequency fetch; contact via GitHub repo mashu1012/boatrace-app)";

let lastRequestAt = 0;
let queue: Promise<void> = Promise.resolve();

async function throttle(): Promise<void> {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  queue = run.catch(() => {});
  return run;
}

export async function fetchOfficialPage(pathAndQuery: string): Promise<string> {
  await throttle();

  const url = `${BASE_URL}${pathAndQuery}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "ja",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`official site fetch failed: ${res.status} ${url}`);
    }
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf);
  } finally {
    clearTimeout(timer);
  }
}
