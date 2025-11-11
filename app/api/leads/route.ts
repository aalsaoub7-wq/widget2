// app/api/leads/route.ts
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    console.log("LEAD:", body);
    return NextResponse.json({ ok: true, id: randomUUID() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lead-fel" }, { status: 500 });
  }
}
