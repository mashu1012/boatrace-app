import * as cheerio from "cheerio";
import type { Entry, ExhibitionEntry } from "@/lib/types";

/**
 * 注意: このパーサーは公式サイトの一般的なテーブル構造(セル順序ベース)を前提に
 * 実装しているが、本開発環境はネットワーク制限により対象サイトへ直接アクセスできず、
 * 実HTMLに対する検証を行えていない。本番投入前に必ず実際のページで動作確認し、
 * 必要に応じてセレクタを調整すること(参照: README「データ取得について」)。
 */

function toNumber(text: string | undefined | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function textOf($el: cheerio.Cheerio<AnyNode>): string {
  return $el.text().replace(/\s+/g, " ").trim();
}

// cheerioの要素型はバージョンにより export 名が異なるため any で扱う
// (このプロジェクトでは型安全性よりパーサーの単純さを優先している)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

export type RaceListItem = {
  rno: number;
  raceTitle: string | null;
  deadline: string | null;
};

/** 当日の開催場一覧ページから、開催中の場コード(jcd)を抽出する */
export function parseActiveVenues(html: string): string[] {
  const $ = cheerio.load(html);
  const jcds = new Set<string>();
  $('a[href*="jcd="]').each((_, a) => {
    const href = $(a as AnyNode).attr("href") ?? "";
    const match = href.match(/jcd=(\d{2})/);
    if (match) jcds.add(match[1]);
  });
  return Array.from(jcds).sort();
}

/** 番組表(場・日単位の一覧)ページから当日のレース一覧を抽出する */
export function parseRaceIndex(html: string): RaceListItem[] {
  const $ = cheerio.load(html);
  const results: RaceListItem[] = [];

  $("table tr").each((_, tr) => {
    const $tr = $(tr);
    const raceLink = $tr.find('a[href*="rno="]').first();
    if (raceLink.length === 0) return;
    const href = raceLink.attr("href") ?? "";
    const rnoMatch = href.match(/rno=(\d+)/);
    if (!rnoMatch) return;
    const rno = Number(rnoMatch[1]);
    if (!rno || rno < 1 || rno > 12) return;
    if (results.some((r) => r.rno === rno)) return;

    const rowText = textOf($tr);
    const deadlineMatch = rowText.match(/(\d{1,2}:\d{2})/);
    results.push({
      rno,
      raceTitle: raceLink.text().trim() || null,
      deadline: deadlineMatch ? deadlineMatch[1] : null,
    });
  });

  return results.sort((a, b) => a.rno - b.rno);
}

/** 出走表(racelist)ページから6艇分の選手データを抽出する */
export function parseRaceCard(html: string): Entry[] {
  const $ = cheerio.load(html);
  const entries: Entry[] = [];

  const rows = $("table.is-w495 tbody tr, table.is-w495 > tbody > tr").toArray();

  rows.forEach((tr, idx) => {
    const $tr = $(tr as AnyNode);
    const tds = $tr.find("td").toArray();
    if (tds.length < 6) return;

    const lane = idx + 1;
    if (lane < 1 || lane > 6) return;

    const nameLink = $(tds[1] as AnyNode).find("a").first();
    const regClassText = textOf($(tds[1] as AnyNode));
    const racerName = nameLink.text().trim() || regClassText.split(" ")[0] || `${lane}号艇`;

    const racerNumberMatch = regClassText.match(/\b(\d{4})\b/);
    const classMatch = regClassText.match(/\b(A1|A2|B1|B2)\b/);

    const nationalText = tds[3] ? textOf($(tds[3] as AnyNode)) : "";
    const nationalNums = nationalText.match(/\d+\.\d+/g) ?? [];

    const localText = tds[4] ? textOf($(tds[4] as AnyNode)) : "";
    const localNums = localText.match(/\d+\.\d+/g) ?? [];

    const motorText = tds[5] ? textOf($(tds[5] as AnyNode)) : "";
    const motorNumMatch = motorText.match(/^(\d+)/);
    const motorNums = motorText.match(/\d+\.\d+/g) ?? [];

    const boatText = tds[6] ? textOf($(tds[6] as AnyNode)) : "";
    const boatNumMatch = boatText.match(/^(\d+)/);

    entries.push({
      lane,
      racerNumber: racerNumberMatch ? racerNumberMatch[1] : null,
      racerName,
      racerClass: classMatch ? classMatch[1] : null,
      motorNumber: motorNumMatch ? toNumber(motorNumMatch[1]) : null,
      boatNumber: boatNumMatch ? toNumber(boatNumMatch[1]) : null,
      motorWin2Rate: motorNums.length > 0 ? toNumber(motorNums[motorNums.length - 1]) : null,
      // 全国/当地の勝率セルは通常 [勝率, 2連率, 3連率] の順で並ぶ
      nationalWin3Rate: nationalNums.length >= 3 ? toNumber(nationalNums[2]) : null,
      nationalWin2Rate: nationalNums.length >= 2 ? toNumber(nationalNums[1]) : null,
      localWin3Rate: localNums.length >= 3 ? toNumber(localNums[2]) : null,
      localWin2Rate: localNums.length >= 2 ? toNumber(localNums[1]) : null,
    });
  });

  return entries;
}

/** 直前情報(beforeinfo)ページから展示タイム・進入コース・スタートタイミングを抽出する */
export function parseBeforeInfo(html: string): ExhibitionEntry[] {
  const $ = cheerio.load(html);
  const exhibitions = new Map<number, ExhibitionEntry>();

  for (let lane = 1; lane <= 6; lane++) {
    exhibitions.set(lane, {
      lane,
      exhibitionTime: null,
      tilt: null,
      startCourse: null,
      startTiming: null,
    });
  }

  // 展示タイム・チルト表(通常 table.is-w748 内、艇番順の行)
  const exTable = $("table.is-w748").first();
  exTable.find("tbody tr").each((idx, tr) => {
    const lane = idx + 1;
    if (lane < 1 || lane > 6) return;
    const rowText = textOf($(tr as AnyNode));
    const timeMatch = rowText.match(/\b(6\.\d{2}|7\.\d{2})\b/);
    const tiltMatch = rowText.match(/(-?\d\.\d)\s*(?:°|度)?/);
    const entry = exhibitions.get(lane);
    if (entry) {
      entry.exhibitionTime = timeMatch ? toNumber(timeMatch[1]) : null;
      entry.tilt = tiltMatch ? toNumber(tiltMatch[1]) : null;
    }
  });

  // スタート展示(進入コース・スタートタイミング)ブロック。
  // 公式サイトはコース枠ごとにブロックを描画し、枠に艇番とタイミングを表示する構造を持つ。
  $("[class*='boatImage']").each((_, el) => {
    const $el = $(el as AnyNode);
    const text = textOf($el);
    const laneMatch = text.match(/^(\d)/);
    if (!laneMatch) return;
    const lane = Number(laneMatch[1]);
    const entry = exhibitions.get(lane);
    if (!entry) return;

    const courseMatch = ($el.attr("class") ?? "").match(/is-course(\d)/);
    const timingMatch = text.match(/(F\.?\d{0,2}|\.\d{2})/);

    if (courseMatch) entry.startCourse = Number(courseMatch[1]);
    if (timingMatch) {
      const raw = timingMatch[1];
      entry.startTiming = raw.startsWith("F") ? -Math.abs(toNumber(raw) || 0.01) : toNumber(raw);
    }
  });

  return Array.from(exhibitions.values());
}
