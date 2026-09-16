"use client";

/* ============================================================
   LocationMap — the local tactical grid of a battlemap location,
   drawn from the stored hex geometry (width × height, orientation,
   rotation, center). Renders the skeleton of the grid *plus* the
   two layers the narrator painted in the MapStudio: hex terrain
   tiles (grass, water, walls, doors…) and SVG strokes (walls, routes,
   girders). The center cell is pointed at its absolute q,r chain.
   ============================================================ */

import type { AbsoluteHex } from "@/lib/location";
import { formatHexScale } from "@/lib/location";
import { centerOf, gridSize, polygonPath } from "@/lib/hexgrid";
import { TERRAIN } from "@/lib/terrain";
import type { DrawShape, HexTile, HexTileKind } from "@/lib/types";

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
  const orientation = hex?.orientation ?? "flat";
  const cols = Math.max(1, Math.floor(hex?.width ?? 0) || 1);
  const rows = Math.max(1, Math.floor(hex?.height ?? 0) || 1);
  const g = gridSize(cols, rows, orientation, R);
  const W = Math.max(g.w + M * 2, 320);
  const H = Math.max(g.h + M * 2, 240);

  const centerCol = Math.floor(cols / 2);
  const centerRow = Math.floor(rows / 2);
  const crystal = { x: W / 2, y: H / 2 };

  const tileMap = new Map<string, HexTileKind>();
  for (const t of tiles) tileMap.set(`${t.q},${t.r}`, t.t);

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
      const key = `${c},${r}`;
      const tile = tileMap.get(key);
      const meta = tile ? TERRAIN[tile] : null;
      const pt = centerOf(c, r, orientation, R);
      const isCenter = c === centerCol && r === centerRow;
      const point = polygonPath(M + pt.x, M + pt.y, R, orientation);
      rowsList.push(
        <polygon
          key={key}
          points={point}
          fill={meta ? meta.fill : isCenter ? `${accent}14` : "#0e1015"}
          stroke={meta ? meta.stroke : isCenter ? accent : "#2b2e37"}
          strokeWidth={isCenter ? 1.6 : 1}
        />
      );
      if (meta?.glyph) {
        rowsList.push(
          <text
            key={`g-${key}`}
            x={M + pt.x}
            y={M + pt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily="Geist Mono, monospace"
            fontSize="9"
            fontWeight="bold"
            fill={meta.stroke}
          >
            {meta.glyph}
          </text>
        );
      }
      if (isCenter && centerLabel) {
        rowsList.push(
          <text
            key={`label-${c}-${r}`}
            x={M + pt.x}
            y={M + pt.y + (meta?.glyph ? 9 : 0)}
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

            {drawing.length > 0 ? (
              <g pointerEvents="none">
                {drawing.map((s, i) => (
                  <DrawNode key={i} shape={s} />
                ))}
              </g>
            ) : null}
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

      {drawing.length > 0 || tiles.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          <span>{drawing.length} stroke{drawing.length === 1 ? "" : "s"}</span>
          <span aria-hidden>·</span>
          <span>{tiles.length} painted cell{tiles.length === 1 ? "" : "s"}</span>
        </div>
      ) : null}
    </div>
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