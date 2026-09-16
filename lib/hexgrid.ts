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
  if (orientation === "pointy") return { x: Math.sqrt(3) * R * (q + r / 2), y: 1.5 * R * r };
  return { x: 1.5 * R * q, y: Math.sqrt(3) * R * (r + q / 2) };
}

export function gridSize(cols: number, rows: number, orientation: string, R: number): { w: number; h: number } {
  return {
    w: cellWidth(orientation, R) * cols,
    h: cellHeight(orientation, R) * rows,
  };
}

/* ------ pixel → axial (fractional), then round to nearest hex ------ */

export function hexFromPoint(x: number, y: number, orientation: string, R: number): { q: number; r: number } {
  let qf: number;
  let rf: number;
  if (orientation === "square") {
    qf = x / (R * 1.5);
    rf = y / (R * 1.5);
  } else if (orientation === "pointy") {
    rf = y / (1.5 * R);
    qf = x / (Math.sqrt(3) * R) - rf / 2;
  } else {
    qf = x / (1.5 * R);
    rf = y / (Math.sqrt(3) * R) - qf / 2;
  }
  return cubeRound(qf, rf);
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