"use client";

/* ============================================================
   LocationMap — the local tactical grid of a battlemap location,
   drawn from the stored hex geometry (width × height, orientation,
   rotation, center). There is no tile engine yet; this renders the
   skeleton of the grid the narrator will later build on, with the
   center cell pointed at its absolute q,r in the chain.
   ============================================================ */

import type { AbsoluteHex } from "@/lib/location";
import { formatHexScale } from "@/lib/location";

const R = 18;
const M = 34;

interface MapHex {
  sizeM?: number | null;
  width?: number | null;
  height?: number | null;
  centerQ?: number;
  centerR?: number;
  orientation?: string;
  rotationDeg?: number;
}

function cellWidth(orientation: string): number {
  return orientation === "square" ? R * 1.5 : orientation === "pointy" ? Math.sqrt(3) * R : 1.5 * R;
}

function cellHeight(orientation: string): number {
  return orientation === "square" ? R * 1.5 : orientation === "pointy" ? 1.5 * R : Math.sqrt(3) * R;
}

function polygonPath(cx: number, cy: number, r: number, orientation: string): string {
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

function centerOf(q: number, r: number, orientation: string): { x: number; y: number } {
  if (orientation === "square") return { x: q * (R * 1.5), y: r * (R * 1.5) };
  if (orientation === "pointy") return { x: Math.sqrt(3) * R * (q + r / 2), y: 1.5 * R * r };
  return { x: 1.5 * R * q, y: Math.sqrt(3) * R * (r + q / 2) };
}

export default function LocationMap({
  hex,
  abs,
  accent = "#38bdf8",
}: {
  hex?: MapHex | null;
  abs?: AbsoluteHex;
  accent?: string;
}) {
  const orientation = hex?.orientation ?? "flat";
  const cols = Math.max(1, Math.floor(hex?.width ?? 0) || 1);
  const rows = Math.max(1, Math.floor(hex?.height ?? 0) || 1);
  const cw = cellWidth(orientation);
  const ch = cellHeight(orientation);

  const gridW = cw * cols;
  const gridH = ch * rows;
  const W = Math.max(gridW + M * 2, 320);
  const H = Math.max(gridH + M * 2, 240);

  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);
  const crystal = { x: W / 2, y: H / 2 };

  const footprint = hex?.width != null && hex?.height != null ? `${hex.width} × ${hex.height} hex` : null;
  const centerLabel =
    abs && abs.chain.length > 1
      ? `q${abs.q} r${abs.r}`
      : hex?.centerQ != null && hex?.centerR != null
      ? `q${hex.centerQ} r${hex.centerR}`
      : null;

  const rowsList: React.ReactNode[] = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const pt = centerOf(c, r, orientation);
      const isCenter = c === centerCol && r === centerRow;
      const point = polygonPath(M + pt.x, M + pt.y, R, orientation);
      rowsList.push(
        <polygon
          key={`${c}-${r}`}
          points={point}
          fill={isCenter ? `${accent}14` : "#0e1015"}
          stroke={isCenter ? accent : "#2b2e37"}
          strokeWidth={isCenter ? 1.6 : 1}
        />
      );
      if (isCenter && centerLabel) {
        rowsList.push(
          <text
            key={`label-${c}-${r}`}
            x={M + pt.x}
            y={M + pt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Geist Mono, monospace"
            fontSize="9"
            fill={accent}
          >
            {centerLabel}
          </text>
        );
      }
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 pb-1.5 mb-4 border-b border-zinc-700/60">
        <span aria-hidden className="font-mono text-base leading-none" style={{ color: accent }}>▦</span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">Local map</span>
        <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${accent}55, transparent)` }} />
      </div>

      <div className="rounded-lg border border-zinc-700/40 bg-zinc-950/50 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Local tactical grid">
          <g transform={`rotate(${hex?.rotationDeg ?? 0} ${crystal.x} ${crystal.y})`}>
            {rowsList}
          </g>
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        {footprint ? (
          <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
            <span>Footprint</span>
            <b className="font-semibold text-zinc-300">{footprint}</b>
          </span>
        ) : null}
        <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
          <span>Scale</span>
          <b className="font-semibold text-zinc-300">{formatHexScale(hex?.sizeM)}</b>
        </span>
        <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
          <span>Grid</span>
          <b className="font-semibold text-zinc-300">{orientation}</b>
        </span>
        <span className="flex items-center justify-between gap-2 border border-zinc-700/40 rounded px-2 py-1.5">
          <span>Rotation</span>
          <b className="font-semibold text-zinc-300">{hex?.rotationDeg ?? 0}°</b>
        </span>
      </div>
    </div>
  );
}