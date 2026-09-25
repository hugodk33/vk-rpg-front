"use client";

/* ============================================================
   Survey Atlas — shared presentational pieces for the location
   atlas, used BOTH by the narrator route (`/table/[id]/locations`)
   and by the player console's "Locais" tab (PlayerAtlas).
   The tree is a genuine zoom: each division's hex scale shrinks
   (500 km → 1 m). In player mode every human-readable field is
   whatever the server already shaped through the viewer's rules
   (masked aliases / nulled details), and the editor-only actions
   (set default, open the narrator page) are omitted.
   ============================================================ */

import Link from "next/link";
import type { Location } from "@/lib/types";
import { interpolate, useTranslation } from "@/lib/i18n";
import { floorPlanGroup } from "@/lib/location";
import { KindGlyph, KIND_TINT } from "@/lib/location-glyphs";

export const KNOWN_KINDS = new Set([
  "world",
  "continent",
  "nation",
  "region",
  "biome",
  "province",
  "city",
  "district",
  "locale",
  "site",
  "battlemap",
  "point",
]);

export function formatScale(m?: number | null): string {
  if (m == null) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km/hex`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m/hex`;
}

export function formatRulerScale(m?: number | null): string {
  if (m == null) return "";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m`;
}

export interface IndexNode {
  node: Location;
  chain: Location[];
}

export function indexTree(roots: Location[]): Map<string, IndexNode> {
  const map = new Map<string, IndexNode>();
  const walk = (node: Location, trail: Location[]) => {
    const chain = [...trail, node];
    map.set(node.id, { node, chain });
    for (const child of node.children ?? []) walk(child, chain);
  };
  for (const root of roots) walk(root, []);
  return map;
}

/* The ruler: segment width ∝ log scale so the bar visibly
   converges as the atlas zooms from world to battlemap. */
export function ZoomRuler({ chain, onJump }: { chain: Location[]; onJump: (id: string) => void }) {
  const { t } = useTranslation();
  if (chain.length < 2) return null;
  const raw = chain.map((n) => {
    const m = n.hex?.sizeM;
    return m != null && m > 0 ? Math.max(Math.log10(m), 0.08) : 0.08;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  const widths = raw.map((w) => (w / sum) * 100);
  const active = chain[chain.length - 1].id;

  return (
    <nav aria-label={t("tp.loc.zoomTrail")} className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-4 py-3.5">
      {/* rung names */}
      <div className="flex flex-wrap items-center gap-y-1.5">
        {chain.map((node, i) => {
          const isActive = node.id === active;
          return (
            <span key={node.id} className="flex items-center min-w-0">
              {i > 0 ? (
                <span className="mx-2 text-zinc-700" aria-hidden>›</span>
              ) : null}
              {isActive ? (
                <span className="font-mono text-[11px] uppercase tracking-widest truncate text-teal-300"
                  title={node.name}>
                  {node.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onJump(node.id)}
                  className="font-mono text-[11px] uppercase tracking-widest truncate text-zinc-500 hover:text-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 rounded-sm"
                  title={t("tp.loc.goTo").replace("{name}", node.name)}
                >
                  {node.name}
                </button>
              )}
            </span>
          );
        })}
      </div>

      {/* scale ruler */}
      <div className="mt-3">
        <div className="flex">
          {widths.map((w, i) => (
            <div key={i} className="relative" style={{ width: `${w}%` }}>
              <div
                className={
                  i === chain.length - 1
                    ? "h-[3px] rounded-full bg-teal-400/70 shadow-[0_0_8px_rgba(94,234,212,0.35)]"
                    : "h-[3px] rounded-full bg-zinc-600/70 group-hover:bg-zinc-500/70 transition-colors"
                }
              />
              <span className="absolute top-1/2 -translate-y-1/2 -right-px h-2 w-px bg-zinc-500" aria-hidden />
            </div>
          ))}
        </div>
        <div className="flex mt-1.5">
          {widths.map((w, i) => (
            <div key={i} className="flex items-center min-w-0"
              style={{ width: `${w}%` }}>
              <span
                className={`font-mono text-[9px] tracking-widest uppercase pr-2 ${
                  i === chain.length - 1 ? "text-teal-400/90" : "text-zinc-600"
                }`}
              >
                {formatRulerScale(chain[i].hex?.sizeM)}
              </span>
            </div>
          ))}
        </div>
        {/* you-are-here marker */}
        <div className="relative mt-1" aria-hidden>
          <span
            className="absolute -translate-x-1/2 text-[10px] leading-none text-teal-300"
            style={{ left: `calc(${widths.slice(0, -1).reduce((a, b) => a + b, 0)}% + ${widths[widths.length - 1] / 2}% )` }}
          >
            ▼
          </span>
        </div>
      </div>
    </nav>
  );
}

export function Trail({ chain }: { chain: Location[] }) {
  if (chain.length === 0) return null;
  return (
    <div className="font-mono text-[9px] tracking-widest uppercase text-zinc-600 truncate" title={chain.map((n) => n.name).join(" › ")}>
      {chain.slice(0, 4).map((n) => n.name).join(" › ")}
      {chain.length > 4 ? " › …" : ""}
    </div>
  );
}

export function LocationPlate({
  node,
  onZoom,
  onSetDefault,
  trail,
  isDefault = false,
  busy = false,
  player = false,
}: {
  node: Location;
  onZoom: (id: string) => void;
  onSetDefault?: (id: string) => void;
  trail?: Location[];
  isDefault?: boolean;
  busy?: boolean;
  player?: boolean;
}) {
  const { lang, t } = useTranslation();
  const hasChildren = (node.children?.length ?? 0) > 0;
  const battle = !!node.isBattlemap;
  const kindLabel =
    node.kind && KNOWN_KINDS.has(node.kind) ? t(`tp.locKind.${node.kind}`) : t("tp.locKind.generic");
  return (
    <div className="group relative flex h-full gap-3 rounded-xl border border-zinc-700/40 bg-zinc-800/40 px-4 py-3.5 transition-all hover:bg-zinc-800/70 hover:border-zinc-600/60">
      <div className={`flex items-center shrink-0 ${KIND_TINT[node.kind ?? "site"] ?? "text-zinc-500"}`} aria-hidden>
        <KindGlyph
          kind={node.kind}
          className="h-11 w-11 opacity-90 transition-all duration-300 group-hover:opacity-100 group-hover:drop-shadow-[0_0_10px_currentColor]"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {onSetDefault ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSetDefault(node.id)}
              title={isDefault ? t("tp.loc.defaultOn") : t("tp.loc.defaultSet")}
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/60 disabled:opacity-40 ${
                isDefault
                  ? "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25"
                  : "text-zinc-600 hover:text-amber-300/80 hover:bg-amber-400/10"
              }`}
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill={isDefault ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span>{t("tp.loc.default")}</span>
            </button>
          ) : null}
          {battle ? (
            <span className="font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
              {t("tp.loc.battle")}
            </span>
          ) : null}
          {hasChildren ? (
            <span className="font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-teal-400/10 text-teal-300">
              +{(node.children?.length ?? 0).toString().padStart(2, "0")}
            </span>
          ) : null}
        </div>

        <span className="block mt-2 text-sm font-medium text-zinc-200 truncate">{node.name || t("it.unnamed")}</span>
        <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5 truncate">
          {kindLabel}
          {node.region ?? node.subRegion ? (
            <span className="text-zinc-600"> · {node.region ?? node.subRegion}</span>
          ) : null}
        </p>
        {trail ? <div className="mt-1"><Trail chain={trail} /></div> : null}

        <div className="mt-3 font-mono text-[10px] tracking-widest uppercase text-zinc-600">
          {formatScale(node.hex?.sizeM)}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-zinc-700/40 pt-2.5 mt-auto">
          <button
            type="button"
            onClick={() => onZoom(node.id)}
            disabled={!hasChildren}
            title={hasChildren ? t("tp.loc.openSubs") : t("tp.loc.noSubs")}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-teal-400/25 bg-teal-400/5 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-teal-300/90 transition-colors hover:bg-teal-400/10 hover:text-teal-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-teal-400/5 disabled:hover:text-teal-300/90"
          >
            ◱ {t("tp.loc.sublocations")}
          </button>
          {!player ? (
            <Link
              href={`/location/${node.id}`}
              title={t("tp.loc.openOwn").replace("{name}", node.name || t("tp.locKind.generic"))}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/60 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-zinc-300 transition-colors hover:border-amber-700/50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
            >
              {t("tp.open")} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* The "abertura" card: the current plate's banner + the region's
   sublocation selector ("pesquisa") pinned to its bottom — the same
   shape MapLog uses for the sublocation card. On the FIRST location
   (the plate where the zoom begins) the search box sits in a column
   NEXT TO the selector; from the first sublocation on only the
   selector remains. */
export function CurrentMapStrip({
  node,
  isDefault = false,
  group,
  onJump,
  player = false,
  searchable = false,
  searchValue = "",
  onSearchChange,
}: {
  node: Location;
  isDefault?: boolean;
  group?: Location[];
  onJump: (id: string) => void;
  player?: boolean;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}) {
  const { lang, t } = useTranslation();
  const hex = node.hex;
  const kindLabel =
    node.kind && KNOWN_KINDS.has(node.kind) ? t(`tp.locKind.${node.kind}`) : t("tp.locKind.generic");
  const childCount = node.children?.length ?? 0;
  const members = group && group.length > 1 ? group : null;
  return (
    <div className="rounded-xl border border-teal-400/20 bg-teal-400/[0.04] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-300 shrink-0 shadow-[0_0_8px_rgba(94,234,212,0.6)]" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-mono text-[12px] font-bold tracking-widest uppercase text-teal-100 truncate">{node.name}</span>
            <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 hidden sm:inline">
              {kindLabel} · {formatScale(hex?.sizeM)}
            </span>
            {isDefault ? (
              <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 shrink-0">
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {t("tp.default")}
              </span>
            ) : null}
          </div>
          <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-600 mt-0.5 truncate">
            {node.region ?? node.subRegion ?? node.address ?? node.country ?? "—"}
          </div>
        </div>
        {(node.children?.length ?? 0) > 0 ? (
          <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 shrink-0">
            {interpolate(t(childCount !== 1 ? "tp.divisions" : "tp.division"), { n: childCount })}
          </span>
        ) : !player ? (
          <Link
            href={`/location/${node.id}`}
            className="font-mono text-[10px] tracking-widest uppercase text-teal-300/90 hover:text-teal-200 shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 rounded-sm"
          >
            {t("tp.openMap")}
          </Link>
        ) : null}
      </div>

      {members ? (
        <div className="mt-3 pt-3 border-t border-zinc-700/40">
          <div className={searchable ? "flex flex-col sm:flex-row gap-3" : ""}>
            {searchable ? (
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => onSearchChange?.(e.target.value)}
                    placeholder={t("tp.searchPh")}
                    className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg pl-9 pr-8 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-teal-700/60 transition-colors"
                  />
                  {searchValue ? (
                    <button
                      type="button"
                      onClick={() => onSearchChange?.("")}
                      aria-label={t("tp.clear")}
                      title={t("tp.clear")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60 rounded"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className={searchable ? "flex-1 min-w-0" : ""}>
              <select
                value={node.id}
                onChange={(e) => onJump(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-teal-700/60 transition-colors"
              >
                {members.map((l) => (
                  <option key={l.id} value={l.id} className="bg-zinc-800">
                    {l.id === node.id ? "▸ " : ""}
                    {l.name || t("lc.common.noName")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* Convenience: the region selector members for a given atlas node —
   the same floor-plan group MapLog uses (host + direct children). */
export function atlasStripGroup(node: Location | null | undefined, flat: Location[]): Location[] {
  return node ? floorPlanGroup(node, flat) : [];
}