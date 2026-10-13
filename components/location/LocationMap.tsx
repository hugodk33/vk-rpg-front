"use client";

/* ============================================================
   LocationMap — the local tactical grid of a battlemap location,
   drawn on a 2D <canvas> (lib/canvasgrid) from the stored hex
   geometry (width × height, orientation, rotation, center).
   Renders the skeleton of the grid *plus* the two layers the
   narrator painted in the MapStudio: hex terrain tiles and the
   stroke layer (walls, routes, girders). The center cell is
   pointed at its absolute q,r chain.
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import type { AbsoluteHex } from "@/lib/location";
import { formatHexScale } from "@/lib/location";
import {
  drawPlateBoard,
  drawPlateDrawing,
  paintCanvas,
  plateCanvas,
  type CanvasPlate,
  type GridSpec,
} from "@/lib/canvasgrid";
import { Hand, Minus, Plus } from "lucide-react";
import { interpolate, useTranslation } from "@/lib/i18n";
import { useImageCache } from "@/lib/imagecache";
import type { DrawShape, HexTile } from "@/lib/types";

/* Matches the previous <ZoomControls> defaults so the plate keeps the
   same zoom range it always had. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.5;
const ZOOM_STEP = 0.3;
const clampZoom = (v: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));

interface MapHex {
  sizeM?: number | null;
  width?: number | null;
  height?: number | null;
  centerQ?: number;
  centerR?: number;
  orientation?: string;
  rotationDeg?: number;
}

export default function LocationMap({
  hex,
  abs,
  accent = "#38bdf8",
  tiles = [],
  drawing = [],
  bgImageUrl = null,
}: {
  hex?: MapHex | null;
  abs?: AbsoluteHex;
  accent?: string;
  tiles?: HexTile[];
  drawing?: DrawShape[];
  bgImageUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [hand, setHand] = useState(false);
  const [grab, setGrab] = useState(false);
  const { t } = useTranslation();

  const imageMap = useImageCache([
    bgImageUrl,
    ...drawing.filter((s) => s.type === "image").map((s) => s.src ?? null),
  ]);
  const bgImage = bgImageUrl ? imageMap.get(bgImageUrl) ?? null : null;

  /* ---- hand (pan) ---- */
  /* The plate is read-only, so panning is just scrolling the wrapper.
     Capture on the wrapper (not the canvas) so a drag that leaves the
     canvas still keeps moving the map. */

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

  const plate: CanvasPlate = useMemo(() => plateCanvas(hex ?? {}, 26, 34, 320, 240), [hex]);
  const spec: GridSpec = useMemo(() => ({ ...plate.spec, rotationDeg: hex?.rotationDeg ?? 0 }), [plate, hex]);
  const { W, H } = plate;

  const centerCol = Math.floor(spec.cols / 2);
  const centerRow = Math.floor(spec.rows / 2);

  const footprint = hex?.width != null && hex?.height != null ? `${hex.width} × ${hex.height} hex` : null;
  const centerLabel =
    abs && abs.chain.length > 1
      ? `q${abs.q} r${abs.r}`
      : hex?.centerQ != null && hex?.centerR != null
      ? `q${hex.centerQ} r${hex.centerR}`
      : null;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    paintCanvas(cv, W, H, (ctx) => {
      drawPlateBoard(ctx, W, H, spec, tiles, {
        accent,
        bgImage,
        centerLabel: centerLabel ? { text: centerLabel, at: { q: centerCol, r: centerRow } } : null,
      });
      drawPlateDrawing(ctx, W, H, spec, drawing, null, accent, imageMap);
    }, zoom);
  }, [spec, tiles, drawing, accent, centerLabel, centerCol, centerRow, W, H, zoom, bgImage, imageMap]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-1.5 mb-4 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none" style={{ color: accent }}>▦</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">{t("lc.lmap.title")}</span>
        <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }} />

        {/* hand (pan) + zoom — pinned to the header instead of floating over
            the canvas, where the old widget scrolled away with the map. */}
        <div className="flex items-center gap-1.5">
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
      </div>

      {hand ? <p className="-mt-2 mb-3 text-[10px] leading-snug text-zinc-500">{t("lc.lmap.navHint")}</p> : null}

      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative overflow-auto rounded-lg border border-zinc-700/40 bg-zinc-950/50 ${hand ? (grab ? "cursor-grabbing" : "cursor-grab") : ""}`}
      >
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block mx-auto touch-none select-none"
          role="img"
          aria-label={t("lc.lmap.aria")}
          style={{
            width: `${Math.round(W * zoom)}px`,
            height: `${Math.round(H * zoom)}px`,
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {footprint ? (
          <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
            <span>{t("lc.common.area")}</span>
            <b className="font-semibold text-zinc-300">{footprint}</b>
          </span>
        ) : null}
        <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
          <span>{t("lc.common.scale")}</span>
          <b className="font-semibold text-zinc-300">{formatHexScale(hex?.sizeM)}</b>
        </span>
        <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
          <span>{t("lc.common.grid")}</span>
          <b className="font-semibold text-zinc-300">{spec.orientation}</b>
        </span>
        <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
          <span>{t("lc.common.rotation")}</span>
          <b className="font-semibold text-zinc-300">{spec.rotationDeg}°</b>
        </span>
      </div>

      {drawing.length > 0 || tiles.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <span>{interpolate(t(drawing.length === 1 ? "lc.lmap.strokes1" : "lc.lmap.strokesN"), { n: drawing.length })}</span>
          <span aria-hidden>·</span>
          <span>{interpolate(t(tiles.length === 1 ? "lc.lmap.tiles1" : "lc.lmap.tilesN"), { n: tiles.length })}</span>
        </div>
      ) : null}
    </div>
  );
}