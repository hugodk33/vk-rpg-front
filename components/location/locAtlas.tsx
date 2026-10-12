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

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Location } from "@/lib/types";
import { drawPlateBoard, drawPlateDrawing, paintCanvas, plateCanvas } from "@/lib/canvasgrid";
import { interpolate, useTranslation } from "@/lib/i18n";
import { floorPlanGroup } from "@/lib/location";
import { KindGlyph, KIND_TINT } from "@/lib/location-glyphs";
import CopyToTableButton from "@/components/table/CopyToTableButton";

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

/* Player route: no greenish glyphs — every tint stays in the blue
   family (the narrator keeps the full KIND_TINT palette). */
export const PLAYER_KIND_TINT: Record<string, string> = {
  continent: "text-blue-400",
  region: "text-blue-400",
  biome: "text-blue-300",
};

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
export function ZoomRuler({
  chain,
  onJump,
  player = false,
  minZoomId = null,
}: {
  chain: Location[];
  onJump: (id: string) => void;
  player?: boolean;
  /** id do local padrão: as porções da trilha ACIMA dele (maiores escalas)
      ficam travadas — só se navega do padrão para baixo. */
  minZoomId?: string | null;
}) {
  const { t } = useTranslation();
  if (chain.length < 2) return null;
  const raw = chain.map((n) => {
    const m = n.hex?.sizeM;
    return m != null && m > 0 ? Math.max(Math.log10(m), 0.08) : 0.08;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  const widths = raw.map((w) => (w / sum) * 100);
  const active = chain[chain.length - 1].id;
  const cutIndex = minZoomId ? chain.findIndex((n) => n.id === minZoomId) : -1;

  return (
    <nav
      aria-label={t("tp.loc.zoomTrail")}
      className={
        player
          ? "rounded-xl border border-blue-400/20 bg-blue-400/[0.04] px-4 py-3.5"
          : "rounded-xl border border-teal-400/20 bg-teal-400/[0.04] px-4 py-3.5"
      }
    >
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
                <span className={`font-mono text-[11px] uppercase tracking-widest truncate ${player ? "text-blue-300" : "text-teal-300"}`}
                  title={node.name}>
                  {node.name}
                </span>
              ) : cutIndex >= 0 && i < cutIndex ? (
                <span className="font-mono text-[11px] uppercase tracking-widest truncate text-zinc-600" title={t("tp.zoomLocked").replace("{name}", node.name)}>
                  {node.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onJump(node.id)}
                  className={`font-mono text-[11px] uppercase tracking-widest truncate text-zinc-500 hover:text-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 rounded-sm ${player ? "focus-visible:ring-blue-500/60" : "focus-visible:ring-teal-600/60"}`}
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
                    ? player
                      ? "h-[3px] rounded-full bg-blue-400/70 shadow-[0_0_8px_rgba(96,165,250,0.35)]"
                      : "h-[3px] rounded-full bg-teal-400/70 shadow-[0_0_8px_rgba(94,234,212,0.35)]"
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
                  i === chain.length - 1 ? (player ? "text-blue-400/90" : "text-teal-400/90") : "text-zinc-600"
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
            className={`absolute -translate-x-1/2 text-[10px] leading-none ${player ? "text-blue-300" : "text-teal-300"}`}
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
  copyHref,
  tableId,
}: {
  node: Location;
  onZoom: (id: string) => void;
  onSetDefault?: (id: string) => void;
  trail?: Location[];
  isDefault?: boolean;
  busy?: boolean;
  player?: boolean;
  copyHref?: string;
  tableId?: string;
}) {
  const { lang, t } = useTranslation();
  const hasChildren = (node.children?.length ?? 0) > 0;
  const battle = !!node.isBattlemap;
  const kindLabel =
    node.kind && KNOWN_KINDS.has(node.kind) ? t(`tp.locKind.${node.kind}`) : t("tp.locKind.generic");
  const glyphTint = player
    ? (PLAYER_KIND_TINT[node.kind ?? ""] ?? KIND_TINT[node.kind ?? "site"] ?? "text-zinc-500")
    : (KIND_TINT[node.kind ?? "site"] ?? "text-zinc-500");
  return (
    <div className="group relative flex h-full flex-col items-center rounded-xl border border-zinc-700/40 bg-zinc-800/40 px-4 py-3.5 transition-all hover:bg-zinc-800/70 hover:border-zinc-600/60">
      {onSetDefault ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetDefault(node.id)}
          title={isDefault ? t("tp.loc.defaultOn") : t("tp.loc.defaultSet")}
          className={`absolute top-2 right-2 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/60 disabled:opacity-40 hover:bg-white/5 ${
            isDefault ? "text-amber-300/70" : "text-zinc-600 hover:text-amber-300/60"
          }`}
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill={isDefault ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>{t("tp.loc.default")}</span>
        </button>
      ) : null}
      <div className={`flex items-center justify-center shrink-0 ${glyphTint}`} aria-hidden>
        <KindGlyph
          kind={node.kind}
          className="h-11 w-11 opacity-90 transition-all duration-300 group-hover:opacity-100"
        />
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col items-center text-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
          {battle ? (
            <span className="font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
              {t("tp.loc.battle")}
            </span>
          ) : null}
        </div>

        <span className="block mt-2 w-full max-w-full text-sm font-medium text-zinc-200 truncate px-1">{node.name || t("it.unnamed")}</span>
        <p className="w-full max-w-full font-mono text-[10px] tracking-widest uppercase text-zinc-500 mt-0.5 truncate px-1">
          {kindLabel}
          {node.region ?? node.subRegion ? (
            <span className="text-zinc-600"> · {node.region ?? node.subRegion}</span>
          ) : null}
        </p>
        {trail ? <div className="mt-1 w-full max-w-full"><Trail chain={trail} /></div> : null}

        <div className="mt-3 font-mono text-[10px] tracking-widest uppercase text-zinc-600">
          {formatScale(node.hex?.sizeM)}
        </div>

        <div className="mt-3 flex w-full flex-col gap-2 border-t border-zinc-700/40 pt-2.5 mt-auto">
          <button
            type="button"
            onClick={() => onZoom(node.id)}
            disabled={!hasChildren}
            title={hasChildren ? t("tp.loc.openSubs") : t("tp.loc.noSubs")}
            className={`w-full inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors focus:outline-none focus-visible:ring-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              player
                ? "border-blue-400/25 bg-blue-400/5 text-blue-300/90 hover:bg-blue-400/10 hover:text-blue-200 focus-visible:ring-blue-500/60 disabled:hover:bg-blue-400/5 disabled:hover:text-blue-300/90"
                : "border-teal-400/25 bg-teal-400/5 text-teal-300/90 hover:bg-teal-400/10 hover:text-teal-200 focus-visible:ring-teal-600/60 disabled:hover:bg-teal-400/5 disabled:hover:text-teal-300/90"
            }`}
          >
            ◱ {t("tp.loc.sublocations")}{hasChildren ? <> · {node.children?.length ?? 0}</> : null}
          </button>
          {!player ? (
            <div className="flex w-full gap-2">
              <Link
                href={`/location/${node.id}`}
                title={t("tp.loc.openOwn").replace("{name}", node.name || t("tp.locKind.generic"))}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/60 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-zinc-300 transition-colors hover:border-amber-700/50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
              >
                {t("tp.open")} →
              </Link>
              {copyHref ? (
                <CopyToTableButton
                  copyHref={copyHref}
                  tableId={tableId}
                  title={t("ra.copyTitle")}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-zinc-700/50 bg-zinc-800/60 px-2 py-1.5 font-mono text-[10px] tracking-widest uppercase text-sky-300/80 transition-colors hover:border-sky-500/50 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/60"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* A coluna "estampa" do banner — o desenho (strokes + tiles) pintado no
   MapStudio, renderizado compacto com o mesmo motor de canvas dos mapas.
   O banner só a mostra quando a localidade tem algo pintado na placa. */
export function AtlasMapColumn({
  node,
  boxW = 176,
  boxH = 112,
  fullWidth = false,
  label,
}: {
  node: Location;
  boxW?: number;
  boxH?: number;
  fullWidth?: boolean;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const tiles = node.tiles ?? [];
    const drawing = node.drawing ?? [];
    const { W, H, spec } = plateCanvas(node.hex ?? {}, 26, 34, 320, 240);
    const scale = Math.min(boxW / W, boxH / H);
    const dx = (boxW - W * scale) / 2;
    const dy = (boxH - H * scale) / 2;
    paintCanvas(
      cv,
      W,
      H,
      (ctx) => {
        drawPlateBoard(ctx, W, H, spec, tiles, { accent: "#38bdf8" });
        drawPlateDrawing(ctx, W, H, spec, drawing);
      },
      1,
      { scale, dx, dy, boxW, boxH }
    );
  }, [boxW, boxH, node]);

  return (
    <div className={`overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-950/50 ${fullWidth ? "w-full" : ""}`}>
      <canvas
        ref={ref}
        width={boxW}
        height={boxH}
        role="img"
        aria-label={label}
        style={fullWidth ? { width: "100%", height: "auto", display: "block" } : { width: `${boxW}px`, height: `${boxH}px` }}
        className="block touch-none select-none"
      />
    </div>
  );
}

/* The "abertura" card: the current plate's banner + the region's
   sublocation selector pinned to its bottom — the same shape MapLog
   uses for the sublocation card. In sublocations the search box sits
   in a column NEXT TO the selector (two columns); the first-location
   screen keeps the global search on top instead. */
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
  const hasPlate = (node.tiles?.length ?? 0) > 0 || (node.drawing?.length ?? 0) > 0;
  const glyphTint = player
    ? (PLAYER_KIND_TINT[node.kind ?? ""] ?? KIND_TINT[node.kind ?? "site"] ?? "text-zinc-500")
    : (KIND_TINT[node.kind ?? "site"] ?? "text-zinc-500");
  return (
    <div
      className={
        player
          ? "rounded-xl border border-blue-400/20 bg-blue-400/[0.04] px-4 py-3"
          : "rounded-xl border border-teal-400/20 bg-teal-400/[0.04] px-4 py-3"
      }
    >
      <div className="flex flex-col gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${player ? "bg-blue-300 shadow-[0_0_8px_rgba(96,165,250,0.6)]" : "bg-teal-300 shadow-[0_0_8px_rgba(94,234,212,0.6)]"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className={`font-mono text-[12px] font-bold tracking-widest uppercase truncate ${player ? "text-blue-100" : "text-teal-100"}`}>{node.name}</span>
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
</div>

        <div className="w-full">
          {hasPlate ? (
            <AtlasMapColumn node={node} label={t("lc.lmap.aria")} boxW={560} boxH={160} fullWidth />
          ) : (
            <div
              className="flex w-full aspect-[7/2] items-center justify-center rounded-lg border border-zinc-700/40 bg-zinc-950/50"
              title={t("tp.loc.pendingDraw")}
            >
              <span
                className={`flex items-center justify-center rounded-full border border-dashed border-zinc-500/70 p-5 ${glyphTint}`}
                role="img"
                aria-label={t("tp.loc.pendingDraw")}
              >
                <KindGlyph kind={node.kind} className="h-9 w-9 opacity-80" />
              </span>
            </div>
          )}
        </div>

        {members ? (
          <div className="pt-3 border-t border-zinc-700/40">
            <div className={searchable ? "flex flex-col gap-3 sm:flex-row" : ""}>
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
                      className={`w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg pl-9 pr-8 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors ${player ? "focus:border-blue-600/70" : "focus:border-teal-700/60"}`}
                    />
                    {searchValue ? (
                      <button
                        type="button"
                        onClick={() => onSearchChange?.("")}
                        aria-label={t("tp.clear")}
                        title={t("tp.clear")}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 rounded ${player ? "focus-visible:ring-blue-500/60" : "focus-visible:ring-teal-600/60"}`}
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
                  className={`w-full bg-zinc-800/80 border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none transition-colors ${player ? "focus:border-blue-600/70" : "focus:border-teal-700/60"}`}
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
    </div>
  );
}

/* Convenience: the region selector members for a given atlas node —
   the same floor-plan group MapLog uses (host + direct children). */
export function atlasStripGroup(node: Location | null | undefined, flat: Location[]): Location[] {
  return node ? floorPlanGroup(node, flat) : [];
}