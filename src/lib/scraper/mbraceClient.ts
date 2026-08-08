/**
 * 競走成績・番組表アーカイブ配布元(mbrace.or.jp)へのアクセスを一本化するクライアント。
 * boatrace.jp向けのclient.tsとはホストが異なるため別インスタンス(別キュー)とするが、
 * スロットリング方針(1件ずつ直列・最低間隔・リトライなし)は同じ(httpClient.ts参照)。
 */

import { createThrottledClient } from "./httpClient";

const USER_AGENT =
  "boatrace-app-demo/0.1 (non-commercial demo; low-frequency fetch; contact via GitHub repo mashu1012/boatrace-app)";

const mbraceClient = createThrottledClient({
  baseUrl: "http://www1.mbrace.or.jp",
  userAgent: USER_AGENT,
  minIntervalMs: 3000,
});

/** 競走成績(Kファイル)・番組表(Bファイル)等のLZHアーカイブを取得する */
export function fetchMbraceBinary(pathAndQuery: string): Promise<Buffer> {
  return mbraceClient.fetchBinary(pathAndQuery);
}
