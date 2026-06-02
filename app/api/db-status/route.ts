import { NextResponse } from "next/server";
import { getDBMode, getDB } from "@/lib/db";

export async function GET() {
  const mode = getDBMode();
  const adapter = getDB();
  const healthy = await adapter.test();
  return NextResponse.json({ mode, healthy });
}
