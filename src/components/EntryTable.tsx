import { laneColor } from "@/lib/laneColors";
import type { Entry } from "@/lib/types";

function fmt(n: number | null, suffix = ""): string {
  return n === null ? "-" : `${n.toFixed(2)}${suffix}`;
}

export default function EntryTable({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        出走表データがまだ取得されていません。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-2 py-2 text-left font-medium">艇</th>
            <th className="px-2 py-2 text-left font-medium">選手名</th>
            <th className="px-2 py-2 text-left font-medium">級別</th>
            <th className="px-2 py-2 text-right font-medium">モーター</th>
            <th className="px-2 py-2 text-right font-medium">ボート</th>
            <th className="px-2 py-2 text-right font-medium">全国3連対率</th>
            <th className="px-2 py-2 text-right font-medium">全国2連対率</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const c = laneColor(e.lane);
            return (
              <tr key={e.lane} className="border-t border-gray-100">
                <td className="px-2 py-2">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ring-1 ring-black/10"
                    style={{ backgroundColor: c.bg, color: c.text }}
                  >
                    {e.lane}
                  </span>
                </td>
                <td className="px-2 py-2 font-medium">{e.racerName}</td>
                <td className="px-2 py-2 text-gray-600">{e.racerClass ?? "-"}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {e.motorNumber ?? "-"}
                  <span className="ml-1 text-xs text-gray-400">{fmt(e.motorWin2Rate, "%")}</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{e.boatNumber ?? "-"}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(e.nationalWin3Rate, "%")}</td>
                <td className="px-2 py-2 text-right tabular-nums">{fmt(e.nationalWin2Rate, "%")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
