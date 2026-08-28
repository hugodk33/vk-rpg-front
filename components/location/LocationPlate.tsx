"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/* ============================================================
   The Survey Plate
   Presents the location as a surveyor's / field-map plate, so it
   reads as A PHYSICAL PLACE, not a form:
   - a site crest (floorplan) whose line switches between
     INDOOR (door + roof) and OUTDOOR (horizon + marker);
   - an ATMOSPHERIC FIELD (dawn sky x stone/room);
   - a survey coordinate ledger (region, size, address) + a
     conditions track ("other").
   ============================================================ */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("exhibit-reveal-ready");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("exhibit-reveal-in")),
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Panel({ children }: { children: React.ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className="exhibit-reveal">{children}</div>;
}

interface Loc {
  name?: string;
  region?: string;
  sub_region?: string;
  address?: string;
  is_indoor?: number | boolean;
  country?: string;
  area?: string;
  dimensions?: string;
  description?: string;
  other?: string;
  table_id?: string;
  table_title?: string;
}

const INDOOR = {
  hex: "#f59e0b",
  sky: ["#241d17", "#17130f"],
  line: "#fbbf24",
  label: "Interior",
};
const OUTDOOR = {
  hex: "#38bdf8",
  sky: ["#0c1220", "#1e293b"],
  line: "#7dd3fc",
  label: "Exterior",
};

function SiteCrest({ indoor, hex, line }: { indoor: boolean; hex: string; line: string }) {
  return (
    <svg viewBox="0 0 96 96" className="w-[120px] h-[120px]">
      {/* survey crosshair backdrop */}
      {[20, 48, 76].map((y) => (
        <line key={y} x1="8" x2="88" y1={y} y2={y} stroke={line} strokeOpacity="0.12" strokeWidth="1" />
      ))}
      <line x1="48" x2="48" y1="6" y2="90" stroke={line} strokeOpacity="0.12" strokeWidth="1" />

      {indoor ? (
        /* INDOOR FLOORPLAN: door + roof + enclosure */
        <g fill="none" stroke={line} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M30 70 L30 44 L48 30 L66 44 L66 70 Z M30 44 L66 70" strokeOpacity="0.5" />
          <path d="M42 70 L42 56 L54 56 L54 70" strokeWidth="2.6" />
          <path d="M48 30 L42 24 M48 30 L54 24" strokeOpacity="0.7" />
          <path d="M60 52 L68 52 M60 58 L66 58" strokeOpacity="0.5" />
        </g>
      ) : (
        /* OUTDOOR FLOORPLAN: horizon + marker + contour lines */
        <g fill="none" stroke={line} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 58 L84 58" />
          <path d="M12 58 C 26 78, 40 82, 48 70 C 56 58, 70 62, 84 46" strokeOpacity="0.45" />
          <path d="M20 46 C 30 40, 40 44, 48 40" strokeOpacity="0.4" />
          <path d="M60 24 L66 24 L66 30 M60 24 L60 30 M66 24 L60 30" strokeOpacity="0.7" />
        </g>
      )}

      {/* bearing dot */}
      <circle cx={indoor ? 30 : 66} cy={indoor ? 50 : 30} r="2.6" fill={hex} />
    </svg>
  );
}

function SurveyRow({ label, value, emphasize, hex }: { label: string; value?: string; emphasize?: boolean; hex: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-700/40 last:border-0 py-2">
      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{label}</span>
      <span
        className="font-mono text-right"
        style={{
          color: emphasize ? hex : "#e4e4e7",
          fontSize: emphasize ? "20px" : "14px",
          fontWeight: emphasize ? 700 : 500,
        }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export default function LocationPlate({ location, tableId }: { location: Loc; tableId?: string }) {
  const indoor = !!location.is_indoor;
  const env = indoor ? INDOOR : OUTDOOR;
  const accent = env.hex;

  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden">
        {/* top strip */}
        <div className="exhibit-reveal flex items-center justify-between px-6 pt-6 lg:px-8">
          {tableId ? (
            <Link
              href={`/table/${tableId}/locations`}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 hover:text-amber-400 transition-colors"
            >
              <span aria-hidden>←</span> Back to locations
            </Link>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            {location.table_title ? <span className="hidden sm:inline">{location.table_title}</span> : null}
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span>Survey</span>
          </div>
        </div>

        {/* -------- ATMOSPHERIC FIELD (signature) -------- */}
        <div
          className="exhibit-reveal relative mx-6 lg:mx-8 mt-6 rounded-lg overflow-hidden border border-zinc-700/40"
          style={{ background: `linear-gradient(180deg, ${env.sky[0]}, ${env.sky[1]})` }}
        >
          <div className="absolute inset-x-0 top-0 h-full pointer-events-none" aria-hidden>
            {!indoor ? (
              <>
                <div className="absolute inset-x-0 bottom-0 h-24 opacity-60" style={{ background: "linear-gradient(180deg, transparent, rgba(2,6,23,.9))" }} />
                <div className="absolute left-6 right-6 bottom-10 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }} />
                <div className="absolute right-10 top-8 w-1.5 h-1.5 rounded-full" style={{ background: "#fde68a", boxShadow: "0 0 8px #fde68a88" }} />
              </>
            ) : (
              <>
                <div className="absolute inset-x-0 bottom-0 h-16 opacity-50" style={{ background: "linear-gradient(180deg, transparent, rgba(15,12,8,.85))" }} />
                <div className="absolute left-8 bottom-8 w-10 h-1" style={{ background: "#f59e0b44", filter: "blur(4px)" }} />
              </>
            )}
          </div>
          <div className="relative flex items-end justify-between p-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 border bg-black/30"
                style={{ borderColor: `${accent}55` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
                <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: accent }}>{env.label}</span>
              </div>
              <div className="mt-3">
                <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400 block">Field conditions</span>
                <span className="text-[15px] text-zinc-200">{indoor ? "Fire lit · warm shadow" : "Open sky · at the mercy of the weather"}</span>
              </div>
            </div>
            <SiteCrest indoor={indoor} hex={accent} line={accent} />
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-8 px-6 py-8 lg:px-8">
          {/* -------- NAME + FIELD ACCOUNT -------- */}
          <div className="min-w-0 flex flex-col gap-5">
            <Panel>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h1 className="text-[clamp(26px,5vw,40px)] leading-none font-bold tracking-tight text-amber-100">
                    {location.name || "Unmapped location"}
                  </h1>
                  {location.region ? (
                    <span className="mt-2 block font-mono text-[11px] tracking-widest uppercase text-zinc-500">
                      {location.region}
                      {location.sub_region ? ` / ${location.sub_region}` : ""}
                    </span>
                  ) : null}
                </div>
                {location.country ? (
                  <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 border border-zinc-700/50 rounded px-2 py-1">
                    {location.country}
                  </span>
                ) : null}
              </div>
            </Panel>

            {location.description ? (
              <Panel>
                <SectionTitle icon="✎" tint={accent} label="Field account" />
                <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 p-4">
                  <p className="text-[15px] leading-relaxed text-zinc-300 italic">{location.description}</p>
                  <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                    Reconnaissance record
                  </div>
                </div>
              </Panel>
            ) : null}

            {location.other ? (
              <Panel>
                <SectionTitle icon="◐" tint={accent} label="Notes" />
                <p className="text-[15px] leading-relaxed text-zinc-400">{location.other}</p>
              </Panel>
            ) : null}
          </div>

          {/* -------- SURVEY COORDINATES -------- */}
          <div className="min-w-0">
            <div className="sticky lg:top-28">
              <Panel>
                <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 px-4 py-2.5">
                  <div className="flex items-center gap-2 border-b border-zinc-700/50 pb-2.5 mb-1">
                    <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: accent }}>Coordinates</span>
                    <span aria-hidden className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}44, transparent)` }} />
                  </div>
                  <div className="pt-1">
                    <SurveyRow label="Region" value={location.region} hex={accent} />
                    <SurveyRow label="Sub-region" value={location.sub_region} hex={accent} />
                    <SurveyRow label="Area" value={location.area} hex={accent} />
                    <SurveyRow label="Dimensions" value={location.dimensions} emphasize hex={accent} />
                    {location.address ? <SurveyRow label="Address" value={location.address} hex={accent} /> : null}
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, tint, label }: { icon: string; tint: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 pb-1.5 border-b border-zinc-700/60">
      <span aria-hidden className="font-mono text-base leading-none" style={{ color: tint }}>{icon}</span>
      <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">{label}</span>
      <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${tint}55, transparent)` }} />
    </div>
  );
}
