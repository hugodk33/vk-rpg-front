"use client";

/* ============================================================
   ZoomControls — compact zoom widget anchored to the top-right
   corner of a map canvas. The center shows the current zoom as
   a percentage and doubles as the "reset to 100%" button.
   ============================================================ */

import { Minus, Plus } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoom: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export default function ZoomControls({ zoom, onZoom, min = 0.5, max = 3.5, step = 0.3 }: ZoomControlsProps) {
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)) * 100) / 100;
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border border-zinc-700/70 bg-zinc-950/85 backdrop-blur px-1 py-0.5 shadow-lg">
      <button
        type="button"
        onClick={() => onZoom(clamp(zoom - step))}
        disabled={zoom <= min}
        aria-label="Zoom out"
        title="Zoom out"
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <Minus className="w-3.5 h-3.5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => onZoom(clamp(zoom + step))}
        disabled={zoom >= max}
        aria-label="Zoom in"
        title="Zoom in"
        className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors disabled:opacity-35 disabled:hover:bg-transparent"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        onClick={() => onZoom(1)}
        disabled={zoom === 1}
        aria-label="Reset zoom"
        title="Reset to 100%"
        className="flex h-6 min-w-[2.9rem] items-center justify-center rounded font-mono text-[10px] tabular-nums text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  );
}