import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaceDetail, listRacesByDate } from "@/lib/repository";
import { formatDateJp } from "@/lib/date";
import EntryTable from "@/components/EntryTable";
import RaceDevelopmentViz from "@/components/RaceDevelopmentViz";

export const dynamic = "force-dynamic";

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getRaceDetail(id);
  if (!detail) notFound();

  const { summary, entries, exhibitions, prediction } = detail;
  const siblings = listRacesByDate(summary.date).filter((r) => r.jcd === summary.jcd);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← 場・レース一覧に戻る
      </Link>

      <header className="mt-3 mb-4">
        <h1 className="text-xl font-bold">
          {summary.venueName} {summary.rno}R
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {formatDateJp(summary.date)} ・ {summary.raceTitle ?? ""} ・ 締切 {summary.deadline ?? "--:--"}
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-1.5">
        {siblings
          .sort((a, b) => a.rno - b.rno)
          .map((r) => (
            <Link
              key={r.id}
              href={`/race/${r.id}`}
              className={`rounded-full px-3 py-1 text-xs ${
                r.id === id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {r.rno}R
            </Link>
          ))}
      </nav>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">出走表</h2>
        <EntryTable entries={entries} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">展開予想</h2>
        <RaceDevelopmentViz
          exhibitions={exhibitions}
          prediction={prediction}
          hasExhibition={summary.hasExhibition}
        />
      </section>
    </main>
  );
}
