import { NextResponse } from "next/server";
import { getRaceDetail } from "@/lib/repository";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getRaceDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "race not found" }, { status: 404 });
  }
  return NextResponse.json(detail);
}
