"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { absoluteHex } from "@/lib/location";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { DrawShape, HexTile } from "@/lib/types";
import { submitJson } from "@/components/forms/submit";
import LocationVisibility from "@/components/location/LocationVisibility";
import LocationModifiers from "@/components/location/LocationModifiers";
import LocationMap from "@/components/location/LocationMap";
import LocationShop from "@/components/location/LocationShop";
import { KIND_LABELS } from "@/lib/location-glyphs";

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
  floor?: number | null;
  floorName?: string | null;
  description?: string;
  other?: string;
  hex?: LocHex;
  isBattlemap?: boolean;
  shopName?: string | null;
  shop_name?: string;
  ancestors?: Loc[];
  children?: Loc[];
  tiles?: HexTile[];
  drawing?: DrawShape[];
  bgImageUrl?: string | null;
  bannerUrl?: string | null;
}

/* The plate's views: the Survey itself, the narrator-only records
   (Knowledge — who knows this place; Field conditions — what is true
   of this place), and two conditional tab kinds that only appear when
   the location justifies them: Map (a local tactical grid) and Shop
   (a named place of commerce, with its staff and stock). */
const PLATE_TABS = [
  { key: "survey", label: "lc.lp.tabSurvey" },
  { key: "knowledge", label: "lc.lp.tabKnowledge" },
  { key: "conditions", label: "lc.lp.tabConditions" },
  { key: "map", label: "lc.lmap.title" },
  { key: "shop", label: "lc.shop.title" },
] as const;

type PlateView = (typeof PLATE_TABS)[number]["key"];

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
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("exhibit-reveal-in");
      return;
    }
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const inInitialViewport = rect.bottom > 0 && rect.top < vh;
    if (inInitialViewport) {
      el.classList.add("exhibit-reveal-in");
      return;
    }
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
};
const EXTERIOR = {
  hex: "#38bdf8",
  sky: ["#0c1220", "#1e293b"],
  line: "#7dd3fc",
};
/* Narrator trail glows green (the GM palette used across the master
   flow); the player trail keeps the surveyor amber/sky chroma. */
const NARR_INDOOR = {
  hex: "#4ade80",
  sky: ["#131a10", "#0d120c"],
  line: "#86efac",
};
const NARR_EXTERIOR = {
  hex: "#4ade80",
  sky: ["#0b1511", "#101f18"],
  line: "#86efac",
};

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

function TerritoryCrumbs({ chain, accent, mode, hoverCls }: { chain: Loc[]; accent: string; mode: "narrator" | "player"; hoverCls: string }) {
  const { t } = useTranslation();
  if (chain.length <= 1) return null;
  const hrefOf = (id?: string) =>
    mode === "player" ? `/player/location/${id}` : `/location/${id}`;
  return (
    <nav aria-label={t("lc.lp.ariaChain")} className="exhibit-reveal flex items-center flex-wrap gap-1.5">
      {chain.map((loc, i) => {
        const isSelf = i === chain.length - 1;
        const label = KIND_LABELS[loc.kind ?? "site"] ?? loc.kind ?? t("lc.editor.localWord");
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
                  href={hrefOf(loc.id)}
                  className={`font-mono text-[10px] tracking-widest uppercase text-zinc-500 ${hoverCls} transition-colors`}
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

export default function LocationPlate({ location, tableId, mode = "narrator" }: { location: Loc; tableId?: string; mode?: "narrator" | "player" }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [view, setView] = useState<PlateView>("survey");
  const isPlayer = mode === "player";
  const indoor = location.isIndoor != null ? !!location.isIndoor : !!location.is_indoor;
  const env = isPlayer
    ? indoor ? INDOOR : EXTERIOR
    : indoor ? NARR_INDOOR : NARR_EXTERIOR;
  const accent = env.hex;
  const envLabel = indoor ? t("lc.lp.indoor") : t("lc.lp.exterior");
  const chromeHover = isPlayer ? "hover:text-amber-400" : "hover:text-green-400";
  const titleCls = isPlayer ? "text-amber-100" : "text-green-100";
  const hex = location.hex;
  const kind = location.kind ?? "site";
  const kindLabel = KIND_LABELS[kind] ?? kind;
  const isBattlemap = !!location.isBattlemap || (hex?.sizeM != null && hex.sizeM <= 2);
  /* Um local comum também pode ter mapa (fundo e/ou traços) além do
     battlemap — nesse caso a aba do mapa também aparece. */
  const showMap = isBattlemap || !!location.bgImageUrl || (location.drawing?.length ?? 0) > 0;
  const chain = [...(location.ancestors ?? []), location];
  const children = location.children ?? [];
  const abs = absoluteHex(location);
  const baseTableId = tableId ?? location.tableId ?? location.table_id;
  const isShop = !!(location.shopName ?? location.shop_name);
  const showSurvey = view === "survey";
  const tabs = PLATE_TABS.filter((tab) => {
    if (tab.key === "survey") return true;
    if (tab.key === "knowledge" || tab.key === "conditions") return !isPlayer;
    if (tab.key === "map") return showMap;
    if (tab.key === "shop") return isShop;
    return false;
  });
  const activeTabLabel = tabs.find((tab) => tab.key === view)?.label ?? "lc.lp.tabSurvey";
  const backHref = isPlayer
    ? `/player`
    : `/table/${baseTableId}/locations`;

  return (
    <div className="relative max-w-5xl mx-auto">
      <div>
        {/* top strip */}
        <div className="exhibit-reveal flex items-center justify-between px-6 pt-6 lg:px-8">
          {baseTableId ? (
            <Link
              href={backHref}
              className={`inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 ${chromeHover} transition-colors`}
            >
              <span aria-hidden>←</span> {t("lc.lp.backToLocations")}
            </Link>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            {location.table_title ? <span className="hidden sm:inline">{location.table_title}</span> : null}
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span>{t(activeTabLabel)}</span>
          </div>
        </div>

        {/* in-plate views */}
        {tabs.length > 1 ? (
          <div role="tablist" aria-label={t("lc.lp.ariaViews")} className="mt-4 flex items-center gap-1 border-b border-zinc-700/40 px-6 lg:px-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={view === tab.key}
                onClick={() => setView(tab.key)}
                className={`relative px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 rounded-md ${isPlayer ? "focus-visible:ring-amber-800/60" : "focus-visible:ring-green-800/60"} ${
                  view === tab.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t(tab.label)}
                {view === tab.key ? (
                  <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full" style={{ background: accent }} />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {showSurvey ? (
        <>
        {/* territory chain */}
        <div className="px-6 lg:px-8 mt-4">
          <div className="flex items-center justify-between gap-4">
            <TerritoryCrumbs chain={chain} accent={accent} mode={isPlayer ? "player" : "narrator"} hoverCls={chromeHover} />
            <div className="flex items-center gap-3 shrink-0">
              {location.id && !isPlayer ? (
                <Link
                  href={`/location/${location.id}/edit?tab=map`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-600/60 bg-green-600/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-green-300 transition-colors hover:bg-green-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
                >
                  <span aria-hidden>▧</span> {t("lc.lp.drawMap")}
                </Link>
              ) : null}
              {location.id ? (
                <Link
                  href={
                    isPlayer
                      ? `/player/location/${location.id}/organogram`
                      : `/location/${location.id}/organogram`
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-400/60 bg-slate-400/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-300 transition-colors hover:bg-slate-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60"
                >
                  <span aria-hidden>▣</span> {t("lc.org.structure")}
                </Link>
              ) : null}
              {location.id && !isPlayer ? (
                <Link
                  href={`/location/${location.id}/edit`}
                  className={`font-mono text-[10px] tracking-widest uppercase text-zinc-500 ${chromeHover} transition-colors`}
                >
                  {t("lc.common.edit")}
                </Link>
              ) : null}
              {baseTableId && location.id && !isPlayer ? (
                <Link
                  href={`/table/${baseTableId}/locations/new?parent_id=${location.id}`}
                  className={`font-mono text-[10px] tracking-widest uppercase ${isPlayer ? "text-amber-500/80 hover:text-amber-400" : "text-green-400/80 hover:text-green-300"} transition-colors`}
                >
                  {t("lc.lp.subdivision")}
                </Link>
              ) : null}
              {location.id && !isPlayer ? (
                children.length > 0 ? (
                  <span
                    title={t("lc.lp.hasSubdivisions")}
                    className="font-mono text-[10px] tracking-widest uppercase text-zinc-700 cursor-not-allowed"
                  >
                    {t("lc.lp.remove")}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={async () => {
                      if (!window.confirm(interpolate(t("lc.lp.confirmRemove"), { name: location.name ?? "" }))) return;
                      setDeleting(true);
                      setDeleteError(null);
                      try {
                        await submitJson(`/api/table-location/${location.id}`, "DELETE");
                        router.push(baseTableId ? `/table/${baseTableId}/locations` : "/narrator");
                        router.refresh();
                      } catch (err: unknown) {
                        setDeleteError(err instanceof Error ? err.message : t("lc.lp.errRemove"));
                        setDeleting(false);
                      }
                    }}
                    className="font-mono text-[10px] tracking-widest uppercase text-red-400/70 hover:text-red-400 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-default"
                  >
                    {t("lc.lp.remove")}
                  </button>
                )
              ) : null}
            </div>
          </div>
          {deleteError ? (
            <p className="mt-2 text-[11px] text-red-400/80">{deleteError}</p>
          ) : null}
        </div>

        {/* -------- ATMOSPHERIC FIELD / BANNER (signature) -------- */}
        <div className="exhibit-reveal mx-6 lg:mx-8 mt-5">
          <div
            className="relative aspect-[16/6] min-h-[170px] overflow-hidden rounded-lg border border-zinc-700/40"
            style={{ background: `linear-gradient(180deg, ${env.sky[0]}, ${env.sky[1]})` }}
          >
            {location.bannerUrl ? (
              <img src={location.bannerUrl} alt={location.name ?? ""} className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
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
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 border bg-black/30"
              style={{ borderColor: `${accent}55` }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
              <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: accent }}>{envLabel}</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400 block">{t("lc.lp.conditions")}</span>
              <span className="text-[15px] text-zinc-200">{indoor ? t("lc.lp.conditionIndoor") : t("lc.lp.conditionOutdoor")}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 py-8 lg:px-8">
          {/* -------- NAME + FIELD ACCOUNT -------- */}
          <div className="min-w-0 flex flex-col gap-5">
            <Panel>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h1 className={`text-[clamp(26px,5vw,40px)] leading-none font-bold tracking-tight ${titleCls}`}>
                    {location.name || t("lc.lp.unmappedName")}
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
                      {t("lc.lp.battlemap")}
                    </span>
                  ) : null}
                </div>
              </div>
            </Panel>

            {location.description ? (
              <Panel>
                <SectionTitle icon="✎" tint={accent} label={t("lc.lp.fieldReport")} />
                <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 p-4">
                  <p className="text-[15px] leading-relaxed text-zinc-300 italic">{location.description}</p>
                  <div className="mt-3 flex items-center gap-2 font-mono text-[10px] text-zinc-600 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                    {t("lc.lp.reconLog")}
                  </div>
                </div>
              </Panel>
            ) : null}

            {location.other ? (
              <Panel>
                <SectionTitle icon="◐" tint={accent} label={t("lc.lp.notes")} />
                <p className="text-[15px] leading-relaxed text-zinc-400">{location.other}</p>
              </Panel>
            ) : null}
          </div>

          {/* -------- SURVEY COORDINATES -------- */}
          <div className="min-w-0">
            <Panel>
              <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 px-4 py-2.5">
                <div className="flex items-center gap-2 border-b border-zinc-700/50 pb-2.5 mb-1">
                  <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: accent }}>{t("lc.lp.tabSurvey")}</span>
                  <span aria-hidden className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}44, transparent)` }} />
                </div>
                    <div className="pt-1">
                  <SurveyRow label={t("lc.lp.kind")} value={kindLabel} hex={accent} />
                  <SurveyRow label={t("lc.common.scale")} value={formatScale(hex?.sizeM)} emphasize hex={accent} />
                  <SurveyRow label={t("lc.common.area")} value={hex?.width != null && hex?.height != null ? `${hex.width}×${hex.height} hex` : null} hex={accent} />
                  <SurveyRow label={t("lc.lp.qr")} value={hex?.centerQ != null && hex?.centerR != null ? `${hex.centerQ}, ${hex.centerR}` : null} hex={accent} />
                  {location.floor != null ? (
                    <SurveyRow label={t("lc.lp.floor")} value={location.floorName ?? (location.floor === 0 ? t("lc.floor.ground") : interpolate(t(location.floor > 0 ? "lc.floor.above" : "lc.floor.below"), { n: Math.abs(location.floor) }))} hex={accent} />
                  ) : null}
                  {chain.length > 1 ? (
                    <SurveyRow label={t("lc.lp.qrAbs")} value={`${abs.q}, ${abs.r}`} hex={accent} />
                  ) : null}
                  <SurveyRow label={t("lc.common.grid")} value={hex?.orientation ?? "flat"} hex={accent} />
                  <SurveyRow label={t("lc.lp.region")} value={location.region ?? location.subRegion} hex={accent} />
                  <SurveyRow label={t("lc.lp.size")} value={location.area} hex={accent} />
                  <SurveyRow label={t("lc.lp.dimensions")} value={location.dimensions} hex={accent} />
                  {location.address ? <SurveyRow label={t("lc.lp.address")} value={location.address} hex={accent} /> : null}
                </div>
              </div>
            </Panel>
          </div>
        </div>
        </>
        ) : null}

        {view === "knowledge" && !isPlayer && location.id ? (
          <div className="px-6 py-8 lg:px-8" role="tabpanel">
            <LocationVisibility locationId={location.id} tableId={baseTableId} />
          </div>
        ) : null}

        {view === "conditions" && !isPlayer && location.id ? (
          <div className="px-6 py-8 lg:px-8" role="tabpanel">
            <LocationModifiers locationId={location.id} tableId={baseTableId} />
          </div>
        ) : null}

        {view === "map" && showMap ? (
          <div className="px-6 py-8 lg:px-8" role="tabpanel">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-200">{t("lc.lp.tacticalPlate")}</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 mt-0.5">
                  {location.tiles?.length || 0} {(location.tiles?.length || 0) === 1 ? t("lc.lp.cellsOne") : t("lc.lp.cellsMany")} · {location.drawing?.length || 0} {(location.drawing?.length || 0) === 1 ? t("lc.lp.strokesOne") : t("lc.lp.strokesMany")}
                </p>
              </div>
              {!isPlayer && location.id ? (
                <Link
                  href={`/location/${location.id}/edit?tab=map`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-600/60 bg-green-600/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-green-300 transition-colors hover:bg-green-600/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600/60"
                >
                  {t("lc.lp.editMap")}
                </Link>
              ) : null}
            </div>
            <LocationMap hex={hex} abs={abs} accent={accent} tiles={location.tiles} drawing={location.drawing} bgImageUrl={location.bgImageUrl} />
          </div>
        ) : null}

        {view === "shop" && isShop && location.id ? (
          <div className="px-6 py-8 lg:px-8" role="tabpanel">
            <LocationShop
              locationId={location.id}
              tableId={baseTableId}
              shopName={location.shopName ?? location.shop_name}
              accent={accent}
              mode={mode}
            />
          </div>
        ) : null}
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
