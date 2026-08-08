import Link from "next/link";
import { listVenueDaysByDate } from "@/lib/repository";
import { todayJst, formatDateJp, addDays } from "@/lib/date";
import VenueCard from "@/components/VenueCard";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{8}$/.test(dateParam) ? dateParam : todayJst();
  const venues = listVenueDaysByDate(date);
  const hasAnyActive = venues.some((v) => v.active);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <Link
          href={`/?date=${addDays(date, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="前の日"
        >
          ‹
        </Link>
        <h1 className="text-base font-bold">{formatDateJp(date)}のレース</h1>
        <Link
          href={`/?date=${addDays(date, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label="翌日"
        >
          ›
        </Link>
      </header>

      {!hasAnyActive && (
        <div className="mb-4 rounded-lg border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          この日の開催データはまだ取得されていません。
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {venues.map((v) => (
          <VenueCard key={v.jcd} venue={v} date={date} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400">
        <span>モ:モーニング</span>
        <span>サ:サマータイム</span>
        <span>ナ:ナイター</span>
        <span>ミ:ミッドナイト</span>
      </div>
    </main>
  );
}
