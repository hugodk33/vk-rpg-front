"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { absoluteHex } from "@/lib/location";
import { submitJson } from "@/components/forms/submit";

/* ============================================================
   The Survey Plate
   Presents the location as a surveyor's / field-map plate.
   A location is a DIVISION OF TERRITORY in a hex-scale chain:
   world → continent → … → site → battlemap (`ancestors`), and it
   may contain smaller divisions (`children`).
   - a site crest (floorplan) for INDOOR / EXTERIOR;
   - an atmospheric field;
   - a survey coordinate ledger (region, hex scale, footprint,
     axial q,r) + the territory chain (breadcrumb).
   ============================================================ */

interface LocHex {
  sizeM?: number | null;
  width?: number | null;
  height?: number | null;
  centerQ?: number;
  centerR?: number;
  orientation?: string;
  rotationDeg?: number;
}

interface Loc {
  id?: string;
  name?: string;
  tableId?: string;
  table_id?: string;
  table_title?: string;
  kind?: string;
  level?: number;
  path?: string;
  parentId?: string | null;
  region?: string;
  sub_region?: string;
  subRegion?: string;
  address?: string;
  is_indoor?: number | boolean;
  isIndoor?: boolean;
  country?: string;
  area?: string;
  dimensions?: string;
  description?: string;
  other?: string;
  hex?: LocHex;
  isBattlemap?: boolean;
  ancestors?: Loc[];
  children?: Loc[];
}

const KIND_LABELS: Record<string, string> = {
  world: "World",
  continent: "Continent",
  nation: "Nation",
  region: "Region",
  biome: "Biome",
  province: "Province",
  city: "City",
  district: "District",
  locale: "Locale",
  site: "Site",
  battlemap: "Battle Map",
  point: "Point",
};

function formatScale(m?: number | null): string {
  if (m == null) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km/hex`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m/hex`;
}

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

const INDOOR = {
  hex: "#f59e0b",
  sky: ["#241d17", "#17130f"],
  line: "#fbbf24",
  label: "Interior",
};
const EXTERIOR = {
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
        /* EXTERIOR FLOORPLAN: horizon + marker + contour lines */
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

function SurveyRow({ label, value, emphasize, hex }: { label: string; value?: string | number | null; emphasize?: boolean; hex: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-700/40 last:border-0 py-2">
      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{label}</span>
      <span
        className="font-mono text-right"
        style={{
          color: emphasize ? hex : "#e4e4e7",
          fontSize: emphasize ? "17px" : "13px",
          fontWeight: emphasize ? 700 : 500,
        }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function TerritoryCrumbs({ chain, accent }: { chain: Loc[]; accent: string }) {
  if (chain.length <= 1) return null;
  return (
    <nav aria-label="Territory chain" className="exhibit-reveal flex items-center flex-wrap gap-1.5">
      {chain.map((loc, i) => {
        const isSelf = i === chain.length - 1;
        const label = KIND_LABELS[loc.kind ?? "site"] ?? loc.kind ?? "Location";
        return (
          <span key={loc.id ?? i} className="flex items-center gap-1.5">
            {isSelf ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border bg-zinc-800/60"
                style={{ borderColor: `${accent}44` }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: accent }}>{label}</span>
              </span>
            ) : (
              <>
                <Link
                  href={`/location/${loc.id}`}
                  className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 hover:text-amber-400 transition-colors"
                >
                  {label}
                </Link>
                <span className="text-zinc-700" aria-hidden>›</span>
              </>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default function LocationPlate({ location, tableId }: { location: Loc; tableId?: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const indoor = location.isIndoor != null ? !!location.isIndoor : !!location.is_indoor;
  const env = indoor ? INDOOR : EXTERIOR;
  const accent = env.hex;
  const hex = location.hex;
  const kind = location.kind ?? "site";
  const kindLabel = KIND_LABELS[kind] ?? kind;
  const isBattlemap = !!location.isBattlemap || (hex?.sizeM != null && hex.sizeM <= 2);
  const chain = [...(location.ancestors ?? []), location];
  const children = location.children ?? [];
  const abs = absoluteHex(location);
  const baseTableId = tableId ?? location.tableId ?? location.table_id;

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

        {/* territory chain */}
        <div className="px-6 lg:px-8 mt-4">
          <div className="flex items-center justify-between gap-4">
            <TerritoryCrumbs chain={chain} accent={accent} />
            <div className="flex items-center gap-3 shrink-0">
              {location.id ? (
                <Link
                  href={`/location/${location.id}/edit`}
                  className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 hover:text-amber-400 transition-colors"
                >
                  Edit
                </Link>
              ) : null}
              {baseTableId && location.id ? (
                <Link
                  href={`/table/${baseTableId}/locations/new?parent_id=${location.id}`}
                  className="font-mono text-[10px] tracking-widest uppercase text-amber-500/80 hover:text-amber-400 transition-colors"
                >
                  ✦ Subdivision
                </Link>
              ) : null}
              {location.id ? (
                children.length > 0 ? (
                  <span
                    title="Esta divisão contém subdivisões — remova-as primeiro."
                    className="font-mono text-[10px] tracking-widest uppercase text-zinc-700 cursor-not-allowed"
                  >
                    ✕ Remover
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      if (!window.confirm(`Remover "${location.name}" do território?`)) return;
                      setDeleting(true);
                      setDeleteError(null);
                      try {
                        await submitJson(`/api/table-location/${location.id}`, "DELETE");
                        router.push(baseTableId ? `/table/${baseTableId}/locations` : "/narrator");
                        router.refresh();
                      } catch (err: unknown) {
                        setDeleteError(err instanceof Error ? err.message : "Falha ao remover.");
                        setDeleting(false);
                      }
                    }}
                    className="font-mono text-[10px] tracking-widest uppercase text-red-400/70 hover:text-red-400 disabled:opacity-50 transition-colors"
                  >
                    ✕ Remover
                  </button>
                )
              ) : null}
            </div>
          </div>
          {deleteError ? (
            <p className="mt-2 text-[11px] text-red-400/80">{deleteError}</p>
          ) : null}
        </div>

        {/* -------- ATMOSPHERIC FIELD (signature) -------- */}
        <div
          className="exhibit-reveal relative mx-6 lg:mx-8 mt-5 rounded-lg overflow-hidden border border-zinc-700/40"
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
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-500">
                      {kindLabel}
                    </span>
                    {location.region ? (
                      <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-600 hidden sm:inline">
                        · {location.region}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {location.country ? (
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 border border-zinc-700/50 rounded px-2 py-1">
                      {location.country}
                    </span>
                  ) : null}
                  {isBattlemap ? (
                    <span
                      className="font-mono text-[10px] tracking-widest uppercase rounded px-2 py-1 border"
                      style={{ color: accent, borderColor: `${accent}55`, background: `${accent}0d` }}
                    >
                      Battle map
                    </span>
                  ) : null}
                </div>
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

            {/* -------- CONTAINS (subdivisions) -------- */}
            {children.length > 0 ? (
              <Panel>
                <SectionTitle icon="▦" tint={accent} label="Contains" />
                <div className="space-y-2">
                  {children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/location/${child.id}`}
                      className="group flex items-center justify-between gap-3 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg px-4 py-2.5 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: `${accent}aa`, boxShadow: `0 0 6px ${accent}66` }} />
                        <div className="min-w-0">
                          <span className="block text-sm text-zinc-200 group-hover:text-zinc-100 truncate">{child.name || "Unnamed"}</span>
                          <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-600">
                            {KIND_LABELS[child.kind ?? "site"] ?? child.kind ?? "Location"}
                            {!child.hex?.sizeM ? "" : ` · ${formatScale(child.hex.sizeM)}`}
                          </span>
                        </div>
                      </div>
                      <span className="text-zinc-600 group-hover:text-amber-400 transition-colors" aria-hidden>→</span>
                    </Link>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>

          {/* -------- SURVEY COORDINATES -------- */}
          <div className="min-w-0">
            <div className="sticky lg:top-28">
              <Panel>
                <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 px-4 py-2.5">
                  <div className="flex items-center gap-2 border-b border-zinc-700/50 pb-2.5 mb-1">
                    <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: accent }}>Survey</span>
                    <span aria-hidden className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}44, transparent)` }} />
                  </div>
                    <div className="pt-1">
                      <SurveyRow label="Kind" value={kindLabel} hex={accent} />
                      <SurveyRow label="Scale" value={formatScale(hex?.sizeM)} emphasize hex={accent} />
                      <SurveyRow label="Footprint" value={hex?.width != null && hex?.height != null ? `${hex.width}×${hex.height} hex` : null} hex={accent} />
                      <SurveyRow label="Q / R" value={hex?.centerQ != null && hex?.centerR != null ? `${hex.centerQ}, ${hex.centerR}` : null} hex={accent} />
                      {chain.length > 1 ? (
                        <SurveyRow label="Abs Q/R" value={`${abs.q}, ${abs.r}`} hex={accent} />
                      ) : null}
                      <SurveyRow label="Grid" value={hex?.orientation ?? "flat"} hex={accent} />
                      <SurveyRow label="Region" value={location.region ?? location.subRegion} hex={accent} />
                      <SurveyRow label="Area" value={location.area} hex={accent} />
                      <SurveyRow label="Dimensions" value={location.dimensions} hex={accent} />
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