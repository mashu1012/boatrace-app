import * as cheerio from "cheerio";
import type { Entry, ExhibitionEntry, PeriodBadge, VenueDayStatus } from "@/lib/types";
import { VENUES } from "@/lib/venues";

/**
 * 注意: 本開発環境はネットワーク制限により対象サイトへ直接アクセスできない。
 * parseVenueDays はユーザー提供の実ページソースで検証済みだが、parseRaceIndex /
 * parseRaceCard / parseBeforeInfo は公式サイトの一般的なテーブル構造(セル順序ベース)を
 * 前提にした未検証の実装である。本番投入前に必ず実際のページで動作確認し、
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

/**
 * トップページ(当日の開催場一覧)から全24場の開催状況を抽出する。
 *
 * 実際のマークアップ(2026-08-08取得のページソースで確認済み):
 *   <ul class="schedule1_lists h-clear">
 *     <li class="schedule-button">
 *       <a href="..." class="schedule1_area is-G3b is-summer">平和島</a>
 *       <a href="/owpc/pc/race/raceindex?jcd=04&hd=20260808" class="schedule1_date ">最終日</a>
 *     </li>
 *     <li class="schedule-button">
 *       <a href="..." class="schedule1_area  ">桐生</a>
 *       <span class="schedule1_date">-</span>
 *     </li>
 *     ...
 *   </ul>
 * - 24場が固定順(01〜24)で並ぶため、リスト内の並び順(index+1)をjcdとして採用する
 *   (非開催の場は schedule1_date が <span>「-」</span> のみで jcd を含むリンクがないため)
 * - 開催中かどうかは schedule1_date が <a>(レースindexへのリンク)かどうかで判定する
 * - 時間帯・グレードは schedule1_area の class 修飾子(is-morning/is-summer/is-nighter/
 *   is-midnight, is-SGx/is-G1x/is-G2x/is-G3x)から判定する
 */
export function parseVenueDays(html: string): VenueDayStatus[] {
  const $ = cheerio.load(html);
  const results: VenueDayStatus[] = [];

  const items = $("ul.schedule1_lists li.schedule-button").toArray();

  items.forEach((li, idx) => {
    const $li = $(li as AnyNode);
    const jcd = String(idx + 1).padStart(2, "0");

    const areaEl = $li.find("a.schedule1_area").first();
    const venueNameText = areaEl.text().trim() || VENUES[idx]?.name || jcd;
    const areaClass = areaEl.attr("class") ?? "";

    const dateLink = $li.find("a.schedule1_date").first();
    const active = dateLink.length > 0;
    const eventDayLabel = active ? textOf(dateLink) : null;

    const gradeMatch = areaClass.match(/is-(SG|G1|G2|G3)[a-z]?/i);
    let periodBadge: PeriodBadge | null = null;
    if (/\bis-morning\b/.test(areaClass)) periodBadge = "モーニング";
    else if (/\bis-summer\b/.test(areaClass)) periodBadge = "サマータイム";
    else if (/\bis-nighter\b/.test(areaClass)) periodBadge = "ナイター";
    else if (/\bis-midnight\b/.test(areaClass)) periodBadge = "ミッドナイト";
    else if (active) periodBadge = "デイ";

    results.push({
      jcd,
      venueName: venueNameText,
      active,
      eventDayLabel,
      periodBadge,
      gradeBadge: gradeMatch ? gradeMatch[1].toUpperCase() : null,
    });
  });

  // ページ取得に失敗した場合などのフォールバック(全場非開催として返す)
  if (results.length === 0) {
    return VENUES.map((v) => ({
      jcd: v.jcd,
      venueName: v.name,
      active: false,
      eventDayLabel: null,
      periodBadge: null,
      gradeBadge: null,
    }));
  }

  return results;
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
