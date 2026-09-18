/* ============================================================
   canvasgrid — 2D <canvas> renderer for the tactical hex plates
   (TacticalPlate, LocationMap) and the MapStudio editor.

   Geometry comes from ./hexgrid (same grid math as the old SVG
   renderers) but output lands on a canvas:

     • terrain hex cells + tile glyphs
     • the narrator's stroke layer (rect/ellipse/line/path)
     • tokens (board snapshot), movement trail and target highlight
     • grid rotation about the plate pivot
     • client → grid coordinate mapping (rotation aware)
     • hit-testing + snap for the editor (select / move / delete)

   DRAWING COORDINATES
   The stroke layer stores normalized coordinates `unit:"hexR"`:
   1 unit = 1 hex radius, origin = center of hex (0,0). Legacy
   shapes without `unit` were authored in raw pixels at R = 24 and
   render scaled by R / 24, so both flavours stay glued to the
   cells at any viewer radius.
   ============================================================ */

import { centerOf, cellWidth, cellHeight, gridSize, hexFromPoint, polygonPath, rotatePoint } from "./hexgrid";
import { TERRAIN } from "./terrain";
import type { DrawShape, HexTile, HexTileKind } from "./types";

export type Point = { x: number; y: number };

/** Radius the legacy (non-normalized) stroke layer was authored at. */
export const LEGACY_R = 24;

export interface GridSpec {
  cols: number;
  rows: number;
  orientation: string;
  R: number;
  M: number;
  rotationDeg: number;
}

export interface CanvasPlate {
  W: number;
  H: number;
  spec: GridSpec;
}

/* -------------------------------- sizing -------------------------------- */

export function plateCanvas(hex: { width?: number | null; height?: number | null; orientation?: string }, R: number, M: number, minW = 0, minH = 0): CanvasPlate {
  const orientation = hex?.orientation ?? "flat";
  const cols = Math.max(1, Math.floor(hex?.width ?? 0) || 1);
  const rows = Math.max(1, Math.floor(hex?.height ?? 0) || 1);
  const g = gridSize(cols, rows, orientation, R);
  return {
    W: Math.max(g.w + M * 2, minW),
    H: Math.max(g.h + M * 2, minH),
    spec: { cols, rows, orientation, R, M, rotationDeg: 0 },
  };
}

export function pivotOf(W: number, H: number): Point {
  return { x: W / 2, y: H / 2 };
}

/** Fill the canvas backing store for the DPR and run the draw routine. */
export function paintCanvas(cv: HTMLCanvasElement, W: number, H: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  cv.width = Math.max(1, Math.round(W * dpr));
  cv.height = Math.max(1, Math.round(H * dpr));
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  draw(ctx);
}

/** Run `fn` with the context rotated about the plate pivot (SVG-equivalent). */
export function withRotated(ctx: CanvasRenderingContext2D, W: number, H: number, rotationDeg: number, fn: () => void): void {
  ctx.save();
  if (rotationDeg) {
    const p = pivotOf(W, H);
    ctx.translate(p.x, p.y);
    ctx.rotate((rotationDeg * Math.PI) / 180);
    ctx.translate(-p.x, -p.y);
  }
  fn();
  ctx.restore();
}

/* ------------------------- hex geometry (canvas) ------------------------- */

/** Vertex points of one hex cell centered at (cx, cy). */
export function hexPoints(cx: number, cy: number, R: number, orientation: string): Point[] {
  if (orientation === "square") {
    const s = R * 1.5;
    return [
      { x: cx - s / 2, y: cy - s / 2 },
      { x: cx + s / 2, y: cy - s / 2 },
      { x: cx + s / 2, y: cy + s / 2 },
      { x: cx - s / 2, y: cy + s / 2 },
    ];
  }
  const start = orientation === "pointy" ? 90 : 0;
  const pts: Point[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((start + 60 * k) * Math.PI) / 180;
    pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  return pts;
}

/** Trace the cell outline into the current path (no paint). */
export function traceCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, orientation: string): void {
  const pts = hexPoints(cx, cy, R, orientation);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/* ------------------------- stroke layer (drawing) ------------------------ */

export function shapeScale(shape: DrawShape, R: number): number {
  return shape.unit === "hexR" ? R : R / LEGACY_R;
}

export function strokeWeightPx(shape: DrawShape, R: number): number {
  return Math.max(0.5, shape.size * shapeScale(shape, R));
}

interface PathSeg {
  cmd: string;
  nums: number[];
}

export function parsePath(d: string | undefined): PathSeg[] {
  if (!d) return [];
  const toks = d.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?|[A-Za-z]/g) ?? [];
  const segs: PathSeg[] = [];
  let cur: PathSeg | null = null;
  const flush = () => {
    if (cur && cur.nums.length) segs.push(cur);
    cur = null;
  };
  for (const tok of toks) {
    if (/[A-Za-z]/.test(tok)) {
      flush();
      cur = { cmd: tok, nums: [] };
      if (tok.toLowerCase() === "z") segs.push(cur);
    } else if (cur) {
      cur.nums.push(Number(tok));
    }
  }
  flush();
  return segs;
}

/** Build the path for `d` scaled by `k`. Supports M/L/H/V/Z (the tool's output). */
export function tracePath(ctx: CanvasRenderingContext2D, d: string | undefined, k: number): boolean {
  const segs = parsePath(d);
  if (!segs.length) return false;
  ctx.beginPath();
  let pen: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let moved = false;
  for (const s of segs) {
    const cmd = s.cmd.toLowerCase();
    if (cmd === "z") {
      ctx.closePath();
      pen = { ...start };
      continue;
    }
    const abs = s.cmd === s.cmd.toUpperCase();
    const n = s.nums;
    if (cmd === "m" || cmd === "l") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        const nx = abs ? n[i] * k : pen.x + n[i] * k;
        const ny = abs ? n[i + 1] * k : pen.y + n[i + 1] * k;
        if (cmd === "m" && i === 0 && !moved) {
          ctx.moveTo(nx, ny);
          start = { x: nx, y: ny };
          moved = true;
        } else {
          ctx.lineTo(nx, ny);
        }
        pen = { x: nx, y: ny };
      }
    } else if (cmd === "h") {
      const nx = abs ? n[0] * k : pen.x + n[0] * k;
      ctx.lineTo(nx, pen.y);
      pen = { x: nx, y: pen.y };
    } else if (cmd === "v") {
      const ny = abs ? n[0] * k : pen.y + n[0] * k;
      ctx.lineTo(pen.x, ny);
      pen = { x: pen.x, y: ny };
    }
  }
  return true;
}

/** Draw a single shape in grid space (no margin — matches cell space). */
export function drawShape(ctx: CanvasRenderingContext2D, shape: DrawShape, R: number, selected = false, accent = "#38bdf8"): void {
  const k = shapeScale(shape, R);
  const lw = strokeWeightPx(shape, R);
  const x = (shape.x ?? 0) * k;
  const y = (shape.y ?? 0) * k;
  const w = (shape.w ?? 0) * k;
  const h = (shape.h ?? 0) * k;

  ctx.save();
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (shape.type === "rect") {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();
  } else if (shape.type === "ellipse") {
    const cx = (shape.cx ?? 0) * k;
    const cy = (shape.cy ?? 0) * k;
    const rx = Math.max(0.1, shape.rx ?? 0) * k;
    const ry = Math.max(0.1, shape.ry ?? 0) * k;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.type === "line") {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.stroke();
  } else if (shape.type === "path") {
    if (!tracePath(ctx, shape.d, k)) {
      ctx.restore();
      return;
    }
    ctx.stroke();
  }

  if (selected) {
    const p = shapeTypesBounds(shape, R);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

export function drawShapes(ctx: CanvasRenderingContext2D, shapes: DrawShape[], R: number, selectedIndex: number | null = null, accent = "#38bdf8"): void {
  for (let i = 0; i < shapes.length; i++) drawShape(ctx, shapes[i], R, i === selectedIndex, accent);
}

/** Bounding box (px, grid space) of a shape, for marquee / hit region. */
export function shapeTypesBounds(shape: DrawShape, R: number): { x: number; y: number; w: number; h: number } {
  const k = shapeScale(shape, R);
  if (shape.type === "path") {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const s of parsePath(shape.d)) {
      if (s.cmd.toLowerCase() === "z") continue;
      for (let i = 0; i + 1 < s.nums.length; i += 2) {
        const nx = s.nums[i] * k;
        const ny = s.nums[i + 1] * k;
        minX = Math.min(minX, nx);
        minY = Math.min(minY, ny);
        maxX = Math.max(maxX, nx);
        maxY = Math.max(maxY, ny);
      }
    }
    if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (shape.type === "ellipse") {
    const rx = Math.max(0.1, shape.rx ?? 0) * k;
    const ry = Math.max(0.1, shape.ry ?? 0) * k;
    return { x: (shape.cx ?? 0) * k - rx, y: (shape.cy ?? 0) * k - ry, w: rx * 2, h: ry * 2 };
  }
  return { x: (shape.x ?? 0) * k, y: (shape.y ?? 0) * k, w: (shape.w ?? 0) * k, h: (shape.h ?? 0) * k };
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Point hit-test on a single shape (px, grid space). Ignore interior fill. */
export function hitDrawShape(shape: DrawShape, p: Point, R: number, tol = 4): boolean {
  const b = shapeTypesBounds(shape, R);
  if (shape.type === "rect" || shape.type === "line") {
    const pts = [
      { x: b.x, y: b.y },
      { x: b.x + b.w, y: b.y },
      { x: b.x + b.w, y: b.y + b.h },
      { x: b.x, y: b.y + b.h },
    ];
    if (shape.type === "rect") return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
    return distToSegment(p, pts[0], pts[2]) <= tol;
  }
  if (shape.type === "ellipse") {
    const rx = (b.w + tol * 2) / 2;
    const ry = (b.h + tol * 2) / 2;
    const dx = (p.x - (b.x + b.w / 2)) / rx;
    const dy = (p.y - (b.y + b.h / 2)) / ry;
    return dx * dx + dy * dy <= 1;
  }
  // path: distance to each segment
  const k = shapeScale(shape, R);
  let pen: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let hit = false;
  for (const s of parsePath(shape.d)) {
    const cmd = s.cmd.toLowerCase();
    if (cmd === "z") {
      if (distToSegment(p, pen, start) <= tol) hit = true;
      pen = { ...start };
      continue;
    }
    const abs = s.cmd === s.cmd.toUpperCase();
    const n = s.nums;
    if (cmd === "m" || cmd === "l") {
      for (let i = 0; i + 1 < n.length; i += 2) {
        const nx = abs ? n[i] * k : pen.x + n[i] * k;
        const ny = abs ? n[i + 1] * k : pen.y + n[i + 1] * k;
        if (cmd === "l" && distToSegment(p, pen, { x: nx, y: ny }) <= tol) hit = true;
        pen = { x: nx, y: ny };
        if (cmd === "m" && i === 0) start = pen;
      }
    } else if (cmd === "h") {
      const nx = abs ? n[0] * k : pen.x + n[0] * k;
      if (distToSegment(p, pen, { x: nx, y: pen.y }) <= tol) hit = true;
      pen = { x: nx, y: pen.y };
    } else if (cmd === "v") {
      const ny = abs ? n[0] * k : pen.y + n[0] * k;
      if (distToSegment(p, pen, { x: pen.x, y: ny }) <= tol) hit = true;
      pen = { x: pen.x, y: ny };
    }
  }
  return hit;
}

/** Topmost (last) shape hit by `p`, else null. */
export function hitDrawShapes(shapes: DrawShape[], p: Point, R: number, tol = 4): number | null {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitDrawShape(shapes[i], p, R, tol)) return i;
  }
  return null;
}

/** Shift a shape by a normalized offset (dx, dy in hexR units). */
export function shiftShape(shape: DrawShape, dx: number, dy: number): DrawShape {
  if (shape.type === "path") {
    const segs = parsePath(shape.d);
    const out: string[] = [];
    for (const s of segs) {
      const cmd = s.cmd.toLowerCase();
      if (cmd === "z") continue;
      if (cmd !== "m" && cmd !== "l") continue;
      const abs = s.cmd === s.cmd.toUpperCase();
      out.push(`${s.cmd}${s.nums
        .map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
        .map((v) => (abs ? round4(v) : v))
        .join(" ")}`);
    }
    return { ...shape, d: out.join(" ") };
  }
  if (shape.type === "ellipse") {
    return { ...shape, cx: (shape.cx ?? 0) + dx, cy: (shape.cy ?? 0) + dy };
  }
  return { ...shape, x: (shape.x ?? 0) + dx, y: (shape.y ?? 0) + dy };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Normalize a legacy px-authored shape (authored at R = 24) to `unit:"hexR"`. */
export function normalizeShapeToHexR(shape: DrawShape): DrawShape {
  if (shape.unit === "hexR") return shape;
  const k = 1 / LEGACY_R;
  const out: DrawShape = { ...shape, unit: "hexR", size: round4(shape.size * k) };
  if (shape.type === "path" && shape.d) {
    out.d = shape.d.replace(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g, (m) => round4(Number(m) * k).toString());
  } else {
    for (const key of ["x", "y", "w", "h", "cx", "cy", "rx", "ry"] as const) {
      if (shape[key] != null) out[key] = round4(shape[key]! * k);
    }
  }
  return out;
}

/* ----------------------- full board (viewer) render ---------------------- */

export interface DrawPlateOptions {
  accent?: string;
  mark?: { q: number; r: number } | null;
  centerLabel?: { text: string | null; at?: { q: number; r: number } } | null;
  emptyFill?: string;
  emptyStroke?: string;
}

/** Terrain cells + glyphs + optional center label + mark outline. Rotated frame. */
export function drawPlateBoard(ctx: CanvasRenderingContext2D, W: number, H: number, spec: GridSpec, tiles: HexTile[], opts: DrawPlateOptions = {}): void {
  const { accent = "#38bdf8", mark = null, centerLabel = null, emptyFill = "#0e1015", emptyStroke = "#2b2e37" } = opts;
  const tileMap = new Map<string, HexTileKind>();
  for (const t of tiles) tileMap.set(`${t.q},${t.r}`, t.t);
  const centerCol = Math.floor(spec.cols / 2);
  const centerRow = Math.floor(spec.rows / 2);

  withRotated(ctx, W, H, spec.rotationDeg, () => {
    for (let c = 0; c < spec.cols; c++) {
      for (let r = 0; r < spec.rows; r++) {
        const key = `${c},${r}`;
        const tile = tileMap.get(key);
        const meta = tile ? TERRAIN[tile] : null;
        const pt = centerOf(c, r, spec.orientation, spec.R);
        const cx = spec.M + pt.x;
        const cy = spec.M + pt.y;
        const isMark = !!mark && mark.q === c && mark.r === r;
        const isCenter = !!centerLabel && c === centerCol && r === centerRow;

        traceCell(ctx, cx, cy, spec.R, spec.orientation);
        ctx.fillStyle = meta ? meta.fill : isCenter ? `${accent}14` : emptyFill;
        ctx.fill();
        ctx.strokeStyle = meta ? meta.stroke : isCenter ? accent : emptyStroke;
        ctx.lineWidth = isMark ? 2 : isCenter ? 1.6 : 1;
        ctx.stroke();

        if (meta?.glyph) {
          ctx.fillStyle = meta.stroke;
          ctx.font = `bold ${Math.max(8, spec.R * 0.5)}px "Geist Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(meta.glyph, cx, cy);
        }
        if (isCenter && centerLabel?.text) {
          ctx.fillStyle = accent;
          ctx.font = `${Math.max(7, spec.R * 0.45)}px "Geist Mono", monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(centerLabel.text, cx, cy + (meta?.glyph ? spec.R * 0.55 : 0));
        }
      }
    }
    if (mark) {
      const pt = centerOf(mark.q, mark.r, spec.orientation, spec.R);
      traceCell(ctx, spec.M + pt.x, spec.M + pt.y, spec.R, spec.orientation);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  });
}

/** The stroke layer (drawing shapes), rotated with the grid. */
export function drawPlateDrawing(ctx: CanvasRenderingContext2D, W: number, H: number, spec: GridSpec, shapes: DrawShape[], selectedIndex: number | null = null, accent = "#38bdf8"): void {
  withRotated(ctx, W, H, spec.rotationDeg, () => {
    drawShapes(ctx, shapes, spec.R, selectedIndex, accent);
  });
}

export interface CanvasToken {
  id: string;
  name: string;
  q?: number | null;
  r?: number | null;
  facing?: number | null;
  isPlayer: boolean;
  unconscious?: boolean;
  status?: string;
}

const playerFill = "#60a5fa";
const npcFill = "#fbbf24";
const deadFill = "#f87171";

/** Tokens placed on the grid, rotated with it. */
export function drawPlateTokens(ctx: CanvasRenderingContext2D, W: number, H: number, spec: GridSpec, tokens: CanvasToken[]): void {
  const font = `"Geist Mono", monospace`;
  withRotated(ctx, W, H, spec.rotationDeg, () => {
    for (const t of tokens) {
      if (t.q == null || t.r == null || t.q < 0 || t.r < 0 || t.q >= spec.cols || t.r >= spec.rows) continue;
      const pt = centerOf(t.q, t.r, spec.orientation, spec.R);
      const cx = spec.M + pt.x;
      const cy = spec.M + pt.y;
      const rr = Math.max(6, spec.R * 0.52);
      const isNpc = !t.isPlayer;
      const fill = t.unconscious ? "#71717a" : isNpc && t.status && /mort|death|fallen|dead|ko|down/i.test(t.status) ? deadFill : isNpc ? npcFill : playerFill;

      ctx.globalAlpha = t.unconscious ? 0.55 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0b0d12";
      ctx.stroke();

      if (t.facing != null) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((t.facing * 60 * Math.PI) / 180);
        ctx.beginPath();
        ctx.moveTo(spec.R * 0.62, 0);
        ctx.lineTo(-spec.R * 0.18, -spec.R * 0.36);
        ctx.lineTo(-spec.R * 0.18, spec.R * 0.36);
        ctx.closePath();
        ctx.fillStyle = "#0b0d12";
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = "#0b0d12";
      ctx.font = `bold ${8}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((t.isPlayer ? "" : "·") + t.name.charAt(0).toUpperCase(), cx, cy);

      ctx.fillStyle = "#a1a1aa";
      ctx.font = `8px ${font}`;
      ctx.textBaseline = "alphabetic";
      ctx.fillText(t.name, cx, cy + rr + 8);
      ctx.globalAlpha = 1;
    }
  });
}

/** Movement trail + target ring, rotated with the grid. */
export function drawPlateTrail(ctx: CanvasRenderingContext2D, W: number, H: number, spec: GridSpec, accent: string, from: { q: number; r: number } | null, to: { q: number; r: number } | null, markerId: string): void {
  if (!to || to.q < 0 || to.r < 0 || to.q >= spec.cols || to.r >= spec.rows) return;
  withRotated(ctx, W, H, spec.rotationDeg, () => {
    const tp = centerOf(to.q, to.r, spec.orientation, spec.R);
    const tx = spec.M + tp.x;
    const ty = spec.M + tp.y;

    ctx.save();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(tx, ty, spec.R * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (from && from.q >= 0 && from.r >= 0 && from.q < spec.cols && from.r < spec.rows) {
      const fp = centerOf(from.q, from.r, spec.orientation, spec.R);
      const fx = spec.M + fp.x;
      const fy = spec.M + fp.y;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      const ang = Math.atan2(ty - fy, tx - fx);
      const ah = 7;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - ah * Math.cos(ang - 0.35), ty - ah * Math.sin(ang - 0.35));
      ctx.lineTo(tx - ah * Math.cos(ang + 0.35), ty - ah * Math.sin(ang + 0.35));
      ctx.closePath();
      ctx.fillStyle = accent;
      ctx.fill();
      void markerId;
    }
    ctx.restore();
  });
}

/* ------------------------- coordinate mapping --------------------------- */

/** Client coords → grid-space px (same math as the old editor's toGrid). */
export function screenToGrid(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, W: number, H: number, spec: GridSpec): Point {
  const x = ((clientX - rect.left) / rect.width) * W;
  const y = ((clientY - rect.top) / rect.height) * H;
  const pivot = pivotOf(W, H);
  return rotatePoint({ x: x - spec.M, y: y - spec.M }, { x: pivot.x - spec.M, y: pivot.y - spec.M }, -spec.rotationDeg);
}

/** Nearest in-bounds cell for a grid-space point, else null. */
export function gridCellAt(p: Point, spec: GridSpec): { q: number; r: number } | null {
  const cell = hexFromPoint(p.x, p.y, spec.orientation, spec.R);
  if (cell.q < 0 || cell.q >= spec.cols || cell.r < 0 || cell.r >= spec.rows) return null;
  return cell;
}

/** Grid-space point → normalized hexR units (editor coordinate). */
export function toNormalized(p: Point, R: number): Point {
  return { x: p.x / R, y: p.y / R };
}

/** Normalized hexR point → grid-space px. */
export function fromNormalized(p: Point, R: number): Point {
  return { x: p.x * R, y: p.y * R };
}

export type SnapMode = "free" | "center" | "vertex";

/** Snap a normalized point onto the hex lattice (centers or vertices). */
export function snapNormalized(p: Point, spec: GridSpec, mode: SnapMode): Point {
  if (mode === "free") return p;
  if (mode === "vertex") {
    let best: Point | null = null;
    let bestD = Number.MAX_VALUE;
    for (let c = 0; c < spec.cols; c++) {
      for (let r = 0; r < spec.rows; r++) {
        const cn = centerOf(c, r, spec.orientation, 1);
        for (const v of hexPoints(cn.x, cn.y, 1, spec.orientation)) {
          const d = Math.hypot(v.x - p.x, v.y - p.y);
          if (d < bestD) {
            bestD = d;
            best = v;
          }
        }
      }
    }
    return best ?? p;
  }
  const cell = hexFromPoint(p.x, p.y, spec.orientation, 1);
  const clamped = {
    q: Math.max(0, Math.min(spec.cols - 1, cell.q)),
    r: Math.max(0, Math.min(spec.rows - 1, cell.r)),
  };
  return centerOf(clamped.q, clamped.r, spec.orientation, 1);
}

/** Convert a legacy path string into a normalized M/L path (for seeds/legacy rows). */
export function denormPathShape(shape: DrawShape): DrawShape {
  return normalizeShapeToHexR(shape);
}

export { cellWidth, cellHeight, polygonPath };