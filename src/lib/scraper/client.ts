/**
 * 公式サイトへのアクセスを一本化する薄いHTTPクライアント。
 *
 * 方針(README/requirements.md参照): 公式サイトの利用規約は「大量アクセスの禁止」
 * 「著作権によるコンテンツ再配布の制限」を定めており、スクレイピングを明示的に
 * 許可してはいない。そのためこのアプリでは
 *   - 全リクエストをこのクライアント経由に強制し、常に1件ずつ・最低間隔を空けて実行する
 *   - 呼び出し元(scheduler)側で「1レースにつき1回」の取得に厳しく制限する
 *   - 取得に失敗しても自動リトライは行わない(失敗時の多重アクセスを避けるため)
 * ことで、サイト運営への負荷を最小限に抑える。
 *
 * 重要: 呼び出しが複数同時に発生しても、実際のHTTPリクエストは常に1件ずつ
 * 「前のリクエストが完了してから最低間隔を空けて次を送る」形で直列化される。
 * (「待ち時間の予約」だけを直列化して実際のfetch呼び出しは並行させる、という
 * 実装は複数コネクションが同時に張られてしまうため採用していない)
 */

const BASE_URL = "https://www.boatrace.jp";
const MIN_INTERVAL_MS = 3000; // 直前のリクエスト完了からの最低間隔
const REQUEST_TIMEOUT_MS = 10000;
const USER_AGENT =
  "boatrace-app-demo/0.1 (non-commercial demo; low-frequency fetch; contact via GitHub repo mashu1012/boatrace-app)";

let lastRequestFinishedAt = 0;
// このPromiseチェーンより後段に積まれたリクエストは、前段が完了するまで開始しない。
// 直列化の単位は「待機+実際のfetch」全体であり、fetch単体だけを外に出さない。
let chain: Promise<unknown> = Promise.resolve();

async function doFetch(pathAndQuery: string): Promise<string> {
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

export function fetchOfficialPage(pathAndQuery: string): Promise<string> {
  const task = chain.then(async () => {
    const wait = Math.max(0, lastRequestFinishedAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await doFetch(pathAndQuery);
    } finally {
      lastRequestFinishedAt = Date.now();
    }
  });
  // 失敗しても後続のリクエストがチェーンを続けられるよう、エラーは握りつぶしたコピーを繋ぐ
  chain = task.catch(() => undefined);
  return task;
}
