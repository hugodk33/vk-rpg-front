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
import ZoomControls from "@/components/map/ZoomControls";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { DrawShape, HexTile } from "@/lib/types";

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
}: {
  hex?: MapHex | null;
  abs?: AbsoluteHex;
  accent?: string;
  tiles?: HexTile[];
  drawing?: DrawShape[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const { t } = useTranslation();

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
        centerLabel: centerLabel ? { text: centerLabel, at: { q: centerCol, r: centerRow } } : null,
      });
      drawPlateDrawing(ctx, W, H, spec, drawing);
    }, zoom);
  }, [spec, tiles, drawing, accent, centerLabel, centerCol, centerRow, W, H, zoom]);

  return (
    <div>
      <div className="flex items-center gap-2.5 pb-1.5 mb-4 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none" style={{ color: accent }}>▦</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">{t("lc.lmap.title")}</span>
        <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }} />
      </div>

      <div className="relative overflow-auto rounded-lg border border-zinc-700/40 bg-zinc-950/50">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block mx-auto"
          role="img"
          aria-label={t("lc.lmap.aria")}
          style={{
            width: `${Math.round(W * zoom)}px`,
            height: `${Math.round(H * zoom)}px`,
          }}
        />
        <ZoomControls zoom={zoom} onZoom={setZoom} />
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