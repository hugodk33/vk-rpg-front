"use client";

/* ============================================================
   MapStudio — the full plate editor for a battlemap location,
   rendered on a 2D <canvas> (lib/canvasgrid). Layers:

   1. HEX TILES   — paint terrain onto each cell. Stored as
                    { q, r, t } in the plate's own grid. The
                    Fill (≋) bucket flood-fills a contiguous
                    region of the same floor type, Paint-style.
   2. DRAWING     — vector strokes over the grid: pen, line, rect,
                    ellipse, in a chosen color/weight. All shapes
                    are stored NORMALIZED (unit:"hexR"; 1 unit =
                    1 hex radius, origin = center of hex (0,0)) so
                    viewers at any radius stay aligned. Legacy
                    pixel shapes (authored at R = 24) are converted
                    on load.
   3. ASSETS      — a springboard catalog of vector props (door,
                    altar, statue, tree…) stamped onto hex centers,
                    then moved / scaled / rotated with Select.
   4. SELECT      — click a stroke to select it, drag to move,
                    Delete/Backspace removes it.
   5. GRID        — footprint, orientation, scale, rotation and
                    the center cell that seams the plate into the
                    territory chain. Snapping (hex centers for boxes,
                    vertices for lines) keeps strokes on the lattice.
   The canvas has a top-right zoom control (crisp re-render).

   Saving posts a partial update to PUT /api/table-location/:id.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "@/components/forms/submit";
import { absoluteHex, formatHexScale } from "@/lib/location";
import { centerOf, gridSize, hexFromPoint } from "@/lib/hexgrid";
import {
  ASSETS,
  ASSET_BOX,
  drawAssetShape,
  drawShapes,
  hitDrawShapes,
  normalizeShapeToHexR,
  paintCanvas,
  screenToGrid,
  shiftShape,
  snapNormalized,
  toNormalized,
  traceCell,
  withRotated,
  type GridSpec,
  type Point,
} from "@/lib/canvasgrid";
import ZoomControls from "@/components/map/ZoomControls";
import type { DrawAssetKind, DrawShape, HexTile, HexTileKind, Location } from "@/lib/types";
import { TERRAIN } from "@/lib/terrain";

const R = 24;
const M = 48;
const HEX_NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]] as const;

const STROKES = ["#e4e4e7", "#38bdf8", "#fbbf24", "#f87171", "#4ade80", "#a78bfa"];
const STROKE_WEIGHTS = [1, 1.6, 2.5, 4, 6];
const WALL_BRIGHT = "#e4e4e7";

type Tool = "select" | "paint" | "erase" | "fill" | "pen" | "line" | "rect" | "ellipse" | "asset";
type ShapeType = "path" | "rect" | "ellipse" | "line";

interface MapStudioProps {
  location: Location;
}

export default function MapStudio({ location }: MapStudioProps) {
  const router = useRouter();
  const h = location.hex;

  const [cols, setCols] = useState(Math.max(1, Math.floor(h?.width ?? 12)));
  const [rows, setRows] = useState(Math.max(1, Math.floor(h?.height ?? 9)));
  const [orientation, setOrientation] = useState<string>(h?.orientation ?? "flat");
  const [sizeM, setSizeM] = useState<string>(h?.sizeM != null ? String(h.sizeM) : "1");
  const [rotationDeg, setRotationDeg] = useState<number>(h?.rotationDeg ?? 0);
  const [centerQ, setCenterQ] = useState<number>(h?.centerQ ?? 0);
  const [centerR, setCenterR] = useState<number>(h?.centerR ?? 0);
  const [isIndoor, setIsIndoor] = useState(!!location.isIndoor);

  const [tool, setTool] = useState<Tool>("select");
  const [terrain, setTerrain] = useState<HexTileKind>("wall");
  const [strokeColor, setStrokeColor] = useState(STROKES[0]);
  const [strokeWeight, setStrokeWeight] = useState(STROKE_WEIGHTS[2]);
  const [snap, setSnap] = useState(true);
  const [assetKind, setAssetKind] = useState<DrawAssetKind>("door");
  const [assetScale, setAssetScale] = useState(1);
  const [assetRot, setAssetRot] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [tiles, setTiles] = useState<Map<string, HexTileKind>>(() => {
    const m = new Map<string, HexTileKind>();
    for (const t of location.tiles ?? []) m.set(`${t.q},${t.r}`, t.t);
    return m;
  });
  const [shapes, setShapes] = useState<DrawShape[]>(() => (location.drawing ?? []).map(normalizeShapeToHexR));
  const [draft, setDraft] = useState<DrawShape | null>(null);
  const [selection, setSelection] = useState<number | null>(null);

  const [hover, setHover] = useState<{ q: number; r: number } | null>(null);
  const [crosshair, setCrosshair] = useState<Point | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const dragRef = useRef<{ index: number; anchor: Point; grab: Point } | null>(null);
  const paintCellRef = useRef<string | null>(null);
  const snapRef = useRef<{ tiles: Map<string, HexTileKind>; shapes: DrawShape[] } | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const sizeNum = sizeM === "" ? null : Number(sizeM);
  const abs = useMemo(
    () =>
      absoluteHex({
        id: location.id,
        name: location.name,
        hex: { sizeM: sizeNum, centerQ, centerR, orientation },
        ancestors: location.ancestors,
      }),
    [location.id, location.name, location.ancestors, sizeNum, centerQ, centerR, orientation]
  );

  const g = gridSize(cols, rows, orientation, R);
  const W = g.w + M * 2;
  const H = g.h + M * 2;
  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);

  const spec: GridSpec = useMemo(() => ({ cols, rows, orientation, R, M, rotationDeg }), [cols, rows, orientation, rotationDeg]);

  /* ---------- helpers ---------- */

  const toGridPoint = useCallback(
    (e: React.PointerEvent): Point => {
      const cv = canvasRef.current;
      if (!cv) return { x: 0, y: 0 };
      const rect = cv.getBoundingClientRect();
      const p = screenToGrid(e.clientX, e.clientY, rect, W, H, spec);
      return { x: p.x, y: p.y };
    },
    [W, H, spec]
  );

  const cellAt = useCallback(
    (p: Point): { q: number; r: number } | null => {
      const cell = hexFromPoint(p.x, p.y, orientation, R);
      if (cell.q < 0 || cell.q >= cols || cell.r < 0 || cell.r >= rows) return null;
      return cell;
    },
    [orientation, cols, rows]
  );

  /** Normalized point (hexR units) with optional lattice snap for shape tools. */
  const shapePoint = useCallback(
    (e: React.PointerEvent): Point => {
      const p = toGridPoint(e);
      const n = toNormalized(p, R);
      if (!snap) return n;
      if (tool === "line") return snapNormalized(n, spec, "vertex");
      if (tool === "rect" || tool === "ellipse") return snapNormalized(n, spec, "center");
      return n;
    },
    [toGridPoint, snap, tool, spec]
  );

  const stamp = useCallback(
    (cell: { q: number; r: number }) => {
      const key = `${cell.q},${cell.r}`;
      if (paintCellRef.current === key) return;
      paintCellRef.current = key;
      setTiles((prev) => {
        const next = new Map(prev);
        if (tool === "erase") next.delete(key);
        else next.set(key, terrain);
        return next;
      });
    },
    [tool, terrain]
  );

  const takeSnapshot = useCallback(() => {
    snapRef.current = { tiles: new Map(tiles), shapes };
    setCanUndo(true);
  }, [tiles, shapes]);

  /** Paint-style flood fill: replace a contiguous region of one floor type. */
  const floodCell = useCallback(
    (start: { q: number; r: number }) => {
      const startKey = `${start.q},${start.r}`;
      const base = tiles.get(startKey) ?? "open";
      if (base === terrain) return;
      const queue = [start];
      const seen = new Set<string>([startKey]);
      const next = new Map(tiles);
      while (queue.length) {
        const cur = queue.pop()!;
        next.set(`${cur.q},${cur.r}`, terrain);
        for (const [dq, dr] of HEX_NEIGHBORS) {
          const q2 = cur.q + dq;
          const r2 = cur.r + dr;
          const k2 = `${q2},${r2}`;
          if (q2 < 0 || q2 >= cols || r2 < 0 || r2 >= rows || seen.has(k2)) continue;
          seen.add(k2);
          if ((tiles.get(k2) ?? "open") === base) queue.push({ q: q2, r: r2 });
        }
      }
      setTiles(next);
    },
    [tiles, terrain, cols, rows]
  );

  /* ---------- pointer handlers ---------- */

  function onPointerDown(e: React.PointerEvent) {
    const p = toGridPoint(e);
    const n = toNormalized(p, R);
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    originRef.current = n;
    paintCellRef.current = null;

    if (tool === "paint" || tool === "erase") {
      const cell = cellAt(p);
      if (cell) {
        takeSnapshot();
        stamp(cell);
      }
      return;
    }

    if (tool === "fill") {
      const cell = cellAt(p);
      if (cell) {
        takeSnapshot();
        floodCell(cell);
      }
      return;
    }

    if (tool === "asset") {
      const cell = cellAt(p);
      if (cell) {
        takeSnapshot();
        const cn = centerOf(cell.q, cell.r, orientation, 1);
        const shape: DrawShape = {
          type: "asset",
          kind: assetKind,
          x: cn.x,
          y: cn.y,
          s: assetScale,
          rot: assetRot,
          size: 1,
          color: strokeColor,
          unit: "hexR",
        };
        setShapes((prev) => [...prev, shape]);
        setSelection(shapes.length);
      }
      return;
    }

    if (tool === "select") {
      const idx = hitDrawShapes(shapes, n, 1, 6 / R);
      if (idx != null) {
        takeSnapshot();
        const target = shapes[idx];
        const anchor =
          target.type === "path"
            ? shapeAnchor(shapes, idx, n)
            : {
                x: target.type === "ellipse" ? target.cx ?? 0 : target.x ?? 0,
                y: target.type === "ellipse" ? target.cy ?? 0 : target.y ?? 0,
              };
        dragRef.current = { index: idx, anchor, grab: { x: n.x - anchor.x, y: n.y - anchor.y } };
        setSelection(idx);
      } else {
        dragRef.current = null;
        setSelection(null);
      }
      return;
    }

    takeSnapshot();
    if (tool === "pen") {
      setDraft({ type: "path", d: `M ${n.x.toFixed(3)} ${n.y.toFixed(3)}`, size: strokeWeight, color: strokeColor, unit: "hexR" });
    } else {
      const s = shapePoint(e);
      originRef.current = s;
      setDraft({ type: tool as ShapeType, x: s.x, y: s.y, w: 0, h: 0, size: strokeWeight, color: strokeColor, unit: "hexR" });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toGridPoint(e);
    setCrosshair(p);

    if (drawingRef.current && (tool === "paint" || tool === "erase")) {
      const cell = cellAt(p);
      if (cell) stamp(cell);
    }

    if (drawingRef.current && dragRef.current && tool === "select") {
      const n = toNormalized(p, R);
      const d = dragRef.current;
      const anchor = { x: n.x - d.grab.x, y: n.y - d.grab.y };
      const dx = anchor.x - d.anchor.x;
      const dy = anchor.y - d.anchor.y;
      if (Math.abs(dx) > 0.0001 || Math.abs(dy) > 0.0001) {
        setShapes((prev) => {
          const next = prev.slice();
          const idx = d.index;
          if (idx >= 0 && idx < next.length) next[idx] = shiftShape(next[idx], dx, dy);
          return next;
        });
      }
      return;
    }

    if (drawingRef.current && draft) {
      const o = originRef.current;
      if (draft.type === "path") {
        const n = toNormalized(p, R);
        setDraft({ ...draft, d: `${draft.d ?? ""} L ${n.x.toFixed(3)} ${n.y.toFixed(3)}` });
      } else {
        const s = shapePoint(e);
        const x = Math.min(o.x, s.x);
        const y = Math.min(o.y, s.y);
        const w = Math.abs(s.x - o.x);
        const h = Math.abs(s.y - o.y);
        setDraft({
          ...draft,
          x,
          y,
          w,
          h,
          cx: (o.x + s.x) / 2,
          cy: (o.y + s.y) / 2,
          rx: w / 2,
          ry: h / 2,
        });
      }
      return;
    }

    const cell = cellAt(p);
    setHover(cell);
  }

  function onPointerUp() {
    drawingRef.current = false;
    paintCellRef.current = null;
    dragRef.current = null;
    if (draft) {
      setShapes((prev) => [...prev, draft]);
      setSelection(shapes.length);
      setDraft(null);
    }
  }

  function onPointerLeave() {
    setHover(null);
    setCrosshair(null);
  }

  /* ---------- keyboard shortcuts (delete selection) ---------- */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection != null) {
        e.preventDefault();
        setShapes((prev) => prev.filter((_, i) => i !== selection));
        setSelection(null);
      } else if (e.key === "Escape") {
        setSelection(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  /* ---------- actions ---------- */

  function undo() {
    if (!snapRef.current) return;
    setTiles(snapRef.current.tiles);
    setShapes(snapRef.current.shapes);
    snapRef.current = null;
    setCanUndo(false);
    setSelection(null);
  }

  function updateSelected(patch: Partial<DrawShape>) {
    setShapes((prev) => {
      const next = prev.slice();
      if (selection != null && next[selection]) next[selection] = { ...next[selection], ...patch };
      return next;
    });
  }

  function clearTiles() {
    takeSnapshot();
    setTiles(new Map());
  }

  function clearStrokes() {
    takeSnapshot();
    setShapes([]);
    setSelection(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const outTiles: HexTile[] = [];
    for (const [key, t] of tiles) {
      const [q, r] = key.split(",").map(Number);
      if (q < 0 || q >= cols || r < 0 || r >= rows) continue;
      outTiles.push({ q, r, t });
    }
    try {
      await submitJson(`/api/table-location/${location.id}`, "PUT", {
        id: location.id,
        hex: {
          sizeM: sizeNum,
          width: cols,
          height: rows,
          centerQ,
          centerR,
          orientation,
          rotationDeg,
        },
        is_indoor: isIndoor ? 1 : 0,
        tiles: outTiles,
        drawing: shapes,
      });
      setSavedAt(Date.now());
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o mapa.");
    } finally {
      setSaving(false);
    }
  }

  /* ---------- canvas render ---------- */

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    paintCanvas(cv, W, H, (ctx) => {
      const tileMap = tiles;

      withRotated(ctx, W, H, rotationDeg, () => {
        /* cells */
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const key = `${c},${r}`;
            const pt = centerOf(c, r, orientation, R);
            const cx = M + pt.x;
            const cy = M + pt.y;
            const meta = TERRAIN[tileMap.get(key) ?? "open"];
            const isCenter = c === centerCol && r === centerRow;
            const isHover = hover?.q === c && hover?.r === r;
            traceCell(ctx, cx, cy, R, orientation);
            ctx.fillStyle = isHover ? `${STROKES[0]}14` : meta.fill;
            ctx.fill();
            ctx.strokeStyle = isHover ? STROKES[0] : isCenter ? TERRAIN.door.stroke : meta.stroke;
            ctx.lineWidth = isHover || isCenter ? 1.8 : 1;
            ctx.stroke();

            if (meta.glyph) {
              ctx.fillStyle = meta.stroke;
              ctx.font = `bold ${Math.max(9, R * 0.46)}px "Geist Mono", monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(meta.glyph, cx, cy);
            }
            if (isCenter) {
              ctx.fillStyle = "#8b93a5";
              ctx.font = `${Math.max(8, R * 0.375)}px "Geist Mono", monospace`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(`q${centerQ} r${centerR}`, cx, cy + (meta.glyph ? R * 0.42 : 0));
            }
          }
        }

        /* strokes + draft + selection */
        drawShapes(ctx, shapes, R, selection, "#38bdf8");
        if (draft) drawShapes(ctx, [draft], R, null);

        /* brush highlight on hovered cell */
        if ((tool === "paint" || tool === "erase" || tool === "fill") && hover) {
          const pt = centerOf(hover.q, hover.r, orientation, R);
          traceCell(ctx, M + pt.x, M + pt.y, R, orientation);
          ctx.strokeStyle = tool === "erase" ? "#f87171" : TERRAIN[terrain].stroke;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        /* asset drop target + ghost on hovered cell */
        if (tool === "asset" && hover) {
          const pt = centerOf(hover.q, hover.r, orientation, R);
          const cx = M + pt.x;
          const cy = M + pt.y;
          traceCell(ctx, cx, cy, R, orientation);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
          drawAssetShape(ctx, { type: "asset", kind: assetKind, x: pt.x, y: pt.y, s: assetScale, rot: assetRot, size: 1, color: strokeColor, unit: "hexR" }, R);
        }

        /* snap crosshair while drawing box/line tools */
        if (drawingRef.current && (tool === "line" || tool === "rect" || tool === "ellipse") && crosshair) {
          const n = snapNormalized(toNormalized(crosshair, R), spec, tool === "line" ? "vertex" : "center");
          const sx = n.x * R;
          const sy = n.y * R;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }, zoom);
  }, [shapes, tiles, draft, selection, hover, crosshair, tool, terrain, strokeColor, rotationDeg, W, H, cols, rows, centerCol, centerRow, centerQ, centerR, orientation, spec, snap, zoom, assetKind, assetScale, assetRot]);

  /* ---------- derived UI ---------- */

  const hoverCell = hover;
  const hoverAbs = hoverCell
    ? { q: Math.round((abs.q + (hoverCell.q - centerCol)) * 100) / 100, r: Math.round((abs.r + (hoverCell.r - centerRow)) * 100) / 100 }
    : null;

  const activeShape = selection != null && shapes[selection] ? shapes[selection] : null;

  return (
    <section className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 overflow-hidden">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="font-mono text-base leading-none text-amber-300">◉</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">Map studio</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 hidden sm:inline">
            {cols}×{rows} · {orientation} · {formatHexScale(sizeNum)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {savedAt > 0 ? (
            <span className="font-mono text-[9px] uppercase tracking-widest text-emerald-400">Saved ✓</span>
          ) : null}
          <button type="button" onClick={undo} disabled={!canUndo} className="font-mono text-[9px] uppercase tracking-widest px-2 py-1.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={clearTiles} className="font-mono text-[9px] uppercase tracking-widest px-2 py-1.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-red-300 transition-colors">
            Clear tiles
          </button>
          <button type="button" onClick={clearStrokes} className="font-mono text-[9px] uppercase tracking-widest px-2 py-1.5 rounded border border-zinc-700/50 text-zinc-400 hover:text-red-300 transition-colors">
            Clear strokes
          </button>
          <button type="button" onClick={save} disabled={saving} className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-amber-50 text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
            {saving ? "Saving…" : "Save map"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        {/* control rail */}
        <div className="border-b lg:border-b-0 lg:border-r border-zinc-800 p-4 space-y-5">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Tool</p>
            <div className="grid grid-cols-4 gap-1.5">
              {([
                ["select", "✛", "Select"],
                ["paint", "▦", "Paint"],
                ["erase", "⌫", "Erase"],
                ["fill", "≋", "Fill"],
                ["pen", "✎", "Pen"],
                ["line", "╱", "Line"],
                ["rect", "▭", "Rect"],
                ["ellipse", "◯", "Ellipse"],
                ["asset", "⬒", "Asset"],
              ] as [Tool, string, string][]).map(([t, icon, label]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTool(t)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-colors ${
                    tool === t ? "border-amber-500/70 bg-amber-500/10 text-amber-300" : "border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span className="text-sm leading-none">{icon}</span>
                  <span className="font-mono text-[8px] uppercase tracking-widest">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {tool === "select" ? (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Selection</p>
              <div className="space-y-2">
                <p className="text-[10px] leading-snug text-zinc-500">
                  {activeShape ? (
                    <>
                      <b className="text-zinc-300">{activeShape.type === "asset" ? `${ASSETS.includes(activeShape.kind ?? "crate") ? (activeShape.kind ?? "crate") : "asset"} asset` : activeShape.type}</b> selected — drag to move,{" "}
                      <b className="text-red-300">Del</b> remove.
                    </>
                  ) : (
                    "Click a stroke or asset to select it. Drag to move, Del/Backspace to remove."
                  )}
                </p>

                {activeShape ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {activeShape.type === "asset" ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelected({ s: Math.max(0.4, Math.round(((activeShape.s ?? 1) - 0.15) * 100) / 100) })
                          }
                          className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          − Size
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelected({ s: Math.min(3, Math.round(((activeShape.s ?? 1) + 0.15) * 100) / 100) })
                          }
                          className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          + Size
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelected({ rot: ((activeShape.rot ?? 0) - 15 + 360) % 360 })}
                          className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          ↺ Rotate
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSelected({ rot: ((activeShape.rot ?? 0) + 15) % 360 })}
                          className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          ↻ Rotate
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        updateSelected({
                          color:
                            activeShape.type === "asset"
                              ? STROKES[(STROKES.indexOf(activeShape.color) + 1) % STROKES.length] ?? STROKES[0]
                              : activeShape.color === WALL_BRIGHT
                              ? "#fbbf24"
                              : activeShape.color === "#fbbf24"
                              ? "#f87171"
                              : WALL_BRIGHT,
                        })
                      }
                      className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 rounded border border-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Recolor
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {tool === "asset" ? (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Asset catalog</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ASSETS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAssetKind(k)}
                      title={ASSET_LABELS[k]}
                      className={`flex flex-col items-center gap-0.5 rounded-md border px-1 py-1 transition-colors ${
                        assetKind === k ? "border-amber-500/70 bg-amber-500/10" : "border-zinc-700/40 hover:border-zinc-600"
                      }`}
                    >
                      <AssetPreview kind={k} dim={assetKind !== k} />
                      <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-500 truncate w-full text-center">{ASSET_LABELS[k]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Stroke</p>
                <div className="flex flex-wrap gap-1.5">
                  {STROKES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStrokeColor(c)}
                      className={`h-6 w-6 rounded-full border transition-transform ${strokeColor === c ? "scale-110 border-zinc-200" : "border-zinc-700"}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Scale · {assetScale.toFixed(2)}×</p>
                <input
                  type="range"
                  min={0.4}
                  max={2.5}
                  step={0.1}
                  value={assetScale}
                  onChange={(e) => setAssetScale(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Rotation · {((assetRot % 360) + 360) % 360}°</p>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAssetRot((assetRot - 15 + 360) % 360)}
                    className="rounded-md border border-zinc-700/40 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    ↺ 15°
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetRot((assetRot + 15) % 360)}
                    className="rounded-md border border-zinc-700/40 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    15° ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetRot(0)}
                    className="rounded-md border border-zinc-700/40 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    0°
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">Click a hex to place. Switch to Select to move / scale / rotate / delete placed assets.</p>
              </div>
            </div>
          ) : null}

          {tool === "paint" ? (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Terrain</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(TERRAIN).map(([k, meta]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTerrain(k as HexTileKind)}
                    title={meta.label}
                    className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 transition-colors ${
                      terrain === k ? "border-amber-500/70 bg-amber-500/10" : "border-zinc-700/40 hover:border-zinc-600"
                    }`}
                  >
                    <span
                      className="block h-3.5 w-3.5 rounded-sm border shrink-0"
                      style={{ backgroundColor: meta.fill, borderColor: meta.stroke }}
                    />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-400 truncate">{meta.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tool === "pen" || tool === "line" || tool === "rect" || tool === "ellipse" ? (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Stroke</p>
                <div className="flex flex-wrap gap-1.5">
                  {STROKES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStrokeColor(c)}
                      className={`h-6 w-6 rounded-full border transition-transform ${strokeColor === c ? "scale-110 border-zinc-200" : "border-zinc-700"}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Weight</p>
                <div className="flex flex-wrap gap-1.5">
                  {STROKE_WEIGHTS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setStrokeWeight(w)}
                      className={`h-7 w-7 rounded-md border flex items-center justify-center transition-colors ${
                        strokeWeight === w ? "border-amber-500/70 bg-amber-500/10" : "border-zinc-700/40 hover:border-zinc-600"
                      }`}
                      title={`${w}px`}
                    >
                      <span className="block rounded-full" style={{ width: Math.max(2, w), height: Math.max(2, w), backgroundColor: strokeColor }} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setSnap((s) => !s)}
                  className={`w-full rounded-md border px-2 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${
                    snap ? "border-amber-500/70 bg-amber-500/10 text-amber-300" : "border-zinc-700/40 text-zinc-500"
                  }`}
                >
                  Snap to grid {snap ? "on" : "off"}
                </button>
                <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">Lines snap to hex vertices; boxes snap to hex centers.</p>
              </div>
            </div>
          ) : null}

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Indoor / dungeon</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setIsIndoor(false)}
                className={`rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${!isIndoor ? "border-amber-500/70 bg-amber-500/10 text-amber-300" : "border-zinc-700/40 text-zinc-500"}`}
              >
                Exterior
              </button>
              <button
                type="button"
                onClick={() => setIsIndoor(true)}
                className={`rounded-md border px-1.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${isIndoor ? "border-amber-500/70 bg-amber-500/10 text-amber-300" : "border-zinc-700/40 text-zinc-500"}`}
              >
                Interior
              </button>
            </div>
            {isIndoor ? (
              <p className="mt-1.5 text-[10px] leading-snug text-zinc-500">Dungeon / building — walls and doors read clearly on dark stone.</p>
            ) : null}
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-2">Grid</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">Width</span>
                <input type="number" min={1} max={40} value={cols} onChange={(e) => setCols(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100" />
              </label>
              <label className="block">
                <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">Height</span>
                <input type="number" min={1} max={40} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100" />
              </label>
              <label className="block">
                <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">Hex (m)</span>
                <input type="number" step="0.1" min="0" value={sizeM} onChange={(e) => setSizeM(e.target.value)} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100" />
              </label>
              <label className="block">
                <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">Rotation °</span>
                <input type="number" step="15" value={rotationDeg} onChange={(e) => setRotationDeg(Number(e.target.value) || 0)} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100" />
              </label>
              <label className="block col-span-2">
                <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-600 mb-0.5">Orientation</span>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded px-2 py-1 text-sm text-zinc-100">
                  <option value="flat">Flat-top</option>
                  <option value="pointy">Pointy-top</option>
                  <option value="square">Square grid</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {/* canvas */}
        <div className="p-4">
          <div className="relative overflow-auto rounded-lg border border-zinc-700/40 bg-zinc-950/50">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="block mx-auto touch-none select-none cursor-crosshair"
              style={{
                width: `${Math.round(W * zoom)}px`,
                height: `${Math.round(H * zoom)}px`,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerLeave}
              onPointerCancel={onPointerUp}
              role="img"
              aria-label="Tactical map editor canvas"
            />
            <ZoomControls zoom={zoom} onZoom={setZoom} min={0.5} max={4} step={0.25} />

            {error ? <p className="absolute inset-x-0 bottom-0 bg-red-950/90 text-red-200 text-xs px-3 py-2">{error}</p> : null}
          </div>

          {/* status bar */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span>
              Cell <b className="text-zinc-300">{hoverCell ? `q${hoverCell.q} r${hoverCell.r}` : "—"}</b>
            </span>
            <span>
              Abs <b className="text-zinc-300">{hoverAbs ? `q${hoverAbs.q} r${hoverAbs.r}` : `q${abs.q} r${abs.r}`}</b>
            </span>
            <span>
              Scale <b className="text-zinc-300">{formatHexScale(sizeNum)}</b>
            </span>
            <span>
              Strokes <b className="text-zinc-300">{shapes.length}</b>
            </span>
            <span>
              Chain <b className="text-zinc-400 truncate max-w-[16rem] inline-block align-top">
                {(location.ancestors ?? []).map((a) => a.name).join(" › ") || "—"}
              </b>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Initial anchor of a path shape (its first vertex), for Select-drag. */
function shapeAnchor(shapes: DrawShape[], idx: number, fallback: Point): Point {
  const s = shapes[idx];
  if (s.type === "path") {
    const segs = s.d?.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
    if (segs && segs.length >= 2) return { x: Number(segs[0]), y: Number(segs[1]) };
  }
  return fallback;
}

/* ---------- asset preview ---------- */

const ASSET_LABELS: Record<DrawAssetKind, string> = {
  door: "Door", chest: "Chest", table: "Table", chair: "Chair", bed: "Bed",
  barrel: "Barrel", crate: "Crate", bookcase: "Bookcase", brazier: "Brazier",
  torch: "Torch", altar: "Altar", statue: "Statue", tree: "Tree", rock: "Rock",
  well: "Well", rug: "Rug", stairs: "Stairs", fountain: "Fountain",
};

/** Tiny live vector preview of an asset stamp. */
function AssetPreview({ kind, dim = false }: { kind: DrawAssetKind; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const meta = ASSET_BOX[kind];
    const k = Math.max(6, 28 / Math.max(meta.w, meta.h));
    paintCanvas(cv, 40, 40, (ctx) => {
      drawAssetShape(ctx, { type: "asset", kind, x: 0, y: 0, s: 1, rot: 0, size: 1, color: "#d4d4d8", unit: "hexR" }, k);
    });
  }, [kind]);
  return <canvas ref={ref} width={40} height={40} className={`block w-10 h-10 ${dim ? "opacity-45" : ""}`} aria-hidden />;
}