"use client";

/* ============================================================
   TacticalPlate — a floor plan rendered as an axial hex grid.
   Same geometry as LocationMap/MapStudio (hexgrid + terrain),
   drawn onto a 2D <canvas> via lib/canvasgrid, plus the TOKEN
   layer: characters and npcs placed on hexes (q/r + facing), the
   movement trail of the last action and an optional interactive
   hex picker (used by the session MAP tab to log a move).
   ============================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { hexFromPoint } from "@/lib/hexgrid";
import {
  drawPlateBoard,
  drawPlateDrawing,
  drawPlateTokens,
  drawPlateTrail,
  paintCanvas,
  plateCanvas,
  screenToGrid,
  type CanvasPlate,
  type GridSpec,
} from "@/lib/canvasgrid";
import ZoomControls from "@/components/map/ZoomControls";
import type { BoardToken, BoardTrail } from "@/lib/board";
import type { Location } from "@/lib/types";

export interface PlatePoint {
  q: number;
  r: number;
}

interface TacticalPlateProps {
  location: Location | null;
  tokens?: BoardToken[];
  trail?: BoardTrail | null;
  /** hex destacado (destino selecionado / origem pintada) */
  mark?: PlatePoint | null;
  /** resposta a clique num hex (modo interativo) */
  onHexClick?: (q: number, r: number) => void;
  accent?: string;
  R?: number;
  M?: number;
}

const playerFill = "#60a5fa";
const npcFill = "#fbbf24";

export default function TacticalPlate({
  location,
  tokens = [],
  trail = null,
  mark = null,
  onHexClick,
  accent = "#38bdf8",
  R = 24,
  M = 12,
}: TacticalPlateProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);

  const plate: CanvasPlate = useMemo(
    () => plateCanvas({ width: location?.hex?.width, height: location?.hex?.height, orientation: location?.hex?.orientation }, R, M, 120, 100),
    [location?.hex?.width, location?.hex?.height, location?.hex?.orientation, R, M]
  );
  const spec: GridSpec = useMemo(
    () => ({ ...plate.spec, rotationDeg: location?.hex?.rotationDeg ?? 0 }),
    [plate, location?.hex?.rotationDeg]
  );
  const { W, H } = plate;

  const placed = useMemo(
    () => tokens.filter((t) => t.q != null && t.r != null && t.q! >= 0 && t.r! >= 0 && t.q! < spec.cols && t.r! < spec.rows),
    [tokens, spec]
  );
  const unplaced = useMemo(
    () => tokens.filter((t) => t.q == null || t.r == null || t.q! < 0 || t.r! < 0 || t.q! >= spec.cols || t.r! >= spec.rows),
    [tokens, spec]
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    paintCanvas(cv, W, H, (ctx) => {
      drawPlateBoard(ctx, W, H, spec, location?.tiles ?? [], { accent, mark });
      drawPlateDrawing(ctx, W, H, spec, location?.drawing ?? []);
      drawPlateTrail(ctx, W, H, spec, accent, trail?.from ?? null, trail?.to ?? null, "tic");
      drawPlateTokens(ctx, W, H, spec, placed);
    }, zoom);
  }, [location, placed, trail, mark, accent, W, H, spec, zoom]);

  function handleClick(e: ReactMouseEvent<HTMLCanvasElement>) {
    if (!onHexClick) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const p = screenToGrid(e.clientX, e.clientY, rect, W, H, spec);
    const cell = hexFromPoint(p.x, p.y, spec.orientation, spec.R);
    if (cell.q >= 0 && cell.q < spec.cols && cell.r >= 0 && cell.r < spec.rows) onHexClick(cell.q, cell.r);
  }

  return (
    <div className="rounded-lg border border-zinc-700/40 bg-zinc-950/60 overflow-hidden">
      <div className="relative overflow-auto">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="block mx-auto"
          role="img"
          aria-label="Floor plan"
          style={{
            width: `${Math.round(W * zoom)}px`,
            height: `${Math.round(H * zoom)}px`,
            cursor: onHexClick ? "pointer" : undefined,
          }}
          onClick={handleClick}
        />
        <ZoomControls zoom={zoom} onZoom={setZoom} />
      </div>

      {unplaced.length > 0 ? (
        <div className="border-t border-zinc-700/40 px-3 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">off board</span>
          {unplaced.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.isPlayer ? playerFill : npcFill, opacity: t.unconscious ? 0.5 : 1 }} />
              {t.name}
            </span>
          ))}
        </div>
      ) : (
        byId(tokens).size > 0 &&
        placed.length === 0 && (
          <div className="border-t border-zinc-700/40 px-3 py-1.5 font-mono text-[10px] text-zinc-600">
            No tokens placed yet — log a move or reset positions.
          </div>
        )
      )}
    </div>
  );
}

function byId(tokens: BoardToken[]): Map<string, BoardToken> {
  const m = new Map<string, BoardToken>();
  for (const t of tokens) m.set(t.id, t);
  return m;
}