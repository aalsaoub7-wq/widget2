// app/api/valuation/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const APIFY_BUILD = process.env.APIFY_BUILD || 'latest';
const APIFY_MEMORY_MB = process.env.APIFY_MEMORY_MB || '4096';
const APIFY_TIMEOUT_SEC = process.env.APIFY_TIMEOUT_SEC || '180';
const APIFY_PROXY_GROUP = process.env.APIFY_PROXY_GROUP || 'BUYPROXIES94952';
const UNDERCUT_MIN = Number(process.env.VALUATION_UNDERCUT_MIN ?? 0.30);
const UNDERCUT_MAX = Number(process.env.VALUATION_UNDERCUT_MAX ?? 0.40);

// Hårdkodad valuator-actor
const ACTOR_SLUG = 'lurid_zouave~salj-bil-valuator';

/* ---------------- helpers ---------------- */

function buildRunsUrl(extra?: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams({ token: APIFY_TOKEN });
  if (APIFY_BUILD) qs.set('build', APIFY_BUILD);
  if (APIFY_MEMORY_MB) qs.set('memory', String(APIFY_MEMORY_MB));
  if (APIFY_TIMEOUT_SEC) qs.set('timeout', String(APIFY_TIMEOUT_SEC));
  // Vänta synkront på att run:en blir klar (sekunder)
  const wait = Math.min(300, Number(APIFY_TIMEOUT_SEC) || 120);
  qs.set('waitForFinish', String(wait));
  if (extra) for (const [k, v] of Object.entries(extra)) if (v != null) qs.set(k, String(v));
  return `https://api.apify.com/v2/acts/${encodeURIComponent(ACTOR_SLUG)}/runs?${qs.toString()}`;
}

async function startActor(input: any) {
  const url = buildRunsUrl();
  const headers = { accept: 'application/json', 'content-type': 'application/json' } as const;

  // Försök 1: klassisk wrapper { input: ... }
  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ input }) });
  let text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch {}

  // Om actorn vill ha rå body, försök 2
  const needsRaw = /input\./i.test(json?.error?.message || '');
  if (!res.ok && needsRaw) {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(input) });
    text = await res.text();
    json = null; try { json = JSON.parse(text); } catch {}
  }
  return { res, text, json };
}

// robust nummerplockare
function asNum(x: any): number | undefined {
  if (x == null) return;
  const n = Number(String(x).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}
function pickNum(...xs: any[]) { for (const x of xs) { const n = asNum(x); if (n != null) return n; } }
function deepFind(obj: any, keyRe: RegExp): number | undefined {
  const stack = [obj];
  while (stack.length) {
    const it = stack.pop();
    if (it && typeof it === 'object') {
      for (const [k, v] of Object.entries(it)) {
        if (keyRe.test(k)) { const n = asNum(v); if (n != null) return n; }
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }
}

function extractValuation(items: any[]) {
  const it = Array.isArray(items) && items.length ? items[0] : {};

  // Bas/marknad – behåll original + alias
  const base =
    pickNum(
      it.basePrice,
      it.base,
      it.market,
      it.marketPrice,
      it?.valuation?.base,
      it?.valuation?.market,
      it.listPrice,
      it.valuationAmount
    ) ?? deepFind(it, /\b(base|market|list|valuation)\b/i);

  // Avdrag
  const deduction =
    pickNum(it.deduction, it.minus, it.delta, it?.valuation?.deduction) ??
    deepFind(it, /\b(deduction|minus|avdrag|delta)\b/i);

  // Final – inkluderar privateAmount
  let final =
    pickNum(
      it.finalPrice,
      it.final,
      it.offer,
      it.price,
      it.privateAmount,
      it.finalAmount,
      it.amount,
      it?.valuation?.final,
      it?.valuation?.price
    ) ?? deepFind(it, /\b(privateAmount|final|price|offer|bud|slut|prelim|amount)\b/i);

  if (final == null && base != null && deduction != null) final = base - deduction;

  return { basePrice: base, deduction, finalPrice: final };
}

// stabil random 0..1
function stableRand(seed: string) {
  let h = 2166136261 >>> 0;              // FNV-1a
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h % 10000) / 10000;            // 0..1
}

function clampPct(n: number) {
  return Math.max(0, Math.min(0.95, Number.isFinite(n) ? n : 0));
}

/* ---------------- POST /api/valuation ---------------- */

export async function POST(req: Request) {
  try {
    if (!APIFY_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Missing APIFY_TOKEN' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    const plate = String(body?.plate || '').toUpperCase().replace(/[\s-]/g, '');

    // Snäll validering av svensk skylt (ABC123 eller ABC12A)
    if (!/^[A-ZÅÄÖ]{3}(?:\d{3}|\d{2}[A-ZÅÄÖ])$/.test(plate)) {
      return NextResponse.json({ ok: false, error: 'Ogiltigt registreringsnummer' }, { status: 400 });
    }

    // Input exakt enligt din spec
    const input = {
      apifyProxyGroups: [APIFY_PROXY_GROUP],
      carInfoProxyGroups: [APIFY_PROXY_GROUP],
      carInfoReuseBlocketIp: false,
      carInfoUseRotatingProxy: true,
      plate,
      useApifyProxy: true,
    };

    // Starta actorn och vänta (waitForFinish)
    const run = await startActor(input);
    const runId = run.json?.data?.id || run.json?.data?.idShort;
    const status = run.json?.data?.status || 'UNKNOWN';

    if (!run.res.ok) {
      // Om den inte är klar än, returnera 202 så kan klienten fortsätta visa "beräknar…"
      if (status === 'RUNNING' || status === 'READY') {
        return NextResponse.json({ ok: true, pending: true, runId, status }, { status: 202 });
      }
      return NextResponse.json(
        { ok: false, error: 'Apify start failed', details: run.text?.slice(0, 400) },
        { status: 502 }
      );
    }

    // Om tiden tog slut men run:en fortsätter
    if (status !== 'SUCCEEDED') {
      return NextResponse.json({ ok: true, pending: true, runId, status }, { status: 202 });
    }

    // Hämta dataset-items från körningen
    const itemsUrl =
      `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}/dataset/items` +
      `?token=${encodeURIComponent(APIFY_TOKEN)}&format=json`;
    const itemsRes = await fetch(itemsUrl, { headers: { accept: 'application/json' } });
    const itemsText = await itemsRes.text();
    let items: any[] = [];
    try { items = JSON.parse(itemsText); } catch {}

    if (!itemsRes.ok) {
      return NextResponse.json(
        { ok: false, error: 'dataset-items failed', statusCode: itemsRes.status, body: itemsText.slice(0, 400) },
        { status: 502 }
      );
    }

    const { basePrice, deduction, finalPrice } = extractValuation(items);

    // gör spannet robust oavsett ordning i env
    const lo = Math.min(clampPct(UNDERCUT_MIN), clampPct(UNDERCUT_MAX));
    const hi = Math.max(clampPct(UNDERCUT_MIN), clampPct(UNDERCUT_MAX));
    const seed = String(plate || runId || "");
    const t = stableRand(seed);
    const pct = lo + (hi - lo) * t;

    // räkna ut handlar-budet från "privatpris"
    const dealerOffer =
      typeof finalPrice === "number"
        ? Math.max(0, Math.round((finalPrice * (1 - pct)) / 500) * 500)
        : null;

    return NextResponse.json({
      ok: true,
      runId,
      basePrice: basePrice ?? null,
      deduction: deduction ?? null,
      finalPrice: finalPrice ?? null,
      dealerOffer,
      offerPct: pct,
      offerMin: lo,
      offerMax: hi,
      rawItem: items?.[0] ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
