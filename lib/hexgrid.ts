/* ============================================================
   hexgrid — shared axial-hex geometry for the tactical plate.
   The same math drives the read-only LocationMap skeleton and the
   MapStudio editor: cell centers, polygon outlines, pixel→hex
   hit-testing and canvas sizing. R is the hex radius, M the margin
   the grid sits inside the SVG viewBox.
   ============================================================ */

export type HexOrientation = "flat" | "pointy" | "square";

export function cellWidth(orientation: string, R: number): number {
  return orientation === "square"
    ? R * 1.5
    : orientation === "pointy"
    ? Math.sqrt(3) * R
    : 1.5 * R;
}

export function cellHeight(orientation: string, R: number): number {
  return orientation === "square"
    ? R * 1.5
    : orientation === "pointy"
    ? 1.5 * R
    : Math.sqrt(3) * R;
}

export function polygonPath(cx: number, cy: number, r: number, orientation: string): string {
  if (orientation === "square") {
    const s = r * 1.5;
    return `${cx - s / 2},${cy - s / 2} ${cx + s / 2},${cy - s / 2} ${cx + s / 2},${cy + s / 2} ${cx - s / 2},${cy + s / 2}`;
  }
  const start = orientation === "pointy" ? 90 : 0;
  const pts: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = ((start + 60 * k) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function centerOf(q: number, r: number, orientation: string, R: number): { x: number; y: number } {
  if (orientation === "square") return { x: q * (R * 1.5), y: r * (R * 1.5) };
  if (orientation === "pointy") {
    const rx = (Math.sqrt(3) * R) / 2;
    return { x: Math.sqrt(3) * R * q + (mod2(r) ? rx : 0), y: 1.5 * R * r };
  }
  const ry = (Math.sqrt(3) * R) / 2;
  return { x: 1.5 * R * q, y: Math.sqrt(3) * R * r + (mod2(q) ? ry : 0) };
}

/** 1 when the integer is odd — drives the brick (alternating) offset. */
function mod2(n: number): number {
  return ((Math.trunc(n) % 2) + 2) % 2;
}

/** Half-axis extents (padding) of a single cell around its center. */
function cellHalfExtent(orientation: string, R: number): { ex: number; ey: number } {
  if (orientation === "square") return { ex: (R * 1.5) / 2, ey: (R * 1.5) / 2 };
  if (orientation === "pointy") return { ex: (Math.sqrt(3) * R) / 2, ey: R };
  return { ex: R, ey: (Math.sqrt(3) * R) / 2 };
}

/** True bounding box of a cols×rows axial mesh (incl. the q/2 shearing
    term and each cell's radius), so the canvas never clips the grid. */
export function gridFrame(cols: number, rows: number, orientation: string, R: number): {
  w: number;
  h: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  const { ex, ey } = cellHalfExtent(orientation, R);
  let x0 = 0,
    y0 = 0,
    x1 = 0,
    y1 = 0;
  for (let q = 0; q < cols; q++) {
    for (let r = 0; r < rows; r++) {
      const p = centerOf(q, r, orientation, R);
      const px0 = p.x - ex;
      const px1 = p.x + ex;
      const py0 = p.y - ey;
      const py1 = p.y + ey;
      if (q === 0 && r === 0) {
        x0 = px0;
        x1 = px1;
        y0 = py0;
        y1 = py1;
      } else {
        x0 = Math.min(x0, px0);
        x1 = Math.max(x1, px1);
        y0 = Math.min(y0, py0);
        y1 = Math.max(y1, py1);
      }
    }
  }
  return { w: x1 - x0, h: y1 - y0, x0, y0, x1, y1 };
}

export function gridSize(cols: number, rows: number, orientation: string, R: number): { w: number; h: number } {
  const f = gridFrame(cols, rows, orientation, R);
  return { w: f.w, h: f.h };
}

/* ------ pixel → axial (fractional), then round to nearest hex ------ */

export function hexFromPoint(x: number, y: number, orientation: string, R: number): { q: number; r: number } {
  if (orientation === "square") {
    const qf = x / (R * 1.5);
    const rf = y / (R * 1.5);
    return { q: Math.round(qf), r: Math.round(rf) };
  }
  if (orientation === "pointy") {
    const rx = (Math.sqrt(3) * R) / 2;
    const rProbe = Math.round(y / (1.5 * R));
    let best: { q: number; r: number } = { q: 0, r: 0 };
    let bestD = Number.MAX_VALUE;
    for (const r of [rProbe - 1, rProbe, rProbe + 1]) {
      const qf = (x - (mod2(r) ? rx : 0)) / (Math.sqrt(3) * R);
      const q = Math.round(qf);
      const p = centerOf(q, r, orientation, R);
      const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (d < bestD) {
        bestD = d;
        best = { q, r };
      }
    }
    return best;
  }
  const ry = (Math.sqrt(3) * R) / 2;
  const qProbe = Math.round(x / (1.5 * R));
  let best: { q: number; r: number } = { q: 0, r: 0 };
  let bestD = Number.MAX_VALUE;
  for (const q of [qProbe - 1, qProbe, qProbe + 1]) {
    const rf = (y - (mod2(q) ? ry : 0)) / (Math.sqrt(3) * R);
    const r = Math.round(rf);
    const p = centerOf(q, r, orientation, R);
    const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
    if (d < bestD) {
      bestD = d;
      best = { q, r };
    }
  }
  return best;
}

export function cubeRound(qf: number, rf: number): { q: number; r: number } {
  const x = qf;
  const z = rf;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }
  return { q: rx, r: rz };
}

/** Vizinhança axial (coords q,r) — ordem horária começando no Leste. */
export const AXIAL_DIRS: Array<[number, number]> = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/** Direção (0-5) que leva `from` a `to` num movimento de 1 hex. */
export function hexDir(from: { q: number; r: number }, to: { q: number; r: number }): number {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  const i = AXIAL_DIRS.findIndex(([a, b]) => a === dq && b === dr);
  return i >= 0 ? i : 0;
}

/** Distância axial em hexes entre duas células (independe da orientação). */
export function hexDist(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/** Point exchange at `pivot`, by `deg` degrees (SVG clockwise). */
export function rotatePoint(p: { x: number; y: number }, pivot: { x: number; y: number }, deg: number): { x: number; y: number } {
  if (!deg) return p;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}