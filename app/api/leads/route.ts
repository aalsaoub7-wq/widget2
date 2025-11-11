// app/api/leads/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    // TODO: Lägg in mail, Slack, Notion etc här.
    console.log("LEAD:", body);
    // Returnera ett påhittat id
    return NextResponse.json({ ok: true, id: crypto.randomUUID() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lead-fel" }, { status: 500 });
  }
}
