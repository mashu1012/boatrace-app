/**
 * 「1件ずつ・最低間隔を空けて直列実行する」スロットリング付きHTTPクライアントの
 * ファクトリ。boatrace.jp / mbrace.or.jp など複数ホストに対して、それぞれ独立した
 * キューで同時アクセスを防止するために使う(client.ts / mbraceClient.ts 参照)。
 *
 * 重要: 呼び出しが複数同時に発生しても、実際のHTTPリクエストは常に1件ずつ
 * 「前のリクエストが完了してから最低間隔を空けて次を送る」形で直列化される。
 * 待ち時間の予約だけを直列化して実際のfetch呼び出しは並行させる、という実装は
 * 複数コネクションが同時に張られてしまうため採用していない。
 * 失敗時の自動リトライも行わない(多重アクセスを避けるため)。
 */

export type ThrottledClient = {
  fetchText(pathOrUrl: string): Promise<string>;
  fetchBinary(pathOrUrl: string): Promise<Buffer>;
};

export function createThrottledClient(opts: {
  baseUrl: string;
  userAgent: string;
  minIntervalMs?: number;
  timeoutMs?: number;
}): ThrottledClient {
  const minIntervalMs = opts.minIntervalMs ?? 3000;
  const timeoutMs = opts.timeoutMs ?? 15000;

  let lastRequestFinishedAt = 0;
  // このPromiseチェーンより後段に積まれたリクエストは、前段が完了するまで開始しない。
  let chain: Promise<unknown> = Promise.resolve();

  async function rawFetch(pathOrUrl: string): Promise<ArrayBuffer> {
    const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${opts.baseUrl}${pathOrUrl}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": opts.userAgent,
          "Accept-Language": "ja",
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`fetch failed: ${res.status} ${url}`);
      }
      return await res.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
  }

  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const task = chain.then(async () => {
      const wait = Math.max(0, lastRequestFinishedAt + minIntervalMs - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        lastRequestFinishedAt = Date.now();
      }
    });
    // 失敗しても後続のリクエストがチェーンを続けられるよう、エラーは握りつぶしたコピーを繋ぐ
    chain = task.catch(() => undefined);
    return task;
  }

  return {
    fetchText(pathOrUrl: string) {
      return schedule(async () => {
        const buf = await rawFetch(pathOrUrl);
        return new TextDecoder("utf-8").decode(buf);
      });
    },
    fetchBinary(pathOrUrl: string) {
      return schedule(async () => {
        const buf = await rawFetch(pathOrUrl);
        return Buffer.from(buf);
      });
    },
  };
}
