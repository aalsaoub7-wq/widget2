// ===== Extracted from app/page.tsx — exact code for the SELL YOUR CAR form =====
// I. Formatting helpers (used by the form summary)
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";           // ← behövs för <Image> i tumnaglarna
import { motion } from "framer-motion";   // ← används i form/overlay

const formatSE = new Intl.NumberFormat("sv-SE");
const fmt = (v: string | number) =>
  formatSE.format(Number(String(v ?? "").replace(/\D/g, "")));

/* --------------------------------
   Lead helper (front-end -> /api/leads)
--------------------------------- */
type LeadPayload = {
  type: "sell" | "cta";
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  car?: string;
  source?: string;
  hp?: string; // honeypot
};

async function postLead(payload: LeadPayload) {
  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || "Kunde inte skicka lead");
    }
    return { ok: true as const, id: data?.id ?? null };
  } catch (e: any) {
    console.error("postLead failed:", e);
    return { ok: false as const, error: e?.message || String(e) };
  }
}

/* --------------------------------
   IMAGE-BASED SWEDISH PLATE
--------------------------------- */
const PLATE_PNG = "https://i.imgur.com/l19Mke1.png";
const PLATE_JPG = "https://i.imgur.com/l19Mke1.jpg";

function PlateImg({ className = "" }: { className?: string }) {
  const [src, setSrc] = useState(PLATE_PNG);
  return (
    <img
      src={src}
      alt="Registreringsskylt"
      onError={() => src !== PLATE_JPG && setSrc(PLATE_JPG)}
      className={`plate-img ${className}`}
      decoding="async"
      loading="eager"
    />
  );
}

type SwedishPlateProps = {
  value: string;
  width?: number;
  ratio?: number;
  x?: number;
  rightPad?: number;
  y?: number;
  scale?: number;
  letterSpacingEm?: number;
  weight?: number;
  center?: boolean;
  showGlow?: boolean;
  showFrame?: boolean;
  backgroundUrl?: string;
  className?: string;
  style?: React.CSSProperties;
};

function SwedishPlate({
  value,
  width = 200,
  ratio = 4.727,
  x = 46,
  rightPad = 25,
  y = 11,
  scale = 0.7,
  letterSpacingEm = 0.02,
  weight = 800,
  center = true,
  showGlow = true,
  showFrame = false,
  backgroundUrl = "https://i.imgur.com/E5Cz0go.png",
  className = "",
  style,
}: SwedishPlateProps) {
  const height = Math.round(width / ratio);
  const raw = (value || "").toUpperCase().replace(/[\s-]/g, "");
  const text =
    /^[A-ZÅÄÖ]{3}\d{3}$/i.test(raw) ? `${raw.slice(0,3)} ${raw.slice(3)}` :
    /^[A-ZÅÄÖ]{3}\d{2}[A-ZÅÄÖ]$/i.test(raw) ? `${raw.slice(0,3)} ${raw.slice(3)}` :
    raw.length > 3 ? `${raw.slice(0,3)} ${raw.slice(3)}` : raw;
  const fontSize = Math.round(height * scale);

  return (
    <div
      className={`relative select-none ${className}`}
      style={{
        width,
        height,
        maxWidth: "100%",
        filter: showGlow
          ? "drop-shadow(0 6px 22px rgba(255,255,255,.18)) drop-shadow(0 10px 38px rgba(255,0,0,.12))"
          : undefined,
        ...style,
      }}
      aria-label={`Registreringsskylt ${text}`}
      role="img"
    >
      <img
        src={backgroundUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-cover rounded-[14px] pointer-events-none"
        draggable={false}
      />
      {showFrame ? (
        <div className="absolute inset-0 rounded-[14px] border border-black/70 pointer-events-none" />
      ) : null}
      <div
        className="absolute font-black text-[#111] leading-none"
        style={{
          left: x,
          right: rightPad,                 // give it a right edge
          top: y,
          fontSize,
          letterSpacing: `${letterSpacingEm}em`,
          fontWeight: weight,
          whiteSpace: "nowrap",            // never wrap
          textAlign: center ? "center" : "left",
          textShadow:
            "0 0.6px 0 #111, 0.6px 0 0 #111, -0.6px 0 0 #111, 0 -0.6px 0 #111",
        }}
      >

        {text}
      </div>
    </div>
  );
}

/* --------------------------------
   Fancy Sell Form
--------------------------------- */
function SellCarForm() {
  // ——— AI logo + preloader ———
  const AI_LOGO_URL = "https://i.imgur.com/YzTHlkx.png";
  function preloadImage(src: string) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve(); // fail safe
      img.src = src;
    });
  }

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    reg: "",
    brand: "",
    model: "",
    year: "",
    mileage: "",
    fuel: "Bensin",
    gearbox: "Automat",
    owners: "1",
    condition: 75,
    servicebook: true,
    wintertires: true,
    twokeys: true,
    description: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  // === PATCH: validation helpers (no UI change) ===
  const YEAR_MIN = 1950;
  const YEAR_MAX = 2026;
  // Accept AAA123 or AAA12A (6 chars total)
  const PLATE_RE = /^(?=.{6}$)[A-ZÅÄÖ]{3}(?:\d{3}|\d{2}[A-ZÅÄÖ])$/i;

  const cleanPlate = (s: string) => (s || "").toUpperCase().replace(/[\s-]/g, "");
  const isValidPlate = (s: string) => PLATE_RE.test(cleanPlate(s));

  const isValidYear = (y: string) => {
    const n = Number(String(y).replace(/[^\d]/g, ""));
    return Number.isInteger(n) && n >= YEAR_MIN && n <= YEAR_MAX;
  };

  const isValidEmail = (s: string) =>
    !s || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

  const isValidPhone = (s: string) => {
    const d = String(s || "").replace(/[^\d]/g, "");
    if (/^0\d{8,10}$/.test(d)) return true;   // 07x..., 08..., 010...
    if (/^46\d{9,10}$/.test(d)) return true;  // 46xxxxxxxxx
    return false;
  };

  // === PATCH: error state + summary (text only) ===
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorSummary, setErrorSummary] = useState("");

  // --- Valuation mini-panel state ---
  const [valuationVisible, setValuationVisible] = useState(false);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState<string | null>(null);
  const [valuation, setValuation] = useState<{
    base: number;
    deduction: number;
    final: number;
  } | null>(null);

  const sek = (n: number) =>
    new Intl.NumberFormat("sv-SE").format(Math.round(n));

  // ——— valuation normalizer ———
  function pickNum(...candidates: any[]): number | undefined {
    for (const v of candidates) {
      if (v == null) continue;
      const n = Number(String(v).replace(/[^\d.-]/g, "")); // tar bort " kr", mellanslag, etc.
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  }
  
  /** Stöd flera svarstyper från /api/valuation eller actorn:
   *  { basePrice, deduction, finalPrice }
   *  { base, minus|deduction, final|price }
   *  { result: { ...ovanför... } }
   *  Om final saknas men base+deduction finns → final = base - deduction
   */
  function normalizeValuationPayload(raw: any) {
    const src = raw?.result ?? raw ?? {};
    const base = pickNum(src.basePrice, src.base, src.market);
    const deduction = pickNum(src.deduction, src.minus, src.delta);
    let final = pickNum(src.finalPrice, src.final, src.price);
  
    if (final == null && base != null && deduction != null) {
      final = base - deduction;
    }
    return { base, deduction, final };
  }

  // === AI overlay state ===
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState("");
  const [aiResult, setAiResult] = useState<null | {
    base?: number;
    deduction?: number;
    final?: number;
  }>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const aiTimerRef = React.useRef<number | null>(null);
  const aiStartRef = useRef(0);
  const aiRafRef = useRef<number | null>(null);

  const AI_DURATION_MS = 120_000;
  const R = 78;
  const C = 2 * Math.PI * R;

  const formatSek = (n: number | null | undefined) =>
    typeof n === "number" ? n.toLocaleString("sv-SE") : "–";

  useEffect(() => {
    if (!aiOpen || aiResult?.final) return;
    const id = setInterval(() => {
      const elapsed = Math.max(0, performance.now() - aiStartRef.current);
      const pct = Math.min(92, Math.round((elapsed / AI_DURATION_MS) * 92));
      setAiProgress(pct);
    }, 250);
    return () => clearInterval(id);
  }, [aiOpen, aiResult]);

  // === PATCH: call valuation only for valid plates ===
  async function fetchValuationByPlate(plateRaw: string) {
    const plate = cleanPlate(plateRaw);
    if (!isValidPlate(plate)) return;
  
    setValuationLoading(true);
    setValuationError(null);
    try {
      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.ok === false) throw new Error(data?.error || "Valuation failed");
  
      const v = normalizeValuationPayload(data);
  
      if (v.final != null) {
        setValuation({
          base: v.base ?? 0,
          deduction: v.deduction ?? 0,
          final: v.final,
        });
        setValuationVisible(true);
      } else {
        setValuation(null);
        setValuationVisible(false);
      }
    } catch (e: any) {
      setValuation(null);
      setValuationVisible(false);
      setValuationError(e?.message || "Tekniskt fel");
    } finally {
      setValuationLoading(false);
    }
  }

  // generic onChange + clear field error
  const onChange =
    (k: keyof typeof form) =>
    (
      e:
        | React.ChangeEvent<HTMLInputElement>
        | React.ChangeEvent<HTMLTextAreaElement>
        | React.ChangeEvent<HTMLSelectElement>
    ) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
      setErrors((prev) => {
        if (!prev[k as string]) return prev;
        const next = { ...prev };
        delete next[k as string];
        return next;
      });
    };
  const onToggle = (k: "servicebook" | "wintertires" | "twokeys") => () =>
    setForm((f) => ({ ...f, [k]: !f[k] }));

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const mapped = Array.from(files)
      .slice(0, 8 - photos.length)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (mapped.length) setPhotos((p) => [...p, ...mapped]);
  };
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onFiles(e.dataTransfer.files);
  };
  const removePhoto = (i: number) => {
    const ph = photos[i];
    if (ph) URL.revokeObjectURL(ph.url);
    setPhotos((p) => p.filter((_, idx) => idx !== i));
  };

  const totalRequired = 10;
  const filled =
    (form.reg ? 1 : 0) +
    (form.brand ? 1 : 0) +
    (form.model ? 1 : 0) +
    (form.year ? 1 : 0) +
    (form.mileage ? 1 : 0) +
    (form.fuel ? 1 : 0) +
    (form.gearbox ? 1 : 0) +
    (form.owners ? 1 : 0) +
    (form.contactName ? 1 : 0) +
    (form.contactEmail || form.contactPhone ? 1 : 0);
  const pct = Math.min(1, filled / totalRequired);

  // === PATCH: validation-by-step + focus first invalid ===
  const mileageDigits = String(form.mileage || "").replace(/[^\d]/g, "");
  const mileageOk =
    mileageDigits.length > 0 &&
    Number(mileageDigits) >= 0 &&
    Number(mileageDigits) <= 1500000;

  function validateCurrentStep(s: 0 | 1 | 2) {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!isValidPlate(form.reg)) errs.reg = "Ogiltigt registreringsnummer (ABC123 eller ABC12A).";
      if (form.brand.trim().length < 2) errs.brand = "Märke saknas eller för kort.";
      if (!form.model.trim()) errs.model = "Modell saknas.";
      if (!isValidYear(form.year)) errs.year = `Årsmodell måste vara ${YEAR_MIN}–${YEAR_MAX}.`;
      if (!mileageOk) errs.mileage = "Miltal ogiltigt.";
    } else if (s === 2) {
      if (form.contactName.trim().length < 2) errs.contactName = "Ange ditt namn.";
      if (!isValidPhone(form.contactPhone)) errs.contactPhone = "Ogiltigt telefonnummer.";
      if (!isValidEmail(form.contactEmail)) errs.contactEmail = "Ogiltig e-post.";
    }
    return errs;
  }

  function focusFirstError(errs: Record<string, string>) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const el =
      document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${firstKey}"] input, [data-field="${firstKey}"] textarea`
      );
    if (el) el.focus();
  }

  // We still compute canNext for progress ring etc, but buttons won't be disabled by it
  const canNext =
    step === 0
      ? isValidPlate(form.reg) &&
        form.brand.trim().length >= 2 &&
        form.model.trim().length >= 1 &&
        isValidYear(form.year) &&
        mileageOk
      : step === 1
      ? true
      : form.contactName.trim().length >= 2 &&
        isValidPhone(form.contactPhone) &&
        isValidEmail(form.contactEmail);

  // === PATCH: Next shows errors, does not advance when invalid ===
  const next = () => {
    const errs = validateCurrentStep(step);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setErrorSummary(Object.values(errs).join(" • "));
      focusFirstError(errs);
      return;
    }
    setErrors({});
    setErrorSummary("");
    setStep((s) => Math.min(2, (s + 1) as 0 | 1 | 2));
  };

  const prev = () => setStep((s) => Math.max(0, (s - 1) as 0 | 1 | 2));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateCurrentStep(2);
    if (Object.keys(errs).length) {
      setErrors(errs);
      setErrorSummary(Object.values(errs).join(" • "));
      focusFirstError(errs);
      return;
    }
    if (submitted || aiOpen) return;

    try {
      setSubmitted(true);

      aiStartRef.current = performance.now();
      setAiResult(null);
      setAiStatus("Initierar AI-värdering…");
      setAiProgress(0);

      Promise.all([
        preloadImage(AI_LOGO_URL),
        new Promise((r) => setTimeout(r, 500)),
      ]).then(() => setAiOpen(true));

      const plate = cleanPlate(form.reg);

      const res = await fetch("/api/valuation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plate }),
      });
      const data = await res.json().catch(() => ({} as any));
      
      // 202 = pending → låt overlayen fortsätta “beräknar…”
      if (res.status === 202 && data?.pending) {
        setAiStatus("Beräkningen tar lite längre tid…");
        // vänta tills du pollar/trycker igen – vi byter INTE vy till resultat ännu
      } else if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Kunde inte hämta värdering");
      } else {
        const v = normalizeValuationPayload(data);
        setAiStatus("Beräkning klar");
      
        if (v.final != null) {
          setAiResult({
            base: data.basePrice ?? undefined,
            deduction: data.deduction ?? undefined,
            // visa i första hand dealerOffer; fall back till finalPrice om det saknas
            final: (typeof data.dealerOffer === "number" ? data.dealerOffer : data.finalPrice) ?? undefined,
          });
          setAiProgress(100);
        } else {
          // Inget användbart tal i svaret – stanna kvar i progress-läge med tydlig status
          setAiResult(null);
          setAiStatus("Kunde inte läsa ut ett pris från svaret.");
        }
      }
      setAiProgress(100);

      // Skicka in ett lead-mail via /api/leads
      {
        const lines = [
          `Regnr: ${plateForPreview(form.reg)}`,
          `Märke/Modell: ${form.brand} ${form.model}`,
          `Årsmodell: ${form.year}`,
          `Miltal: ${String(form.mileage || "").replace(/[^\d]/g, "")} km`,
          `Bränsle: ${form.fuel}`,
          `Växellåda: ${form.gearbox}`,
          `Ägare: ${form.owners}`,
          `Skick: ${form.condition}/100`,
          form.servicebook ? "Servicebok: Ja" : "Servicebok: Nej",
          form.wintertires ? "Vinterdäck: Ja" : "Vinterdäck: Nej",
          form.twokeys ? "Två nycklar: Ja" : "Två nycklar: Nej",
          form.description ? `Beskrivning: ${form.description}` : "",
        ].filter(Boolean).join("\n");

        const leadRes = await postLead({
          type: "sell",
          name: form.contactName,
          email: form.contactEmail,
          phone: form.contactPhone,
          car: `${form.brand} ${form.model} ${form.year} (${plateForPreview(form.reg)})`,
          source: "sell-form",
          message: lines,
          hp: "", // lämna tom
        });

        if (!leadRes.ok) {
          console.error("Lead-sändning misslyckades:", leadRes.error);
        }
      }

    } catch (err: any) {
      setAiStatus(String(err?.message || err) || "Något gick fel");
      setAiResult(null);
    } finally {
      setSubmitted(false);
    }
  };

  const size = 84;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const dash = C * pct;

  // === PATCH: preview formatter so AAA12A renders "AAA 12A", AAA123 -> "AAA 123" ===
  function plateForPreview(raw: string) {
    const p = cleanPlate(raw);
    if (p.length !== 6) return p;
    if (/^[A-ZÅÄÖ]{3}\d{3}$/i.test(p)) return `${p.slice(0, 3)} ${p.slice(3)}`;
    if (/^[A-ZÅÄÖ]{3}\d{2}[A-ZÅÄÖ]$/i.test(p)) return `${p.slice(0, 3)} ${p.slice(3, 5)}${p.slice(5)}`;
    return p;
  }

  return (
    <form onSubmit={onSubmit} className="sellv2 relative">
      {/* Header */}
      <div className="sellv2-head">
        <div className="sellv2-steps">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              role="presentation"
              aria-current={step === i ? "step" : undefined}
              className={`sellv2-step ${step === i ? "is-active" : ""} ${i < step ? "is-done" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <span className="idx">{i + 1}</span>
              <span className="label">
                {i === 0
                  ? "Grunddata"
                  : i === 1
                  ? "Detaljer"
                  : "Kontakt & bilder"}
              </span>
            </span>
          ))}
        </div>

        {/* Progress ring */}
        <div className="sellv2-ring">
          {(() => {
            const r = (size - stroke) / 2;
            const circ = 2 * Math.PI * r;
            const p = Math.max(0, Math.min(1, pct));
            const dashOffset = p >= 0.999 ? 0.0001 : circ * (1 - p);

            return (
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                role="img"
                aria-label={`Formulär komplett till ${Math.round(p * 100)}%`}
              >
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke="rgba(255,255,255,.12)"
                  strokeWidth={stroke}
                  fill="none"
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke="url(#sellv2Grad)"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
                <defs>
                  <linearGradient id="sellv2Grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#ff3b3b" />
                  </linearGradient>
                </defs>
              </svg>
            );
          })()}
          <div className="sellv2-ring-num">{Math.round(pct * 100)}%</div>
        </div>
      </div>

      {/* Body */}
      <div className="sellv2-body">
        {/* Left */}
        <div className="sellv2-left">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <div className="sellv2-grid">
                <div data-field="reg">
                  <Field
                    label="Registreringsnummer"
                    value={form.reg}
                    title={errors.reg}
                    aria-invalid={!!errors.reg}
                    // sanitize (A–Z/0–9, max 6)
                    onChange={(e: any) =>
                       setForm((f) => ({
                         ...f,
                         reg: e.target.value
                           .toUpperCase()
                           .replace(/[^A-ZÅÄÖ0-9]/gi, "") // endast A–Ö & 0–9
                           .slice(0, 6),                   // max 6 tecken
                       }))
                    }
                    onBlur={() => fetchValuationByPlate(form.reg)}
                    placeholder="ABC123"
                  />
                </div>
                <div data-field="brand">
                  <Field
                    label="Märke"
                    value={form.brand}
                    title={errors.brand}
                    aria-invalid={!!errors.brand}
                    onChange={onChange("brand")}
                    placeholder="Volvo, BMW…"
                  />
                </div>
                <div data-field="model">
                  <Field
                    label="Modell"
                    value={form.model}
                    title={errors.model}
                    aria-invalid={!!errors.model}
                    onChange={onChange("model")}
                    placeholder="XC60, 320d…"
                  />
                </div>
                <div data-field="year">
                  <Field
                    label="Årsmodell"
                    value={form.year}
                    title={errors.year}
                    aria-invalid={!!errors.year}
                    onChange={(e: any) =>
                      setForm((f) => ({
                        ...f,
                        year: String(e.target.value).replace(/[^\d]/g, "").slice(0, 4),
                      }))
                    }
                    type="number"
                    placeholder="2021"
                  />
                </div>
                <div data-field="mileage">
                  <Field
                    label="Antal Kilometer"
                    value={form.mileage}
                    title={errors.mileage}
                    aria-invalid={!!errors.mileage}
                    onChange={(e: any) =>
                      setForm((f) => ({
                        ...f,
                        mileage: String(e.target.value).replace(/[^\d]/g, ""),
                      }))
                    }
                    type="number"
                    placeholder="47200"
                  />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="sellv2-grid">
                <Select
                  label="Bränsle"
                  value={form.fuel}
                  onChange={onChange("fuel")}
                  options={["Bensin", "Diesel", "Hybrid", "El", "Gas"]}
                />
                <Select
                  label="Växellåda"
                  value={form.gearbox}
                  onChange={onChange("gearbox")}
                  options={["Automat", "Manuell"]}
                />
                <Select
                  label="Antal ägare"
                  value={form.owners}
                  onChange={onChange("owners")}
                  options={["1", "2", "3", "4+"]}
                />
                <div className="field">
                  <label className="floating">Skick (0–100)</label>
                  <input
                    className="input range"
                    type="range"
                    min={0}
                    max={100}
                    value={form.condition}
                    onChange={onChange("condition" as any)}
                  />
                  <div className="helper">
                    Uppskattning: <b>{form.condition}</b>/100
                  </div>
                </div>
                <div className="chips col-span-2">
                  <button
                    type="button"
                    onClick={onToggle("servicebook")}
                    className={`chip ${form.servicebook ? "on" : ""}`}
                  >
                    Servicebok finns
                  </button>
                  <button
                    type="button"
                    onClick={onToggle("wintertires")}
                    className={`chip ${form.wintertires ? "on" : ""}`}
                  >
                    Vinterdäck
                  </button>
                  <button
                    type="button"
                    onClick={onToggle("twokeys")}
                    className={`chip ${form.twokeys ? "on" : ""}`}
                  >
                    Två nycklar
                  </button>
                </div>
                <div className="field col-span-2">
                  <label className="floating">Beskrivning</label>
                  <textarea
                    className="input"
                    rows={4}
                    placeholder="Extra utrustning, skador, servicehistorik …"
                    value={form.description}
                    onChange={onChange("description")}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="sellv2-grid">
                <div data-field="contactName">
                  <Field
                    label="Namn"
                    value={form.contactName}
                    title={errors.contactName}
                    aria-invalid={!!errors.contactName}
                    onChange={onChange("contactName")}
                    placeholder="För- och efternamn"
                  />
                </div>
                <div data-field="contactEmail">
                  <Field
                    label="E-post"
                    value={form.contactEmail}
                    title={errors.contactEmail}
                    aria-invalid={!!errors.contactEmail}
                    onChange={onChange("contactEmail")}
                    type="email"
                    placeholder="du@exempel.se"
                  />
                </div>
                <div data-field="contactPhone">
                  <Field
                    label="Telefon"
                    value={form.contactPhone}
                    title={errors.contactPhone}
                    aria-invalid={!!errors.contactPhone}
                    onChange={onChange("contactPhone")}
                    type="tel"
                    placeholder="070-123 45 67"
                    required
                  />
                </div>

                {/* Photos */}
                <div className="col-span-2">
                  <p className="text-xs text-slate-300/80 mb-2 italic">
                    Vi behandlar all din data med respekt🔒Vi använder dina uppgifter för ärendehantering och återkoppling vid behov (berättigat intresse). Läs vår{" "}
                    <a href="/integritetspolicy" className="underline hover:no-underline not-italic">
                      Integritetspolicy
                    </a>.
                  </p>
                  <div
                    className="dropzone-v2"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                  >
                    <p>Dra & släpp bilder här</p>
                    <label className="btn-upload">
                      <input
                        className="hidden"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => onFiles(e.target.files)}
                      />
                      Välj filer
                    </label>
                    <span className="hint">Upp till 8 bilder. JPG/PNG.</span>
                  </div>

                  {photos.length > 0 && (
                    <div className="thumbs">
                      {photos.map((p, i) => (
                        <div className="thumb" key={i}>
                          <Image
                            src={p.url}
                            alt={`photo-${i}`}
                            width={1200}
                            height={800}
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 768px) 100vw, 50vw"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            aria-label="Ta bort"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* === PATCH: plain error text (no styling change) === */}
          {errorSummary && (
            <div className="mt-2 text-red-300 text-sm">{errorSummary}</div>
          )}

          {/* Nav buttons */}
          <div
            className="sellv2-actions"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: ".8rem",
              marginTop: "1rem",
            }}
          >
            {step > 0 ? (
              <button type="button" onClick={prev} className="btn ghost">
                Tillbaka
              </button>
            ) : (
              <span />
            )}
            {step < 2 ? (
              // === PATCH: allow click always; validation blocks advance & shows errors
              <button type="button" onClick={next} className="btn primary">
                Nästa
              </button>
            ) : (
              <button
                id="sell-submit"
                type="submit"
                // === PATCH: remove canNext from disabled so user can click and see errors
                disabled={submitted || aiOpen}
                className="btn primary"
              >
                {aiOpen && !aiResult
                  ? "Beräknar värde…"
                  : submitted
                  ? "Skickar…"
                  : "Få budet nu!"}
              </button>
            )}
          </div>
        </div>

        {/* Right: summary */}
        <div className="sellv2-right">
          <div className="summary relative">
            <div
              style={{
                position: "relative",
                left: -23,
                top: 0,
                width: "max-content",
              }}
            >
              {/* === PATCH: preview uses proper spacing for AAA123 & AAA12A === */}
              <SwedishPlate
                value={plateForPreview(form.reg || "ABC123")}
                width={280}
                className="mb-2"
              />
            </div>

            <div className="title">
              {[form.brand, form.model].filter(Boolean).join(" ") || "Din bil"}
            </div>
            <div className="sub">
              {[
                form.year || undefined,
                form.mileage &&
                  `${fmt(Math.round(Number(form.mileage) / 10))} mil`,
              ]
                .filter(Boolean)
                .join(" • ") || "Årsmodell • Miltal"}
            </div>

            <div className="badges">
              {form.fuel && <span>{form.fuel}</span>}
              {form.gearbox && <span>{form.gearbox}</span>}
              {form.servicebook && <span>Servicebok</span>}
              {form.wintertires && <span>Vinterdäck</span>}
              {form.twokeys && <span>Två nycklar</span>}
            </div>

            <div className="summary-bg" />

            {valuationVisible && (
              <div className="mt-3 p-3 rounded-[14px] border border-white/12 bg-white/5">
                <div className="font-semibold mb-1">Uppskattat värde</div>

                {valuationLoading && (
                  <div className="text-sm text-slate-300/85">Hämtar värde…</div>
                )}

                {valuationError && (
                  <div className="text-sm text-red-300/90">
                    Fel: {valuationError}
                  </div>
                )}

                {!valuationLoading &&
                  !valuationError &&
                  valuation?.final != null && (
                    <div className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300/80">Marknad</span>
                        <span className="font-medium">
                          {sek(valuation.base)} kr
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300/80">Avdrag</span>
                        <span className="font-medium">
                          −{sek(valuation.deduction)} kr
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/10">
                        <span className="text-slate-200 font-medium">
                          Preliminärt
                        </span>
                        <span className="text-lg font-semibold">
                          {sek(valuation.final)} kr
                        </span>
                      </div>
                    </div>
                  )}

                {!valuationLoading &&
                  !valuationError &&
                  valuation?.final == null && (
                    <div className="text-sm text-slate-300/85">
                      Inga värden kunde hittas för det angivna regnumret.
                    </div>
                  )}
              </div>
            )}

            <div className="note">
              {photos.length
                ? `${photos.length} bild(er) bifogade`
                : "Lägg gärna till några bilder för bättre bud"}
            </div>
          </div>
        </div>
      </div>

      {aiOpen && (
        <AIOverlay
          logoUrl={AI_LOGO_URL}
          progress={aiProgress}
          status={aiStatus}
          result={aiResult}
          onClose={() => {
            setAiOpen(false);
            setAiResult(null);
            setAiProgress(0);
            setAiStatus("");
          }}
        />
      )}
    </form>
  );
}

/* ------- small subcomponents used by SellCarForm ------- */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string | number;
  onChange: (e: any) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="field">
      <label className="floating">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (e: any) => void;
  options: string[];
}) {
  return (
    <div className="field">
      <label className="floating">{label}</label>
      <select className="input" value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function AIOverlay({
  logoUrl,
  progress,
  status,
  result,
  onClose,
}: {
  logoUrl: string;
  progress: number;
  status: string;
  result: null | { base?: number; deduction?: number; final?: number };
  onClose: () => void;
}) {
  const formatSek = (n?: number) =>
    typeof n === "number" ? `${n.toLocaleString("sv-SE")} kr` : "—";
  const hasFinal = typeof result?.final === "number";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 backdrop-blur-md"
    >
      <div className="relative w-[min(90vw,980px)] rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,22,29,.88),rgba(12,18,25,.88))] shadow-[0_30px_120px_rgba(0,0,0,.6)] p-6 sm:p-10">
        {/* Stäng-knapp */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/90 hover:bg-white/15"
        >
          Stäng
        </button>

        {/* Cirkel/huvudyta */}
        <div className="flex flex-col items-center gap-6 sm:gap-8 pt-6 sm:pt-2 pb-2">
          {/* Radial ring */}
          <div className="relative w-[220px] h-[220px]">
            {/* bakring */}
            <div className="absolute inset-0 rounded-full border-8 border-white/10" />
            {/* framring (progress) */}
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0"
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="rgba(255,255,255,.12)"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="url(#aiGrad)"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${(progress / 100) * 2 * Math.PI * 42} ${
                  2 * Math.PI * 42
                }`}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff6b6b" />
                  <stop offset="100%" stopColor="#ffd1d1" />
                </linearGradient>
              </defs>
            </svg>

            {/* inner cirkel + LOGGAN (större) */}
            <div className="absolute inset-[28px] rounded-full bg-black/30 backdrop-blur-sm grid place-items-center">
              <img
                src={logoUrl}
                alt=""
                className="w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-full shadow-[0_8px_28px_rgba(255,0,0,.25)]"
              />
            </div>

            {/* procenttext */}
            <div className="absolute -bottom-6 left-0 right-0 text-center text-white/80">
              {Math.min(100, Math.max(0, Math.round(progress)))}%
            </div>
          </div>

          {/* Rubriken – visa bara innan resultatet är klart */}
          {!hasFinal && (
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-semibold text-white">
                <span className="bg-[linear-gradient(90deg,#ff6b6b,#ff9f43,#ffd166,#34d399,#60a5fa,#a78bfa,#ff6b6b)] bg-[length:200%_100%] bg-clip-text text-transparent animate-[sheen_3s_linear_infinite]">
                  Lorbit AI
                </span>{" "}
                beräknar fram ett bud
              </div>
              <div className="mt-2 text-white/70">{status}</div>
            </div>
          )}

          {/* Liten progressbar i botten */}
          {!hasFinal && (
            <div className="w-full mt-2">
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-200"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          )}

          {/* RESULTAT */}
          {hasFinal && (
            <div className="mt-6 w-full max-w-[680px] rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
              <div className="text-white text-xl sm:text-2xl font-semibold">
                Vi är beredda att köpa din bil för{" "}
                <span className="text-white">{formatSek(result?.final)}</span>
              </div>
              <div className="mt-3 text-white/80">
                Vi kontaktar dig inom 24 timmar.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sheen-animation */}
      <style jsx global>{`
        @keyframes sheen {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 200% 0%;
          }
        }
      `}</style>
    </motion.div>
  );
}

// ===== CSS used by the form (as-is, extracted from the page's <style> block) =====
/* ===== Sell form (Symmetry) core ===== */
.sellv2{
  position: relative; /* <-- LÄGG TILL DENNA */
  border: 1px solid rgba(255,255,255,0.14);
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
  backdrop-filter: blur(14px) saturate(130%);
  border-radius: 22px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.35);
  overflow: hidden;  /* viktigt för att klippa overlayn i samma rundning */
}
.sellv2-head{
  display:flex; align-items:center; justify-content:space-between; gap:1rem;
  padding: 1rem 1.1rem .95rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  position:relative; overflow:hidden;
}
.sellv2-steps{ display:flex; gap:.6rem; flex-wrap:wrap; align-items:center; }
.sellv2-step{
  display:flex; align-items:center; gap:.6rem; padding:.5rem .7rem;
  border-radius: 12px; border:1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.05); color:#fff; font-size:.82rem;
  transition: all .2s ease;
}
.sellv2-step .idx{
  display:inline-grid; place-items:center; width:1.4rem; height:1.4rem; border-radius:999px;
  background: rgba(255,255,255,.14); font-size:.75rem; font-weight:600;
}
.sellv2-step.is-active{
  border-color: rgba(255,60,60,.45);
  box-shadow: 0 0 0 3px rgba(255,60,60,.15) inset;
}
.sellv2-step.is-done .idx{ background:#ff3b3b; color:#0b0b0b; }

.sellv2-ring{ position:relative; width:84px; height:84px; }
.sellv2-ring-num{ position:absolute; inset:0; display:grid; place-items:center; font-size:.85rem; font-weight:600; }

.sellv2-body{ display:grid; grid-template-columns: 1fr 1fr; gap:1rem; padding: 1rem 1rem 1.1rem; }
@media (max-width: 1024px){ .sellv2-body{ grid-template-columns: 1fr; } }
.sellv2-left{ min-width: 0; }
.sellv2-right{ min-width: 0; display:flex; }
.summary{ flex:1; }

.sellv2-grid{ display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:.8rem; }
.sellv2-grid .col-span-2{ grid-column: span 2 / span 2; }
@media (max-width: 640px){
  .sellv2-grid{ grid-template-columns: 1fr; }
  .sellv2-grid .col-span-2{ grid-column:auto; }
}

.field{
  position:relative; border-radius: 16px; padding: 1.1rem 1rem 1rem; min-height: 76px;
  background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.035));
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 10px 28px rgba(0,0,0,.25);
  transition: border-color .2s ease, box-shadow .2s ease, background .2s ease, transform .2s ease;
}
.field::before{
  content:""; position:absolute; inset:0; border-radius:16px; padding:1px;
  background: linear-gradient(120deg, rgba(255,255,255,.55), rgba(255,255,255,.08), rgba(255,255,255,.45)) border-box;
  background-size: 180% 180%; background-position: 0% 50%;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  pointer-events:none; opacity:.55; transition: background-position .6s ease, opacity .2s ease;
}
.field:hover::before{ background-position: 100% 50%; opacity:.75; }
.field::after{
  content:""; position:absolute; inset:-1px; border-radius:16px;
  pointer-events:none; background: radial-gradient(240px 160px at 50% 20%, rgba(255,255,255,.18), transparent 60%);
  opacity:0; transition: opacity .18s ease;
}
.field:focus-within{
  border-color: rgba(255,255,255,0.38);
  background: linear-gradient(180deg, rgba(255,255,255,0.085), rgba(255,255,255,0.04));
  box-shadow: 0 0 0 8px rgba(255,60,60,0.14), 0 18px 50px rgba(0,0,0,.35), 0 1px 0 rgba(255,255,255,.08) inset;
  transform: translateY(-1px);
}
.field:focus-within::after{ opacity:1; }

.floating{ position:absolute; left:1rem; top:.55rem; font-size:.72rem; font-weight:600; letter-spacing:.02em; color: rgba(255,255,255,.78); }
.input{ width:100%; background: transparent; outline: none; color: #fff; font-size: .98rem; margin-top: .55rem; line-height: 1.4; }
.input::placeholder{ color: rgba(255,255,255,.55); }
.input.range{ padding:0; margin-top:.8rem; }

.helper{ font-size:.72rem; color: rgba(255,255,255,.65); margin-top:.35rem; }

.dropzone-v2{ display:grid; place-items:center; border:1px dashed rgba(255,255,255,.25); background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03)); border-radius: 16px; padding: 1.25rem; text-align:center; }
.dropzone-v2 .btn-upload{ display:inline-flex; align-items:center; gap:.5rem; margin-top:.6rem; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); border-radius: 12px; padding:.45rem .75rem; cursor:pointer; font-size:.85rem; }
.dropzone-v2 .hint{ display:block; margin-top:.4rem; font-size:.72rem; color:rgba(255,255,255,.6); }

.chips{ display:flex; gap:.55rem; flex-wrap:wrap; align-items:center; }
.chip{ padding:.5rem .75rem; border-radius:999px; border:1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); font-size:.8rem; }
.chip.on{ border-color: rgba(255,60,60,.45); background: rgba(255,60,60,.18); }

.thumbs{ display:grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap:.6rem; margin-top:.75rem; }
@media (max-width: 640px){ .thumbs{ grid-template-columns: repeat(2,minmax(0,1fr)); } }
.thumb{ position:relative; border-radius: 12px; overflow:hidden; border:1px solid rgba(255,255,255,.12); transition: transform .18s ease, box-shadow .18s ease; }
.thumb:hover{ transform: translateY(-2px); box-shadow: 0 12px 30px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.12) inset; }
.thumb img{ width:100%; height:120px; object-fit:cover; display:block; }
.thumb button{ position:absolute; top:6px; right:6px; background: rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.25); border-radius: 8px; padding:.2rem .4rem; font-size:.7rem; }

.summary{
  position:relative; border:1px solid rgba(255,255,255,.14); border-radius:18px;
  background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
  padding: 1rem; overflow:hidden; min-height: 220px;
  box-shadow: 0 14px 44px rgba(0,0,0,.45);
}
.summary .title{ font-size:1.05rem; font-weight:600; }
.summary .sub{ font-size:.85rem; color:rgba(255,255,255,.7); margin-top:.1rem; }
.summary .badges{ display:flex; gap:.4rem; flex-wrap:wrap; margin-top:.6rem; }
.summary .badges span{ font-size:.72rem; padding:.25rem .45rem; border-radius:999px; border:1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.05); }
.summary .note{ margin-top: .8rem; font-size:.8rem; color: rgba(255,255,255,.75); }
.summary .summary-bg{
  position:absolute; inset:-1px; border-radius:18px; pointer-events:none;
  background:
    radial-gradient(600px 400px at 80% 0%, rgba(255,70,70,.18), transparent 60%),
    radial-gradient(500px 380px at -10% 100%, rgba(255,255,255,.10), transparent 50%);
  mix-blend-mode:screen; opacity:.9;
}

/* === Fancy buttons for SellCarForm === */
.btn{
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  padding: .7rem 1rem;
  border-radius: 14px;
  font-weight: 600;
  font-size: .92rem;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  border: 1px solid rgba(255,255,255,.14);
  background: rgba(255,255,255,.06);
  color: #fff;
  backdrop-filter: blur(10px) saturate(130%);
  transition: transform .18s ease, box-shadow .22s ease, background .2s ease, border-color .2s ease, opacity .2s ease;
  overflow: hidden;
}

.btn:hover{ transform: translateY(-1px); box-shadow: 0 12px 30px rgba(0,0,0,.35); }
.btn:active{ transform: translateY(0); }
.btn:disabled{ opacity:.55; pointer-events:none; }

.btn:focus-visible{
  outline: none;
  box-shadow: 0 0 0 8px rgba(255,60,60,.14), 0 0 0 1px rgba(255,255,255,.28) inset;
  border-color: rgba(255,255,255,.38);
}

.btn::before{
  content:"";
  position:absolute; top:0; left:-150%; width:50%; height:100%;
  transform:skewX(-20deg);
  background: linear-gradient(120deg, transparent, rgba(255,255,255,.35), transparent);
}
.btn:hover::before{ animation: sweep .9s ease; }

.btn.primary{
  background: linear-gradient(180deg, #ffffff, #ececec);
  color:#0b0b0b;
  border-color: rgba(255,255,255,.7);
  text-shadow: 0 1px 0 rgba(255,255,255,.4);
}
.btn.primary:hover{
  background: linear-gradient(180deg, #ffffff, #f3f3f3);
}

.btn.ghost{
  background: rgba(255,255,255,.06);
  color:#fff;
  border-color: rgba(255,255,255,.16);
}
.btn.ghost:hover{
  background: rgba(255,255,255,.10);
  border-color: rgba(255,255,255,.24);
}

/* === Overrides: mindre runda + mörkare knappar === */
.btn{ border-radius: 10px; }
.btn.primary{
  background: linear-gradient(180deg, #2b313b, #1f252d);
  color:#fff;
  border-color: rgba(255,255,255,.12);
  text-shadow: none;
}
.btn.primary:hover{ background: linear-gradient(180deg, #323946, #232a33); }
.btn.ghost{ background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.12); }
.btn.ghost:hover{ background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.18); }
.btn:focus-visible{
  box-shadow: 0 0 0 8px rgba(255,60,60,.12), 0 0 0 1px rgba(255,255,255,.28) inset;
}
