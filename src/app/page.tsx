import Link from "next/link";
import { listRacesByDate } from "@/lib/repository";
import { todayJst, formatDateJp } from "@/lib/date";
import type { RaceSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

function groupByVenue(races: RaceSummary[]): Map<string, RaceSummary[]> {
  const map = new Map<string, RaceSummary[]>();
  for (const r of races) {
    const list = map.get(r.venueName) ?? [];
    list.push(r);
    map.set(r.venueName, list);
  }
  return map;
}

export default function Home() {
  const date = todayJst();
  const races = listRacesByDate(date);
  const venues = groupByVenue(races);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold">ボートレース展開予想</h1>
        <p className="mt-1 text-sm text-gray-500">{formatDateJp(date)} 開催レース一覧</p>
      </header>

      {venues.size === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          本日開催中のレースデータがまだありません。
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(venues.entries()).map(([venueName, venueRaces]) => (
            <section key={venueName} className="rounded-xl border border-gray-200 p-4">
              <h2 className="mb-3 font-semibold">{venueName}</h2>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {venueRaces
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
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
