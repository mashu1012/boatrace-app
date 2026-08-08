/**
 * LZH(LHA)アーカイブの解凍ユーティリティ。
 *
 * Node.jsには実用的なLZH(LHA形式)展開ライブラリが存在しないため、
 * 外部コマンド `lhasa` (Debian/Ubuntu: `apt-get install lhasa`) を child_process 経由で
 * 呼び出す方式を採用している(ユーザー承認済み)。デプロイ環境には `lhasa` のインストールが
 * 前提条件となる。
 *
 * 動作確認: このサンドボックス内で `apt-get install lhasa` を行い、`lha a`(jlha-utils)で
 * 作成したテスト用アーカイブを `lhasa x` で解凍するラウンドトリップは確認済み。
 * ただし公式サイト配布の実際のLZHファイルそのものでの検証はネットワーク制限により未実施。
 */

import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import iconv from "iconv-lite";

const LHASA_BIN = process.env.LHASA_BIN ?? "lhasa";

function runLhasaExtract(archivePath: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // lhasaのオプションはダッシュを挟まず連結する(例: xfw=<dir>)。f=強制上書き, w=展開先指定。
    const child = spawn(LHASA_BIN, [`xfw=${outDir}`, archivePath]);
    let stderr = "";
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      reject(new Error(`lhasaコマンドの起動に失敗しました(未インストールの可能性): ${err.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`lhasa exited with code ${code}: ${stderr}`));
    });
  });
}

export type ExtractedFile = {
  name: string;
  buffer: Buffer;
};

/** LZHアーカイブ(バイナリ)を解凍し、中身のファイル一覧を返す */
export async function extractLzh(archiveBuffer: Buffer): Promise<ExtractedFile[]> {
  const workDir = await mkdtemp(path.join(tmpdir(), "boatrace-lzh-"));
  const archivePath = path.join(workDir, "archive.lzh");
  const outDir = path.join(workDir, "out");
  try {
    await writeFile(archivePath, archiveBuffer);
    await mkdir(outDir, { recursive: true });
    await runLhasaExtract(archivePath, outDir);

    const names = await readdir(outDir);
    const files: ExtractedFile[] = [];
    for (const name of names) {
      const buffer = await readFile(path.join(outDir, name));
      files.push({ name, buffer });
    }
    return files;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

/**
 * 競艇の固定長データファイルは慣習的にShift-JIS(CP932)でエンコードされているため、
 * UTF-8ではなくこちらでデコードする。
 */
export function decodeShiftJis(buffer: Buffer): string {
  return iconv.decode(buffer, "Shift_JIS");
}
