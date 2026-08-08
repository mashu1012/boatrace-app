/**
 * 公式サイト(boatrace.jp)へのアクセスを一本化する薄いHTTPクライアント。
 *
 * 方針(README/requirements.md参照): 公式サイトの利用規約は「大量アクセスの禁止」
 * 「著作権によるコンテンツ再配布の制限」を定めており、スクレイピングを明示的に
 * 許可してはいない。そのためこのアプリでは
 *   - 全リクエストをこのクライアント経由に強制し、常に1件ずつ・最低間隔を空けて実行する
 *     (直列化の詳細は httpClient.ts 参照)
 *   - 呼び出し元(scheduler)側で「1レースにつき1回」の取得に厳しく制限する
 *   - 取得に失敗しても自動リトライは行わない(失敗時の多重アクセスを避けるため)
 * ことで、サイト運営への負荷を最小限に抑える。
 */

import { createThrottledClient } from "./httpClient";

const USER_AGENT =
  "boatrace-app-demo/0.1 (non-commercial demo; low-frequency fetch; contact via GitHub repo mashu1012/boatrace-app)";

const officialClient = createThrottledClient({
  baseUrl: "https://www.boatrace.jp",
  userAgent: USER_AGENT,
  minIntervalMs: 3000,
});

/** HTML等のテキストページを取得する(番組表・出走表・直前情報など) */
export function fetchOfficialPage(pathAndQuery: string): Promise<string> {
  return officialClient.fetchText(pathAndQuery);
}

/** LZHアーカイブ等のバイナリファイルを取得する(レーサー期別成績ダウンロード等) */
export function fetchOfficialBinary(pathAndQuery: string): Promise<Buffer> {
  return officialClient.fetchBinary(pathAndQuery);
}
