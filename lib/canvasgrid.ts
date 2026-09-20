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

import { centerOf, cellWidth, cellHeight, gridFrame, hexFromPoint, polygonPath, rotatePoint } from "./hexgrid";
import { TERRAIN } from "./terrain";
import type { DrawShape, HexTile, HexTileKind } from "./types";
import type { TrailMove } from "./board";

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
  /** frame origin (top-left of the mesh in grid-space, usually ≤ 0) */
  ox?: number;
  oy?: number;
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
  const f = gridFrame(cols, rows, orientation, R);
  return {
    W: Math.max(f.w + M * 2, minW),
    H: Math.max(f.h + M * 2, minH),
    spec: { cols, rows, orientation, R, M, rotationDeg: 0, ox: f.x0, oy: f.y0 },
  };
}

export function pivotOf(W: number, H: number): Point {
  return { x: W / 2, y: H / 2 };
}

/** Canvas origin (top-left of the true mesh frame) for a grid spec. */
export function gridOffset(spec: GridSpec): Point {
  return { x: spec.M - (spec.ox ?? 0), y: spec.M - (spec.oy ?? 0) };
}

/** Grid-space point → canvas pixel (frame-aware). */
export function gridToCanvas(spec: GridSpec, p: Point): Point {
  const o = gridOffset(spec);
  return { x: o.x + p.x, y: o.y + p.y };
}

/** Canvas pixel → grid-space point (frame-aware, no rotation). */
export function canvasToGrid(spec: GridSpec, p: Point): Point {
  const o = gridOffset(spec);
  return { x: p.x - o.x, y: p.y - o.y };
}

/** Fill the canvas backing store for the DPR and run the draw routine.
    `zoom` inflates the backing pixel grid (crisp at any scale); `fit`
    letterboxes the draw into a fixed viewport (dx/dy offset, scale
    factor): the drawing routine still uses the plate's logical W/H,
    so a fixed-size canvas can host any grid at any zoom — the CSS node
    should then be sized to `boxW x boxH` (already zoom-independent). */
export function paintCanvas(
  cv: HTMLCanvasElement,
  W: number,
  H: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
  zoom = 1,
  fit?: { scale: number; dx: number; dy: number; boxW: number; boxH: number }
): void {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const z = Number.isFinite(zoom) ? Math.max(0.1, zoom) : 1;
  const boxW = fit ? Math.max(1, fit.boxW) : W;
  const boxH = fit ? Math.max(1, fit.boxH) : H;
  cv.width = Math.max(1, Math.round(boxW * z * dpr));
  cv.height = Math.max(1, Math.round(boxH * z * dpr));
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr * z, 0, 0, dpr * z, 0, 0);
  ctx.clearRect(0, 0, boxW, boxH);
  ctx.save();
  if (fit) {
    ctx.translate(fit.dx, fit.dy);
    ctx.scale(fit.scale, fit.scale);
  }
  draw(ctx);
  ctx.restore();
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

/* Stroke weight is a FRACTION of the hex radius: a drawn vector stays a
   thin architectural line against the cell, instead of scaling 1:1 with
   the grid (which read as too thick on small/big hexes alike). */
export const STROKE_RATIO = 0.075;

export function shapeScale(shape: DrawShape, R: number): number {
  return shape.unit === "hexR" ? R : R / LEGACY_R;
}

export function strokeWeightPx(shape: DrawShape, R: number): number {
  return Math.max(0.5, shape.size * shapeScale(shape, R) * STROKE_RATIO);
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
  if (shape.type === "asset") {
    drawAssetShape(ctx, shape, R, selected, accent);
    return;
  }
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
  if (shape.type === "asset") {
    const { w, h } = assetHalf(shape);
    const ak = assetScale(shape, R);
    return { x: (shape.x ?? 0) * ak - w * ak, y: (shape.y ?? 0) * ak - h * ak, w: w * 2 * ak, h: h * 2 * ak };
  }
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
  if (shape.type === "asset") {
    return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
  }
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

/* ------------------------- asset stamps (drawing) ------------------------ */

export type DrawAssetKind = import("./types").DrawAssetKind;

export interface AssetMeta {
  label: string;
  w: number;
  h: number;
}

/** Springboard asset catalog — vector props stamped onto the grid. */
export const ASSETS: DrawAssetKind[] = [
  "door", "chest", "table", "chair", "bed", "barrel", "crate", "bookcase",
  "brazier", "torch", "altar", "statue", "tree", "rock", "well", "rug",
  "stairs", "fountain",
];

/** Full extents (hexR units) each asset occupies, for bounds + hit tests. */
export const ASSET_BOX: Record<DrawAssetKind, AssetMeta> = {
  door: { label: "Door", w: 0.5, h: 0.85 },
  chest: { label: "Chest", w: 0.6, h: 0.45 },
  table: { label: "Table", w: 0.72, h: 0.5 },
  chair: { label: "Chair", w: 0.34, h: 0.34 },
  bed: { label: "Bed", w: 0.68, h: 0.42 },
  barrel: { label: "Barrel", w: 0.4, h: 0.4 },
  crate: { label: "Crate", w: 0.45, h: 0.45 },
  bookcase: { label: "Bookcase", w: 0.6, h: 0.72 },
  brazier: { label: "Brazier", w: 0.42, h: 0.5 },
  torch: { label: "Torch", w: 0.2, h: 0.55 },
  altar: { label: "Altar", w: 0.6, h: 0.4 },
  statue: { label: "Statue", w: 0.38, h: 0.58 },
  tree: { label: "Tree", w: 0.56, h: 0.56 },
  rock: { label: "Rock", w: 0.5, h: 0.4 },
  well: { label: "Well", w: 0.55, h: 0.55 },
  rug: { label: "Rug", w: 0.72, h: 0.46 },
  stairs: { label: "Stairs", w: 0.55, h: 0.4 },
  fountain: { label: "Fountain", w: 0.6, h: 0.6 },
};

/** Render scale for an asset stamp (hexR × user scale). */
export function assetScale(shape: DrawShape, R: number): number {
  return shapeScale(shape, R) * (shape.s ?? 1);
}

/** Half extents (hexR units) of an asset's footprint. */
export function assetHalf(shape: DrawShape): { w: number; h: number } {
  const meta = ASSET_BOX[shape.kind ?? "crate"] ?? ASSET_BOX.crate;
  return { w: meta.w / 2, h: meta.h / 2 };
}

function soft(hex: string, a: number): string {
  return `${hex}${Math.round(Math.min(1, a) * 255).toString(16).padStart(2, "0")}`;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Draw the asset glyph in unit space, origin = asset center. */
function drawAssetGlyph(ctx: CanvasRenderingContext2D, kind: DrawAssetKind, col: string): void {
  const f = (a: number) => soft(col, a);
  switch (kind) {
    case "door": {
      const w = 0.25, h = 0.425;
      rrect(ctx, -w, -h, w * 2, h * 2, 0.03);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.45);
      ctx.lineTo(w, -h * 0.45);
      ctx.moveTo(-w, h * 0.55);
      ctx.lineTo(w, h * 0.55);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h * 0.72, 0.075, 0, Math.PI * 2);
      ctx.fillStyle = f(0.6);
      ctx.fill();
      break;
    }
    case "chest": {
      const w = 0.3, h = 0.225;
      rrect(ctx, -w, -h * 0.72, w * 2, h * 0.28, 0.02);
      ctx.stroke();
      rrect(ctx, -w, -h * 0.44, w * 2, h * 1.44, 0.02);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.44);
      ctx.lineTo(w, -h * 0.44);
      ctx.stroke();
      ctx.beginPath();
      rrect(ctx, -w * 0.22, -h * 0.44, w * 0.44, h * 0.55, 0.03);
      ctx.fillStyle = f(0.45);
      ctx.fill();
      ctx.strokeStyle = "#0b0d12";
      ctx.stroke();
      ctx.strokeStyle = col;
      break;
    }
    case "table": {
      const w = 0.36, h = 0.25;
      rrect(ctx, -w, -h, w * 2, h * 0.36, 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.72, -h * 0.64);
      ctx.lineTo(-w * 0.72, h);
      ctx.moveTo(w * 0.72, -h * 0.64);
      ctx.lineTo(w * 0.72, h);
      ctx.moveTo(-w * 0.72, h * 0.22);
      ctx.lineTo(w * 0.72, h * 0.22);
      ctx.stroke();
      break;
    }
    case "chair": {
      const w = 0.17, h = 0.17;
      rrect(ctx, -w, -h, w * 2, h * 0.75, 0.03);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(w, -h);
      ctx.lineTo(w, h * 0.22);
      ctx.moveTo(-w * 0.75, -h);
      ctx.lineTo(-w * 0.75, h);
      ctx.moveTo(w * 0.75, -h);
      ctx.lineTo(w * 0.75, h);
      ctx.stroke();
      break;
    }
    case "bed": {
      const w = 0.34, h = 0.21;
      rrect(ctx, -w, -h * 0.6, w * 2, h * 1.14, 0.04);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.6);
      ctx.lineTo(w, -h * 0.6);
      ctx.moveTo(-w * 0.9, h * 0.14);
      ctx.lineTo(-w * 0.55, h * 0.14);
      ctx.moveTo(w * 0.55, h * 0.14);
      ctx.lineTo(w * 0.9, h * 0.14);
      ctx.stroke();
      ctx.moveTo(-w * 0.72, -h * 0.24);
      ctx.lineTo(w * 0.72, -h * 0.24);
      ctx.fillStyle = f(0.3);
      ctx.fillRect(-w, -h * 0.6, w * 2, h * 0.36);
      break;
    }
    case "barrel": {
      const w = 0.2, h = 0.2;
      ctx.beginPath();
      ctx.ellipse(0, -h, w, h * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(-w, h);
      ctx.moveTo(w, -h);
      ctx.lineTo(w, h);
      ctx.moveTo(0, -h * 1.15);
      ctx.lineTo(0, h * 1.15);
      ctx.moveTo(-w * 0.5, -h * 1.08);
      ctx.lineTo(-w * 0.5, h * 1.08);
      ctx.moveTo(w * 0.5, -h * 1.08);
      ctx.lineTo(w * 0.5, h * 1.08);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, h, w, h * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "crate": {
      const w = 0.225, h = 0.225;
      ctx.strokeRect(-w, -h, w * 2, h * 2);
      ctx.beginPath();
      ctx.moveTo(-w, -h);
      ctx.lineTo(w, h);
      ctx.moveTo(w, -h);
      ctx.lineTo(-w, h);
      ctx.stroke();
      break;
    }
    case "bookcase": {
      const w = 0.3, h = 0.36;
      ctx.strokeRect(-w, -h, w * 2, h * 2);
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.34);
      ctx.lineTo(w, -h * 0.34);
      ctx.moveTo(-w, h * 0.36);
      ctx.lineTo(w, h * 0.36);
      ctx.stroke();
      ctx.fillStyle = f(0.45);
      ctx.fillRect(-w * 0.72, h * 0.54, w * 1.44, h * 0.28);
      ctx.fillRect(-w * 0.72, -h * 0.16, w * 1.44, h * 0.28);
      break;
    }
    case "brazier": {
      const w = 0.21, h = 0.25;
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.2);
      ctx.lineTo(w, -h * 0.2);
      ctx.lineTo(w * 0.72, h * 0.6);
      ctx.lineTo(-w * 0.72, h * 0.6);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.55, h * 0.6);
      ctx.lineTo(-w * 0.35, h);
      ctx.moveTo(w * 0.55, h * 0.6);
      ctx.lineTo(w * 0.35, h);
      ctx.stroke();
      ctx.fillStyle = f(0.55);
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.9);
      ctx.quadraticCurveTo(w * 0.75, -h * 0.4, w * 0.45, -h * 0.05);
      ctx.quadraticCurveTo(w * 0.2, -h * 0.28, 0, -h * 0.2);
      ctx.quadraticCurveTo(-w * 0.2, -h * 0.28, -w * 0.45, -h * 0.05);
      ctx.quadraticCurveTo(-w * 0.75, -h * 0.4, 0, -h * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.stroke();
      break;
    }
    case "torch": {
      const w = 0.1, h = 0.275;
      ctx.beginPath();
      ctx.moveTo(-w, -h * 0.25);
      ctx.lineTo(w, -h * 0.25);
      ctx.lineTo(w * 0.5, h);
      ctx.lineTo(-w * 0.5, h);
      ctx.closePath();
      ctx.stroke();
      ctx.rotate((25 * Math.PI) / 180);
      ctx.fillStyle = f(0.5);
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.45);
      ctx.quadraticCurveTo(w, -h * 0.55, w * 0.6, -h * 0.42);
      ctx.quadraticCurveTo(w * 0.5, -h * 0.8, 0, -h * 0.9);
      ctx.quadraticCurveTo(-w * 0.5, -h * 0.8, -w * 0.6, -h * 0.42);
      ctx.quadraticCurveTo(-w, -h * 0.55, 0, -h * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "altar": {
      const w = 0.3, h = 0.2;
      ctx.beginPath();
      ctx.moveTo(-w, h);
      ctx.lineTo(-w * 0.7, -h * 0.7);
      ctx.lineTo(w * 0.7, -h * 0.7);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, -h * 0.7);
      ctx.lineTo(-w * 0.7, h);
      ctx.moveTo(w * 0.7, -h * 0.7);
      ctx.lineTo(w * 0.7, h);
      ctx.stroke();
      ctx.fillStyle = f(0.55);
      ctx.fillRect(-w * 0.55, -h * 0.42, w * 0.24, h * 0.3);
      ctx.fillRect(w * 0.31, -h * 0.42, w * 0.24, h * 0.3);
      break;
    }
    case "statue": {
      const w = 0.19, h = 0.29;
      ctx.beginPath();
      ctx.moveTo(-w * 1.15, h);
      ctx.lineTo(w * 1.15, h);
      ctx.moveTo(-w * 0.8, h * 0.42);
      ctx.lineTo(w * 0.8, h * 0.42);
      ctx.moveTo(-w * 0.8, h * 0.42);
      ctx.lineTo(-w * 0.7, h);
      ctx.moveTo(w * 0.8, h * 0.42);
      ctx.lineTo(w * 0.7, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h * 0.55, w, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h * 0.55, w * 1.55, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "tree": {
      const w = 0.28, h = 0.28;
      ctx.fillStyle = f(0.35);
      ctx.beginPath();
      ctx.arc(-w * 0.42, -h * 0.25, h * 0.62, 0, Math.PI * 2);
      ctx.arc(w * 0.4, -h * 0.2, h * 0.66, 0, Math.PI * 2);
      ctx.arc(0, -h * 0.02, h * 0.78, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      ctx.lineTo(0, h);
      ctx.moveTo(-w * 0.5, h);
      ctx.lineTo(w * 0.5, h);
      ctx.stroke();
      break;
    }
    case "rock": {
      const w = 0.25, h = 0.2;
      ctx.fillStyle = f(0.3);
      ctx.beginPath();
      ctx.moveTo(-w, h * 0.35);
      ctx.lineTo(-w * 0.6, -h);
      ctx.lineTo(-w * 0.15, -h * 0.25);
      ctx.lineTo(w * 0.35, -h * 0.8);
      ctx.lineTo(w, h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.stroke();
      break;
    }
    case "well": {
      const w = 0.275, h = 0.275;
      ctx.beginPath();
      ctx.arc(0, 0, w, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w, h * 0.45);
      ctx.lineTo(w, h * 0.45);
      ctx.moveTo(-w, h * 0.45);
      ctx.lineTo(-w * 0.35, h);
      ctx.moveTo(w, h * 0.45);
      ctx.lineTo(w * 0.35, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h, w * 0.5, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case "rug": {
      const w = 0.36, h = 0.23;
      rrect(ctx, -w, -h, w * 2, h * 2, 0.1);
      ctx.stroke();
      ctx.beginPath();
      rrect(ctx, -w * 0.7, -h * 0.7, w * 1.4, h * 1.4, 0.07);
      ctx.stroke();
      ctx.fillStyle = f(0.5);
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "stairs": {
      const w = 0.275, h = 0.2;
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        const y = -h + t * h * 2;
        const hw = w * (1 - t * 0.72);
        ctx.beginPath();
        ctx.moveTo(-hw, y);
        ctx.lineTo(hw, y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-w, h);
      ctx.lineTo(-w, -h);
      ctx.moveTo(w, h);
      ctx.lineTo(w, -h);
      ctx.stroke();
      break;
    }
    case "fountain": {
      const w = 0.3, h = 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, w, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.65, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h * 0.55, w * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.3);
      ctx.quadraticCurveTo(w * 0.5, -h * 0.75, 0, -h * 1.1);
      ctx.quadraticCurveTo(-w * 0.5, -h * 0.75, 0, -h * 0.3);
      ctx.stroke();
      break;
    }
    default: {
      ctx.strokeRect(-0.2, -0.2, 0.4, 0.4);
      break;
    }
  }
}

/** Draw an asset stamp: positioned at (x,y), scaling by unit × s, rotated by rot. */
export function drawAssetShape(ctx: CanvasRenderingContext2D, shape: DrawShape, R: number, selected = false, accent = "#38bdf8"): void {
  const k = assetScale(shape, R);
  const { w, h } = assetHalf(shape);
  const lw = Math.max(1, R * 0.12 * (shape.s ?? 1));
  const col = shape.color || "#e4e4e7";

  ctx.save();
  ctx.translate((shape.x ?? 0) * k, (shape.y ?? 0) * k);
  ctx.rotate(((shape.rot ?? 0) * Math.PI) / 180);
  ctx.scale(k, k);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = lw / k;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  drawAssetGlyph(ctx, shape.kind ?? "crate", col);

  if (selected) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2 / k;
    ctx.setLineDash([4 / k, 3 / k]);
    ctx.strokeRect(-w, -h, w * 2, h * 2);
    ctx.setLineDash([]);
  }
  ctx.restore();
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
  const o = gridOffset(spec);

  withRotated(ctx, W, H, spec.rotationDeg, () => {
    for (let c = 0; c < spec.cols; c++) {
      for (let r = 0; r < spec.rows; r++) {
        const key = `${c},${r}`;
        const tile = tileMap.get(key);
        const meta = tile ? TERRAIN[tile] : null;
        const pt = centerOf(c, r, spec.orientation, spec.R);
        const cx = o.x + pt.x;
        const cy = o.y + pt.y;
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
      traceCell(ctx, o.x + pt.x, o.y + pt.y, spec.R, spec.orientation);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  });
}

/** The stroke layer (drawing shapes), rotated with the grid. */
export function drawPlateDrawing(ctx: CanvasRenderingContext2D, W: number, H: number, spec: GridSpec, shapes: DrawShape[], selectedIndex: number | null = null, accent = "#38bdf8"): void {
  withRotated(ctx, W, H, spec.rotationDeg, () => {
    const o = gridOffset(spec);
    ctx.save();
    ctx.translate(o.x, o.y);
    drawShapes(ctx, shapes, spec.R, selectedIndex, accent);
    ctx.restore();
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
  /** avatar photo url shown inside the inner circle (see drawPlateTokens) */
  imageUrl?: string | null;
}

export interface TokenDrawOpts {
  /** url → loaded HTMLImageElement (null while loading/failed → placeholder) */
  images?: Map<string, HTMLImageElement | null>;
  /** id of the token whose name label is painted (hover highlight);
      when absent, no token names are drawn at all. */
  labelId?: string | null;
}

const playerFill = "#60a5fa";
const npcFill = "#fbbf24";
const deadFill = "#f87171";

/** Empty-avatar silhouette painted inside the token's inner circle. */
function drawEmptyAvatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#3f434c";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.16, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.62, r * 0.72, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

/** Tokens placed on the grid, rotated with it.
    Each token is a double circle: an outer ring carries the facing arrowhead
    (fused into the band) while the inner circle — always upright — holds the
    character's avatar photo or, without one, an empty-avatar silhouette + the
    sheet's initial. */
export function drawPlateTokens(ctx: CanvasRenderingContext2D, W: number, H: number, spec: GridSpec, tokens: CanvasToken[], opts: TokenDrawOpts = {}): void {
  const font = `"Geist Mono", monospace`;
  const o = gridOffset(spec);
  const images = opts.images;
  withRotated(ctx, W, H, spec.rotationDeg, () => {
    for (const t of tokens) {
      if (t.q == null || t.r == null || t.q < 0 || t.r < 0 || t.q >= spec.cols || t.r >= spec.rows) continue;
      const pt = centerOf(t.q, t.r, spec.orientation, spec.R);
      const cx = o.x + pt.x;
      const cy = o.y + pt.y;
      const isNpc = !t.isPlayer;
      const ring = t.unconscious
        ? "#71717a"
        : isNpc && t.status && /mort|death|fallen|dead|ko|down/i.test(t.status)
        ? deadFill
        : isNpc
        ? npcFill
        : playerFill;

      const inner = Math.max(5, spec.R * 0.36);
      const outer = Math.max(8, spec.R * 0.6);

      ctx.globalAlpha = t.unconscious ? 0.55 : 1;

      /* outer ring — the second circle */
      ctx.beginPath();
      ctx.arc(cx, cy, (inner + outer) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = ring;
      ctx.lineWidth = Math.max(3, outer - inner);
      ctx.stroke();

      /* facing arrowhead fused into the ring (rotates; inner circle doesn't) */
      if (t.facing != null) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((t.facing * 60 * Math.PI) / 180);
        const tip = outer + 1.2;
        const base = inner - 1;
        const half = Math.max(2.6, (outer - inner) * 0.62);
        ctx.beginPath();
        ctx.moveTo(tip, 0);
        ctx.lineTo(base, -half);
        ctx.lineTo(base + 1.4, 0);
        ctx.lineTo(base, half);
        ctx.closePath();
        ctx.fillStyle = "#0b0d12";
        ctx.fill();
        ctx.strokeStyle = "#0b0d12";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }

      /* inner circle — avatar photo / empty avatar + sheet initial */
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#14161c";
      ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2);

      const url = t.imageUrl;
      const img = url && images ? images.get(url) || null : null;
      if (img && img.width > 0 && img.height > 0) {
        const scale = Math.max((inner * 2) / img.width, (inner * 2) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
      } else {
        drawEmptyAvatar(ctx, cx, cy, inner);
        ctx.fillStyle = "#c8cbd4";
        ctx.font = `bold ${Math.max(6, inner * 0.72)}px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((t.isPlayer ? "" : "·") + t.name.charAt(0).toUpperCase(), cx, cy + inner * 0.42);
      }
      ctx.restore();

      /* inner outline */
      ctx.beginPath();
      ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      ctx.strokeStyle = "#0b0d12";
      ctx.lineWidth = Math.max(1.3, spec.R * 0.05);
      ctx.stroke();

      /* label — only the hovered token's name is painted */
      if (opts.labelId === t.id) {
        ctx.fillStyle = "#a1a1aa";
        ctx.font = `8px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(t.name, cx, cy + outer + 8);
      }
      ctx.globalAlpha = 1;
    }
  });
}

/** Movement replay — dashed fixel per selected move, rotated with the grid.
    Every `moves` entry is one movement action (from→to): we draw an
    independent arrow with a start marker and stamp a translucent "ghost"
    token at the destination so the character appears with its action.
    A dashed ring anchors the final destination. */
export function drawPlateTrail(ctx: CanvasRenderingContext2D, W: number, H: number, spec: GridSpec, accent: string, moves: TrailMove[], markerId: string, opts: { tokens?: CanvasToken[] } = {}): void {
  if (!moves.length) return;
  const font = `"Geist Mono", monospace`;
  const o = gridOffset(spec);
  const inBounds = (c: { q: number; r: number }) => c && c.q >= 0 && c.r >= 0 && c.q < spec.cols && c.r < spec.rows;
  const center = (c: { q: number; r: number }) => {
    const p = centerOf(c.q, c.r, spec.orientation, spec.R);
    return { x: o.x + p.x, y: o.y + p.y };
  };

  const tokenById = new Map<string, CanvasToken>();
  for (const t of opts.tokens ?? []) tokenById.set(t.id, t);

  const last = moves[moves.length - 1];
  void markerId;

  withRotated(ctx, W, H, spec.rotationDeg, () => {
    for (const m of moves) {
      const tok = tokenById.get(m.id);
      const ring = tok
        ? tok.unconscious
          ? "#71717a"
          : !tok.isPlayer && tok.status && /mort|death|fallen|dead|ko|down/i.test(tok.status)
          ? "#f87171"
          : !tok.isPlayer
          ? "#fbbf24"
          : "#60a5fa"
        : accent;
      const inner = Math.max(5, spec.R * 0.36);
      const outer = Math.max(8, spec.R * 0.6);

      const tC = center(m.to);
      const sC = m.from && inBounds(m.from) ? center(m.from) : null;

      /* start marker + dashed direction line + arrowhead */
      if (sC) {
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.fillStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 3]);
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(sC.x, sC.y);
        ctx.lineTo(tC.x, tC.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(sC.x, sC.y, Math.max(2.5, spec.R * 0.09), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.9;
        const ang = Math.atan2(tC.y - sC.y, tC.x - sC.x);
        const ah = Math.max(6, spec.R * 0.22);
        ctx.beginPath();
        ctx.moveTo(tC.x, tC.y);
        ctx.lineTo(tC.x - ah * Math.cos(ang - 0.35), tC.y - ah * Math.sin(ang - 0.35));
        ctx.lineTo(tC.x - ah * Math.cos(ang + 0.35), tC.y - ah * Math.sin(ang + 0.35));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        /* spawned on a fresh hex — mark the arrival point */
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(tC.x, tC.y, Math.max(2.5, spec.R * 0.09), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* ghost token at the destination — the token "appears" with the action */
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(tC.x, tC.y, (inner + outer) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = ring;
      ctx.lineWidth = Math.max(3, outer - inner);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tC.x, tC.y, inner, 0, Math.PI * 2);
      ctx.fillStyle = "#14161c";
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = "#c8cbd4";
      ctx.font = `bold ${Math.max(6, inner * 0.72)}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        (tok?.isPlayer ? "" : "·") + String((tok?.name ?? "?").charAt(0)).toUpperCase(),
        tC.x,
        tC.y + inner * 0.42
      );
      ctx.restore();
    }

    /* anchor ring on the final destination */
    if (inBounds(last.to)) {
      const l = center(last.to);
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(l.x, l.y, spec.R * 0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  });
}

/* ------------------------- coordinate mapping --------------------------- */

/** Client coords → grid-space px (same math as the old editor's toGrid). */
export function screenToGrid(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, W: number, H: number, spec: GridSpec): Point {
  const x = ((clientX - rect.left) / rect.width) * W;
  const y = ((clientY - rect.top) / rect.height) * H;
  const o = gridOffset(spec);
  const pivot = pivotOf(W, H);
  const gridPivot = { x: pivot.x - o.x, y: pivot.y - o.y };
  return rotatePoint({ x: x - o.x, y: y - o.y }, gridPivot, -spec.rotationDeg);
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