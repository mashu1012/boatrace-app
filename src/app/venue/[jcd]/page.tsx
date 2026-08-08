import Link from "next/link";
import { notFound } from "next/navigation";
import { listRacesByDate } from "@/lib/repository";
import { todayJst, formatDateJp } from "@/lib/date";
import { venueName } from "@/lib/venues";

export const dynamic = "force-dynamic";

export default async function VenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ jcd: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { jcd } = await params;
  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{8}$/.test(dateParam) ? dateParam : todayJst();

  const races = listRacesByDate(date).filter((r) => r.jcd === jcd);
  if (races.length === 0) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <Link href={`/?date=${date}`} className="text-sm text-blue-600 hover:underline">
        ← 場一覧に戻る
      </Link>

      <header className="mt-3 mb-5">
        <h1 className="text-xl font-bold">{venueName(jcd)}</h1>
        <p className="mt-1 text-sm text-gray-500">{formatDateJp(date)}</p>
      </header>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {races
          .sort((a, b) => a.rno - b.rno)
          .map((r) => (
            <Link
              key={r.id}
              href={`/race/${r.id}`}
              className="flex flex-col items-center rounded-lg border border-gray-200 px-2 py-2 text-center hover:border-blue-400 hover:bg-blue-50"
            >
              <span className="text-sm font-semibold">{r.rno}R</span>
              <span className="text-[10px] text-gray-400">{r.deadline ?? "--:--"}</span>
              {r.hasExhibition && (
                <span className="mt-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] text-blue-600">
                  展示
                </span>
              )}
            </Link>
          ))}
      </div>
    </main>
  );
}
