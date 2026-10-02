"use client";

/* ============================================================
   RegionMap — the location's inner territory, drawn as an SVG chart.
   Every child division becomes a selectable hex region on a dark
   surveyor's field: a glowing accent border, the kind glyph, the name
   and its raw scale. Children that carry axial (q,r) co-ordinates keep
   their true offset on the chart; siblings without co-ordinates fall
   back to a neat grid so the territory never lies about what it knows.
   The frame is a plate: hairline grid, inner frame, compass rose and
   a RAW legend. Hover a region to light it; click to descend.

   Navigation mirrors LocationMap / MapStudio: a hand (pan) toggle and
   a zoom stepper in a strip above the chart, because a territory with
   many children no longer fits the panel. Zoom 1 is the old behaviour —
   the chart scaled to the available width — so nothing shifts until
   the narrator asks for it.
   ============================================================ */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Hand, Minus, Plus } from "lucide-react";
import { centerOf, cellHeight, cellWidth, polygonPath } from "@/lib/hexgrid";
import { useTranslation } from "@/lib/i18n";
import { KindGlyph, KIND_LABELS } from "@/lib/location-glyphs";

const R = 20;
const M = 56;
const ORIENTATION = "pointy";
const SCALE = 1.18;
const CW = cellWidth(ORIENTATION, R) * SCALE;
const CH = cellHeight(ORIENTATION, R) * SCALE;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

export function formatHexScale(m?: number | null): string {
  if (m == null) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
  }
  return `${Number.isInteger(m) ? m : m.toFixed(1)} m`;
}

function TieredHex({
  cx,
  cy,
  accent,
}: {
  cx: number;
  cy: number;
  accent: string;
}) {
  return (
    <>
      <polygon
        points={polygonPath(cx, cy, R + 2.5, ORIENTATION)}
        fill="none"
        stroke={accent}
        strokeOpacity="0.14"
        strokeWidth={1}
      />
      <polygon
        points={polygonPath(cx, cy, R, ORIENTATION)}
        fill={accent}
        fillOpacity="0.05"
        stroke={accent}
        strokeOpacity="0.45"
        strokeWidth={1.1}
      />
    </>
  );
}

interface MapChild {
  id?: string;
  name?: string;
  kind?: string;
  hex?: {
    sizeM?: number | null;
    centerQ?: number;
    centerR?: number;
  };
}

interface Cell {
  c: MapChild;
  q: number;
  r: number;
  grid: boolean;
}

type PlacedCell = Cell & { cxp: number; cyp: number };

function layout(children: MapChild[]): Cell[] {
  const cells: Cell[] = [];
  const grid: Cell[] = [];
  for (const c of children) {
    const q = c.hex?.centerQ;
    const r = c.hex?.centerR;
    if (typeof q === "number" && typeof r === "number") {
      cells.push({ c, q, r, grid: false });
    } else {
      grid.push({ c, q: 0, r: 0, grid: true });
    }
  }
  const cols = Math.max(1, Math.ceil(Math.sqrt(children.length)));
  grid.forEach((g, i) => {
    g.q = Math.floor(i % cols);
    g.r = Math.floor(i / cols);
  });
  return [...cells, ...grid];
}

interface Chart {
  pts: PlacedCell[];
  w: number;
  h: number;
  toX: (x: number) => number;
  toY: (y: number) => number;
}

const EMPTY_CHART: Chart = {
  pts: [],
  w: 300,
  h: 210,
  toX: (x) => x,
  toY: (y) => y,
};

export default function RegionMap({
  regions,
  accent = "#38bdf8",
  hrefOf,
}: {
  regions: MapChild[];
  accent?: string;
  hrefOf?: (id: string) => string;
}) {
  const { t } = useTranslation();
  const kindLabel = (kind: string): string => {
    const key = `lc.kind.${kind}`;
    const label = t(key);
    return label === key ? (KIND_LABELS[kind] ?? kind) : label;
  };
  const childs = regions.filter((c) => c.id);

  /* Geometry is computed before the empty-state bail-out so that every
     hook below runs unconditionally — React forbids an early return
     above a hook. With no children the numbers are inert. */
  const chart = useMemo(() => {
    if (childs.length === 0) return EMPTY_CHART;
    const cells = layout(childs);
    const minQ = Math.min(...cells.map((c) => c.q));
    const minR = Math.min(...cells.map((c) => c.r));
    const pts: PlacedCell[] = cells.map((cell) => {
      const p = centerOf(cell.q - minQ, cell.r - minR, ORIENTATION, R * SCALE);
      return { ...cell, cxp: p.x, cyp: p.y };
    });
    const xs = pts.map((p) => p.cxp);
    const ys = pts.map((p) => p.cyp);
    const minX = Math.min(...xs) - CW / 2;
    const maxX = Math.max(...xs) + CW / 2;
    const minY = Math.min(...ys) - CH / 2;
    const maxY = Math.max(...ys) + CH / 2;
    return {
      pts,
      w: Math.max(maxX - minX + M * 2, 300),
      h: Math.max(maxY - minY + M * 2, 210),
      toX: (x: number) => x - minX + M,
      toY: (y: number) => y - minY + M,
    };
  }, [childs]);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hand, setHand] = useState(false);
  const [grab, setGrab] = useState(false);

  /* The chart is sized as a percentage of the panel rather than measured:
     at zoom 1 that is exactly the old `w-full h-auto` behaviour, with no
     reflow on hydration, and every zoom step simply widens the SVG so the
     wrapper starts scrolling. `aspectRatio` pins the height even where a
     browser refuses to derive one from the viewBox. */

  function onPointerDown(e: React.PointerEvent) {
    const wrap = wrapRef.current;
    if (!hand || !wrap) return;
    e.preventDefault();
    panRef.current = { x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop };
    wrap.setPointerCapture(e.pointerId);
    setGrab(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const wrap = wrapRef.current;
    const d = panRef.current;
    if (!wrap || !d) return;
    wrap.scrollLeft = Math.max(0, d.sl - (e.clientX - d.x));
    wrap.scrollTop = Math.max(0, d.st - (e.clientY - d.y));
  }

  function onPointerUp() {
    if (!panRef.current) return;
    panRef.current = null;
    setGrab(false);
  }

  if (childs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-zinc-700/70 bg-zinc-900/40 px-6 py-10 text-center">
        <span aria-hidden className="text-zinc-600">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M12 12l6.5-5" />
          </svg>
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
            {t("lc.region.emptyTitle")}
          </p>
          <p className="mt-1 max-w-xs text-sm text-zinc-600">
            {t("lc.region.emptyDesc")}
          </p>
        </div>
      </div>
    );
  }

  const { pts, w, h, toX, toY } = chart;

  const grid: React.ReactNode[] = [];
  const rows = Math.max(1, Math.ceil((h - M * 2) / 34));
  const cols = Math.max(1, Math.ceil((w - M * 2) / 34));
  for (let rr = 0; rr <= rows; rr++) {
    const y = M + rr * ((h - M * 2) / rows);
    grid.push(
      <line key={`r${rr}`} x1={M} y1={y} x2={w - M} y2={y} stroke="#e0e0e0" strokeWidth={0.4} strokeOpacity={0.13} />
    );
  }
  for (let cc = 0; cc <= cols; cc++) {
    const x = M + cc * ((w - M * 2) / cols);
    grid.push(
      <line key={`c${cc}`} x1={x} y1={M} x2={x} y2={h - M} stroke="#e0e0e0" strokeWidth={0.4} strokeOpacity={0.13} />
    );
  }

  return (
    <div>
      {/* hand (pan) + zoom */}
      <div className="mb-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setHand((v) => !v)}
          aria-pressed={hand}
          title={t("lc.zoom.hand")}
          className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
            hand ? "border-sky-500/60 bg-sky-500/15 text-sky-300" : "border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-200"
          }`}
        >
          <Hand className="w-3.5 h-3.5" strokeWidth={2.25} />
        </button>
        <span aria-hidden className="h-4 w-px bg-zinc-700/60" />
        <button
          type="button"
          onClick={() => setZoom((v) => clampZoom(v - ZOOM_STEP))}
          disabled={zoom <= ZOOM_MIN}
          title={t("lc.zoom.out")}
          aria-label={t("lc.zoom.out")}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-35"
        >
          <Minus className="w-3.5 h-3.5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          disabled={zoom === 1}
          title={t("lc.zoom.resetTitle")}
          className="h-7 min-w-[3.1rem] rounded-md border border-zinc-700/50 bg-zinc-800/40 font-mono text-[10px] tabular-nums text-zinc-300 hover:text-white transition-colors disabled:opacity-60"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((v) => clampZoom(v + ZOOM_STEP))}
          disabled={zoom >= ZOOM_MAX}
          title={t("lc.zoom.in")}
          aria-label={t("lc.zoom.in")}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-35"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
        </button>
      </div>

      {hand ? <p className="mb-2 text-[10px] leading-snug text-zinc-500">{t("lc.lmap.navHint")}</p> : null}

      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative overflow-auto scroll-thin rounded-lg border border-zinc-700/40 bg-zinc-900/50 ${hand ? (grab ? "cursor-grabbing" : "cursor-grab") : ""}`}
        style={{ maxHeight: "min(72vh, 540px)" }}
      >
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="group"
          aria-label={t("lc.region.aria")}
          className="block touch-none select-none"
          style={{ width: `${zoom * 100}%`, aspectRatio: `${w} / ${h}` }}
        >
          <rect x="0" y="0" width={w} height={h} fill="#141414" />
          {grid}

          <rect
            x={M / 3}
            y={M / 3}
            width={w - (M / 3) * 2}
            height={h - (M / 3) * 2}
            fill="none"
            stroke="#e0e0e0"
            strokeOpacity={0.35}
            strokeWidth={0.5}
          />

            {pts.map((cell) => {
              const id = cell.c.id!;
              const cx = toX(cell.cxp);
              const cy = toY(cell.cyp);
              const glyph = cell.c.kind ?? "site";
              const name = cell.c.name || t("lc.common.noName");
              const href = hrefOf ? hrefOf(id) : `/location/${id}`;
              return (
                <g key={id} className="location-region">
                  <Link href={href} aria-label={name}>
                    <TieredHex cx={cx} cy={cy} accent={accent} />

                    {/* center bearing */}
                    <circle cx={cx} cy={cy} r={2.4} fill={accent} fillOpacity="0.7" />

                    {/* kind glyph chamber */}
                    <g transform={`translate(${cx - 19} ${cy - 31})`} pointerEvents="none">
                      <circle cx="19" cy="25" r="15" fill={accent} fillOpacity="0.07" stroke={accent} strokeOpacity="0.22" strokeWidth={0.8} />
                      <KindGlyph kind={glyph} className="h-[30px] w-[30px]" />
                    </g>

                    {/* kind label */}
                    <text
                      x={cx}
                      y={cy + 12}
                      fill={accent}
                      fillOpacity="0.8"
                      fontSize={6}
                      letterSpacing={2.4}
                      textAnchor="middle"
                      className="location-region-kind mono-label"
                    >
                      {kindLabel(glyph).toUpperCase()}
                    </text>

                    {/* name */}
                    <text
                      x={cx}
                      y={cy + 24}
                      fill="#e9e9ec"
                      fontSize={8.5}
                      textAnchor="middle"
                      className="location-region-name"
                    >
                      {name.length > 22 ? `${name.slice(0, 21)}…` : name}
                    </text>

                    {/* raw scale */}
                    <text
                      x={cx}
                      y={cy + 34}
                      fill="#9a9aa2"
                      fontSize={6}
                      textAnchor="middle"
                      className="mono-label"
                    >
                      {formatHexScale(cell.c.hex?.sizeM)}
                    </text>
                  </Link>
                </g>
              );
            })}

            {/* compass rose */}
            <g transform={`translate(${M * 0.55} ${M * 0.5})`} opacity={0.72}>
              <path d="M0 -11 L2.4 -2.9 L11 0 L2.4 2.9 L0 11 L-2.4 2.9 L-11 0 L-2.4 -2.9 Z" fill="none" stroke="#b3b3b3" strokeWidth={0.8} />
              <path d="M0 -11 L0 11 M-11 0 L11 0" stroke="#b3b3b3" strokeWidth={0.4} />
              <path d="M0 -11 L2.4 -2.9 L11 0 L2.4 2.9 L0 11 Z" fill="#cfcfcf" fillOpacity={0.9} />
              <text x="0" y="19" fill="#b3b3b3" fontSize={6} textAnchor="middle" className="mono-label">N</text>
            </g>

            {/* RAW legend */}
            <g transform={`translate(${w - M * 1.55} ${h - M * 1.85})`} opacity={0.6}>
              <circle cx="-30" cy="0" r="2.6" fill="none" stroke="#b3b3b3" strokeWidth={0.6} />
              <path d="M-30 0 V-6 M-30 0 V6 M-36 0 H-24" stroke="#b3b3b3" strokeWidth={0.5} />
              <text x="-12" y="2" fill="#9a9aa2" fontSize={5} letterSpacing={1.1} className="mono-label">RAW</text>
            </g>
          </svg>
      </div>
    </div>
  );
}