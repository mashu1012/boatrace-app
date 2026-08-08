import { laneColor } from "@/lib/laneColors";
import type { DevelopmentPrediction, ExhibitionEntry } from "@/lib/types";

const WIDTH = 600;

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
  const height = 220;
  const laneY = (lane: number) => 24 + (lane - 1) * ((height - 48) / 5);
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

function MarkDevelopmentPanel({ prediction }: { prediction: DevelopmentPrediction }) {
  const height = 260;
  const cx = 470;
  const cy = 210;
  const rOuter = 190;

  // 予想順位を、内側(1着想定)から外側へ向かうターンマーク周りの弧に沿って配置する
  const points = prediction.markOrder.map((lane, idx) => {
    const angle = Math.PI * (0.98 - idx * 0.09); // 上→左へ回り込む弧
    const radius = rOuter - idx * 16;
    const x = cx + radius * Math.cos(angle);
    const y = cy - radius * Math.sin(angle) * 0.62;
    return { lane, x, y };
  });

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full">
      <path
        d={`M 40 ${cy} L ${cx - rOuter} ${cy} A ${rOuter} ${rOuter * 0.62} 0 0 1 ${cx} ${cy - rOuter * 0.62}`}
        fill="none"
        stroke="#bfdbfe"
        strokeWidth={26}
        strokeLinecap="round"
      />
      <circle cx={cx - rOuter} cy={cy} r={5} fill="#f59e0b" />
      <text x={cx - rOuter - 10} y={cy + 22} fontSize={11} fill="#9ca3af" textAnchor="middle">
        1マーク
      </text>
      {points.map((p, idx) => (
        <g key={p.lane}>
          <Boat lane={p.lane} x={p.x} y={p.y} r={13} />
          <text x={p.x} y={p.y - 20} fontSize={11} fill="#6b7280" textAnchor="middle">
            {idx + 1}
          </text>
        </g>
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
        <h3 className="mb-2 text-sm font-semibold text-gray-700">① スタートのライン予想</h3>
        <StartLinePanel exhibitions={exhibitions} />
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">② 進入コース予想</h3>
        <CourseEntryPanel exhibitions={exhibitions} />
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">③ 1マーク通過後の展開予想</h3>
        <MarkDevelopmentPanel prediction={prediction} />
      </section>
      <p className="text-xs text-gray-400">{prediction.note}</p>
    </div>
  );
}
