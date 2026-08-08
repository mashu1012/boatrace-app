import * as cheerio from "cheerio";

/**
 * boatrace.jp「ダウンロード・他」ページから、レーサー期別成績のLZHファイルへの
 * リンク一覧を抽出する。実際のマークアップは未検証だが、公開実装(cstenmt/boatrace
 * の download_players.py)が `ul.data_list.h-mt15 a[href$=".lzh"]` を対象にしている
 * ことを踏まえた実装。
 */
export function parseDownloadLinks(html: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("ul.data_list a, .data_list a").each((_, a) => {
    const href = $(a).attr("href") ?? "";
    if (href.endsWith(".lzh")) links.add(href);
  });

  return Array.from(links);
}
