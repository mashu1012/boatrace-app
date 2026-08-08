import { laneColor } from "@/lib/laneColors";
import type { DevelopmentPrediction, ExhibitionEntry } from "@/lib/types";

const WIDTH = 600;
const LINE_PANEL_HEIGHT = 220;
const laneY = (lane: number) => 24 + (lane - 1) * ((LINE_PANEL_HEIGHT - 48) / 5);

function Boat({
  x,
  y,
  lane,
  r = 14,
}: {
  x: number;
  y: number;
  lane: number;
  r?: number;
}) {
  const c = laneColor(lane);
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={r} fill={c.bg} stroke="rgba(0,0,0,0.25)" strokeWidth={1.5} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r}
        fontWeight={700}
        fill={c.text}
      >
        {lane}
      </text>
    </g>
  );
}

function StartLinePanel({ exhibitions }: { exhibitions: ExhibitionEntry[] }) {
  const height = LINE_PANEL_HEIGHT;
  const lineX = 520;

  const timingX = (timing: number | null) => {
    const t = timing ?? 0.15;
    const x = lineX - t * 800;
    return Math.min(570, Math.max(180, x));
  };

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full">
      <text x={16} y={16} fontSize={12} fill="#6b7280">
        遅い ←
      </text>
      <text x={lineX - 20} y={16} fontSize={12} fill="#6b7280">
        スタートライン
      </text>
      <line x1={lineX} y1={20} x2={lineX} y2={height - 10} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} />
      {[1, 2, 3, 4, 5, 6].map((lane) => (
        <line
          key={lane}
          x1={40}
          y1={laneY(lane)}
          x2={570}
          y2={laneY(lane)}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      ))}
      {exhibitions.map((e) => (
        <Boat key={e.lane} lane={e.lane} x={timingX(e.startTiming)} y={laneY(e.lane)} />
      ))}
      {exhibitions.map((e) => (
        <text
          key={`t-${e.lane}`}
          x={timingX(e.startTiming) - 26}
          y={laneY(e.lane) + 4}
          fontSize={10}
          fill="#9ca3af"
        >
          {e.startTiming === null ? "-" : e.startTiming.toFixed(2)}
        </text>
      ))}
    </svg>
  );
}

function CourseEntryPanel({ exhibitions }: { exhibitions: ExhibitionEntry[] }) {
  const height = 180;
  const topY = 40;
  const bottomY = 140;
  const colX = (course: number) => 60 + (course - 1) * ((WIDTH - 120) / 5);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full">
      <text x={8} y={20} fontSize={11} fill="#9ca3af">
        枠番(スタート前)
      </text>
      <text x={8} y={height - 6} fontSize={11} fill="#9ca3af">
        進入コース予想
      </text>
      {[1, 2, 3, 4, 5, 6].map((lane) => {
        const e = exhibitions.find((x) => x.lane === lane);
        const course = e?.startCourse ?? lane;
        return (
          <g key={lane}>
            <line
              x1={colX(lane)}
              y1={topY + 16}
              x2={colX(course)}
              y2={bottomY - 16}
              stroke="rgba(107,114,128,0.35)"
              strokeWidth={2}
            />
          </g>
        );
      })}
      {[1, 2, 3, 4, 5, 6].map((lane) => (
        <Boat key={`top-${lane}`} lane={lane} x={colX(lane)} y={topY} r={12} />
      ))}
      {[1, 2, 3, 4, 5, 6].map((lane) => {
        const e = exhibitions.find((x) => x.lane === lane);
        const course = e?.startCourse ?? lane;
        return <Boat key={`bottom-${lane}`} lane={lane} x={colX(course)} y={bottomY} />;
      })}
    </svg>
  );
}

/**
 * 「先頭艇が1マークに到達した瞬間」の各艇の位置関係を、①スタートのライン予想と
 * 同じレイアウト(艇番ごとの固定の行 + 基準線からの距離)で表示する。
 * 基準線(右端)= 先頭艇が1マークに到達した瞬間。左に離れているほど遅れている。
 */
function MarkLinePanel({ prediction }: { prediction: DevelopmentPrediction }) {
  const height = LINE_PANEL_HEIGHT;
  const lineX = 520;
  const GAP_SCALE = 70; // gapSeconds 1あたりのピクセル距離

  const gapX = (gap: number) => {
    const x = lineX - gap * GAP_SCALE;
    return Math.min(570, Math.max(110, x));
  };

  const rankByLane = new Map(prediction.markOrder.map((lane, idx) => [lane, idx + 1]));

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full">
      <text x={16} y={16} fontSize={12} fill="#6b7280">
        遅れ大 ←
      </text>
      <text x={lineX - 95} y={16} fontSize={11} fill="#6b7280">
        1マーク到達(先頭艇)
      </text>
      <line x1={lineX} y1={20} x2={lineX} y2={height - 10} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} />
      {[1, 2, 3, 4, 5, 6].map((lane) => (
        <line
          key={lane}
          x1={40}
          y1={laneY(lane)}
          x2={570}
          y2={laneY(lane)}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      ))}
      {prediction.markLine.map((m) => (
        <Boat key={m.lane} lane={m.lane} x={gapX(m.gapSeconds)} y={laneY(m.lane)} />
      ))}
      {prediction.markLine.map((m) => (
        <text
          key={`rank-${m.lane}`}
          x={gapX(m.gapSeconds)}
          y={laneY(m.lane) - 20}
          fontSize={10}
          fill="#6b7280"
          textAnchor="middle"
        >
          {rankByLane.get(m.lane)}位
        </text>
      ))}
      {prediction.markLine.map((m) => (
        <text
          key={`gap-${m.lane}`}
          x={gapX(m.gapSeconds) - 26}
          y={laneY(m.lane) + 4}
          fontSize={10}
          fill="#9ca3af"
        >
          {m.gapSeconds === 0 ? "先頭" : `+${m.gapSeconds.toFixed(2)}`}
        </text>
      ))}
    </svg>
  );
}

export default function RaceDevelopmentViz({
  exhibitions,
  prediction,
  hasExhibition,
}: {
  exhibitions: ExhibitionEntry[];
  prediction: DevelopmentPrediction | null;
  hasExhibition: boolean;
}) {
  if (!hasExhibition || !prediction) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
        展示データはレース締切のおよそ15分〜10分前に取得・表示されます。
        <br />
        しばらくしてから再度ご確認ください。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">② 進入コース予想</h3>
        <CourseEntryPanel exhibitions={exhibitions} />
      </section>
      {/* ①スタートのライン予想 と ③1マークのライン予想 は一連の「ライン予想」として
          横並び(PC)/縦並び(スマホ)で隣接表示する */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">① スタートのライン予想</h3>
          <StartLinePanel exhibitions={exhibitions} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            ③ 1マークのライン予想(展示タイム反映)
          </h3>
          <MarkLinePanel prediction={prediction} />
        </div>
      </section>
      <p className="text-xs text-gray-400">{prediction.note}</p>
    </div>
  );
}
