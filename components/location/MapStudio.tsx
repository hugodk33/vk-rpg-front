"use client";

/* ============================================================
   MapStudio — the full plate editor for a battlemap location.
   Layers, back to front:

   1. HEX TILES   — paint terrain onto each cell (open/grass/water/
                    forest/stone/wall/door/rubble). The tilemap is a
                    list of { q, r, t } in the plate's own grid.
   2. DRAWING     — SVG strokes over the grid: pen, line, rect,
                    ellipse, in a chosen color and weight. Stored as
                    { type, …geometry, size, color }.
   3. GRID        — footprint, orientation, hex scale, rotation and
                    the center cell (q,r) that seams the plate into
                    the territory chain (multi-scale absolute coords
                    shown live under the cursor).

   Saving posts a partial update to PUT /api/table-location/:id —
   the repository keeps every field the studio does not touch.
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "@/components/forms/submit";
import { absoluteHex, formatHexScale } from "@/lib/location";
import {
  centerOf,
  gridSize,
  hexFromPoint,
  polygonPath,
  rotatePoint,
} from "@/lib/hexgrid";
import type { DrawShape, HexTile, HexTileKind, Location } from "@/lib/types";
import { TERRAIN } from "@/lib/terrain";

const R = 24;
const M = 48;

const STROKES = ["#e4e4e7", "#38bdf8", "#fbbf24", "#f87171", "#4ade80", "#a78bfa"];
const STROKE_WEIGHTS = [1, 1.6, 2.5, 4, 6];

type Tool = "paint" | "erase" | "pen" | "line" | "rect" | "ellipse";
type ShapeType = "path" | "rect" | "ellipse";

interface Point {
  x: number;
  y: number;
}

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

  const [tool, setTool] = useState<Tool>("paint");
  const [terrain, setTerrain] = useState<HexTileKind>("wall");
  const [strokeColor, setStrokeColor] = useState(STROKES[0]);
  const [strokeWeight, setStrokeWeight] = useState(STROKE_WEIGHTS[2]);

  const [tiles, setTiles] = useState<Map<string, HexTileKind>>(() => {
    const m = new Map<string, HexTileKind>();
    for (const t of location.tiles ?? []) m.set(`${t.q},${t.r}`, t.t);
    return m;
  });
  const [shapes, setShapes] = useState<DrawShape[]>(location.drawing ?? []);
  const [draft, setDraft] = useState<DrawShape | null>(null);

  const [hover, setHover] = useState<{ q: number; r: number } | null>(null);
  const [crosshair, setCrosshair] = useState<Point | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number>(0);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const drawingRef = useRef(false);
  const originRef = useRef<Point>({ x: 0, y: 0 });
  const snapRef = useRef<{ tiles: Map<string, HexTileKind>; shapes: DrawShape[] } | null>(null);
  const paintCellRef = useRef<string | null>(null);
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
  const pivot = { x: W / 2, y: H / 2 };
  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);

  /* ---------- helpers ---------- */

  const toGrid = useCallback(
    (e: React.PointerEvent): Point => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const p = rotatePoint({ x: x - M, y: y - M }, { x: pivot.x - M, y: pivot.y - M }, -rotationDeg);
      return { x: p.x, y: p.y };
    },
    [W, rotationDeg]
  );

  const cellAt = useCallback(
    (p: Point): { q: number; r: number } | null => {
      const cell = hexFromPoint(p.x, p.y, orientation, R);
      if (cell.q < 0 || cell.q >= cols || cell.r < 0 || cell.r >= rows) return null;
      return cell;
    },
    [orientation, R, cols, rows]
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

  const snap = useCallback(() => {
    snapRef.current = { tiles: new Map(tiles), shapes };
    setCanUndo(true);
  }, [tiles, shapes]);

  /* ---------- pointer handlers ---------- */

  function onPointerDown(e: React.PointerEvent) {
    const p = toGrid(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    originRef.current = p;
    paintCellRef.current = null;

    if (tool === "paint" || tool === "erase") {
      const cell = cellAt(p);
      if (cell) {
        snap();
        stamp(cell);
      }
      return;
    }

    if (tool === "pen") {
      snap();
      setDraft({ type: "path", d: `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`, size: strokeWeight, color: strokeColor });
    } else {
      snap();
      setDraft({ type: tool === "rect" ? "rect" : (tool === "ellipse" ? "ellipse" : "line") as ShapeType, x: p.x, y: p.y, w: 0, h: 0, size: strokeWeight, color: strokeColor });
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = toGrid(e);
    setCrosshair(p);

    if (drawingRef.current && tool === "paint" || drawingRef.current && tool === "erase") {
      const cell = cellAt(p);
      if (cell) stamp(cell);
    }

    if (drawingRef.current && draft) {
      const o = originRef.current;
      if (draft.type === "path") {
        setDraft({ ...draft, d: `${draft.d ?? ""} L ${p.x.toFixed(2)} ${p.y.toFixed(2)}` });
      } else {
        const x = Math.min(o.x, p.x);
        const y = Math.min(o.y, p.y);
        const w = Math.abs(p.x - o.x);
        const h = Math.abs(p.y - o.y);
        setDraft({
          ...draft,
          x,
          y,
          w,
          h,
          cx: (o.x + p.x) / 2,
          cy: (o.y + p.y) / 2,
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
    if (draft) {
      setShapes((prev) => [...prev, draft]);
      setDraft(null);
    }
  }

  function onPointerLeave() {
    setHover(null);
    setCrosshair(null);
  }

  /* ---------- actions ---------- */

  function undo() {
    if (!snapRef.current) return;
    setTiles(snapRef.current.tiles);
    setShapes(snapRef.current.shapes);
    snapRef.current = null;
    setCanUndo(false);
  }

  function clearTiles() {
    snapRef.current = { tiles: new Map(tiles), shapes };
    setCanUndo(true);
    setTiles(new Map());
  }

  function clearStrokes() {
    snapRef.current = { tiles: new Map(tiles), shapes };
    setCanUndo(true);
    setShapes([]);
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

  /* ---------- render ---------- */

  const cellNodes: React.ReactNode[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const key = `${c},${r}`;
      const pt = centerOf(c, r, orientation, R);
      const cx = M + pt.x;
      const cy = M + pt.y;
      const t = tiles.get(key) ?? "open";
      const meta = TERRAIN[t];
      const isCenter = c === centerCol && r === centerRow;
      const isHover = hover?.q === c && hover?.r === r;
      cellNodes.push(
        <polygon
          key={key}
          points={polygonPath(cx, cy, R, orientation)}
          fill={isHover ? `${STROKES[0]}14` : meta.fill}
          stroke={isHover ? STROKES[0] : isCenter ? TERRAIN.door.stroke : meta.stroke}
          strokeWidth={isHover || isCenter ? 1.8 : 1}
        />
      );
      if (meta.glyph) {
        cellNodes.push(
          <text
            key={`g-${key}`}
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Geist Mono, monospace"
            fontSize="11"
            fontWeight="bold"
            fill={meta.stroke}
          >
            {meta.glyph}
          </text>
        );
      }
      if (isCenter) {
        cellNodes.push(
          <text
            key={`c-${key}`}
            x={cx}
            y={cy + (meta.glyph ? 10 : 0)}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Geist Mono, monospace"
            fontSize="9"
            fill={meta.glyph ? "#00000066" : "#8b93a5"}
          >
            {meta.glyph ? `q${centerQ} r${centerR}` : `q${centerQ} r${centerR}`}
          </text>
        );
      }
    }
  }

  const hoverCell = hover;
  const hoverAbs = hoverCell
    ? { q: Math.round((abs.q + (hoverCell.q - centerCol)) * 100) / 100, r: Math.round((abs.r + (hoverCell.r - centerRow)) * 100) / 100 }
    : null;

  const brush = (tool === "paint" || tool === "erase") && hoverCell
    ? polygonPath(M + centerOf(hoverCell.q, hoverCell.r, orientation, R).x, M + centerOf(hoverCell.q, hoverCell.r, orientation, R).y, R, orientation)
    : null;

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
            <div className="grid grid-cols-3 gap-1.5">
              {([
                ["paint", "▦", "Paint"],
                ["erase", "⌫", "Erase"],
                ["pen", "✎", "Pen"],
                ["line", "╱", "Line"],
                ["rect", "▭", "Rect"],
                ["ellipse", "◯", "Ellipse"],
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

          {(tool === "paint") ? (
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
          <div className="rounded-lg border border-zinc-700/40 bg-zinc-950/50 overflow-hidden relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto block touch-none select-none cursor-crosshair"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerLeave}
              role="img"
              aria-label="Tactical map editor canvas"
            >
              <g transform={`rotate(${rotationDeg} ${pivot.x} ${pivot.y})`}>
                {cellNodes}
              </g>

              {/* drawing layer (same grid space as cells) */}
              <g transform={`rotate(${rotationDeg} ${pivot.x} ${pivot.y})`} pointerEvents="none">
                {shapes.map((s, i) => (
                  <DrawNode key={i} shape={s} />
                ))}
                {draft ? <DrawNode shape={draft} /> : null}
              </g>

              {/* brush highlight */}
              {brush ? (
                <polygon points={brush} fill="none" stroke={tool === "erase" ? "#f87171" : TERRAIN[terrain].stroke} strokeWidth={2} strokeDasharray="4 3" pointerEvents="none" />
              ) : null}
            </svg>

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

function DrawNode({ shape }: { shape: DrawShape }) {
  const common = {
    fill: "none",
    stroke: shape.color,
    strokeWidth: shape.size,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    pointerEvents: "none" as const,
  };
  if (shape.type === "path") {
    return <path {...common} d={shape.d ?? ""} />;
  }
  if (shape.type === "rect") {
    return <rect {...common} x={shape.x ?? 0} y={shape.y ?? 0} width={shape.w ?? 0} height={shape.h ?? 0} />;
  }
  return <ellipse {...common} cx={shape.cx ?? 0} cy={shape.cy ?? 0} rx={Math.max(0.1, shape.rx ?? 0)} ry={Math.max(0.1, shape.ry ?? 0)} />;
}