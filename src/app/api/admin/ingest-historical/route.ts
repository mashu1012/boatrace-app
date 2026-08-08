import { NextRequest, NextResponse } from "next/server";
import { ingestRacerPeriodStats, ingestRaceResults } from "@/lib/historical/ingest";
import { addDays, todayJst } from "@/lib/date";

/**
 * 過去データ取り込みの手動トリガー(動作確認用)。
 * 本番運用では ADMIN_TOKEN を必ず設定すること(未設定の場合はこのエンドポイント自体を拒否する)。
 *
 * 使い方:
 *   POST /api/admin/ingest-historical?type=racers
 *   POST /api/admin/ingest-historical?type=results&date=YYYYMMDD (省略時は前日)
 * ヘッダ: Authorization: Bearer <ADMIN_TOKEN>
 */
export async function POST(req: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured; this endpoint is disabled" },
      { status: 503 }
    );
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${adminToken}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");

  try {
    if (type === "racers") {
      const result = await ingestRacerPeriodStats();
      return NextResponse.json({ type, ...result });
    }

    if (type === "results") {
      const date = req.nextUrl.searchParams.get("date") ?? addDays(todayJst(), -1);
      if (!/^\d{8}$/.test(date)) {
        return NextResponse.json({ error: "invalid date" }, { status: 400 });
      }
      const result = await ingestRaceResults(date);
      return NextResponse.json({ type, date, ...result });
    }

    return NextResponse.json({ error: "type must be 'racers' or 'results'" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
