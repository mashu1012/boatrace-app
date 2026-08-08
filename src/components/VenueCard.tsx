import Link from "next/link";
import { getCurrentOrNextRaceId } from "@/lib/repository";
import type { VenueDayStatus } from "@/lib/types";

const PERIOD_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  モーニング: { bg: "#0d9488", text: "#ffffff", label: "モ" },
  デイ: { bg: "#9ca3af", text: "#ffffff", label: "デ" },
  サマータイム: { bg: "#ef4444", text: "#ffffff", label: "サ" },
  ナイター: { bg: "#4338ca", text: "#ffffff", label: "ナ" },
  ミッドナイト: { bg: "#111827", text: "#ffffff", label: "ミ" },
};

const GRADE_STYLE: Record<string, { bg: string; text: string }> = {
  SG: { bg: "#dc2626", text: "#ffffff" },
  G1: { bg: "#f59e0b", text: "#111827" },
  G2: { bg: "#6b7280", text: "#ffffff" },
  G3: { bg: "#92400e", text: "#ffffff" },
};

export default function VenueCard({ venue, date }: { venue: VenueDayStatus; date: string }) {
  // 開催中の場をタップしたら、場一覧を経由せず「現在開催中/次に締切を迎えるレース」の
  // 詳細画面に直接遷移する(まだレースが始まっていなければ1R)。レースデータが
  // 未取得の場合のみ、場別レース一覧ページにフォールバックする。
  const currentRaceId = venue.active ? getCurrentOrNextRaceId(date, venue.jcd) : null;
  const href = currentRaceId ? `/race/${currentRaceId}` : `/venue/${venue.jcd}?date=${date}`;

  const period = venue.periodBadge ? PERIOD_STYLE[venue.periodBadge] : null;
  const grade = venue.gradeBadge ? GRADE_STYLE[venue.gradeBadge] : null;

  const content = (
    <div
      className={`relative flex h-[76px] flex-col items-center justify-center rounded-lg border px-1 py-2 text-center ${
        venue.active
          ? "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50"
          : "border-gray-100 bg-gray-50"
      }`}
    >
      {grade && (
        <span
          className="absolute -top-2 -right-1 rounded px-1 text-[9px] font-bold"
          style={{ backgroundColor: grade.bg, color: grade.text }}
        >
          {venue.gradeBadge}
        </span>
      )}
      <span className={`flex items-center gap-1 text-sm font-semibold ${venue.active ? "text-gray-900" : "text-gray-400"}`}>
        {period && (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
            style={{ backgroundColor: period.bg, color: period.text }}
            title={venue.periodBadge ?? undefined}
          >
            {period.label}
          </span>
        )}
        {venue.venueName}
      </span>
      <span className={`mt-1 text-xs ${venue.active ? "text-gray-500" : "text-gray-300"}`}>
        {venue.active ? venue.eventDayLabel ?? "開催中" : "-"}
      </span>
    </div>
  );

  if (!venue.active) return content;

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
