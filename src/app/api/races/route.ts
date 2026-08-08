import { NextRequest, NextResponse } from "next/server";
import { listRacesByDate } from "@/lib/repository";
import { todayJst } from "@/lib/date";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") ?? todayJst();
  if (!/^\d{8}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const races = listRacesByDate(date);
  return NextResponse.json({ date, races });
}
