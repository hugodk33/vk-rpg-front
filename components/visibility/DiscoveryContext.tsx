"use client";

/* ============================================================
   DiscoveryContext — optional narrator picker for "when was this
   known". Lets the narrator attach a scene + narration (the exact
   moment of the story) to a visibility change. This seeds the
   future timeline ("before this moment nobody knew; from here on
   they knew"). Nothing is required — a rule can keep no context.
   ============================================================ */

import { useMemo, useState } from "react";
import type { GameTableScenes } from "@/lib/types";

export interface DiscoverySelection {
  sceneId?: string;
  narrationId?: string;
  moment?: number | null;
}

export default function DiscoveryContext({
  scenes,
  value,
  onChange,
}: {
  scenes: GameTableScenes | null;
  value: DiscoverySelection;
  onChange: (sel: DiscoverySelection) => void;
}) {
  const [enabled, setEnabled] = useState(
    !!(value.sceneId || value.narrationId)
  );

  const sceneOptions = useMemo(() => scenes?.scenes ?? [], [scenes]);
  const narrationOptions = useMemo(() => {
    const scene = sceneOptions.find((s) => s.id === value.sceneId);
    return scene?.narrations ?? [];
  }, [sceneOptions, value.sceneId]);

  const setScene = (sceneId: string) => {
    const scene = sceneOptions.find((s) => s.id === sceneId);
    onChange({
      sceneId: sceneId || undefined,
      narrationId: undefined,
      moment: scene?.moment ?? null,
    });
  };
  const setNarration = (narrationId: string) => {
    const scene = sceneOptions.find((s) => s.id === value.sceneId);
    const narration = scene?.narrations.find((n) => n.id === narrationId);
    onChange({
      sceneId: value.sceneId,
      narrationId: narrationId || undefined,
      moment: narration?.moment ?? value.moment ?? scene?.moment ?? null,
    });
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 mb-4">
      <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            const now = e.target.checked;
            setEnabled(now);
            if (!now) onChange({});
          }}
          className="accent-lime-700"
        />
        <span className="font-mono uppercase tracking-[0.15em] text-[11px]">
          Record discovery moment
        </span>
        <span className="text-zinc-600 text-[10px] ml-1">
          (attach the scene where this becomes known — for the timeline)
        </span>
      </label>

      {enabled ? (
        <div className="grid gap-2 sm:grid-cols-2 mt-3">
          <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Scene
            <select
              value={value.sceneId ?? ""}
              onChange={(e) => setScene(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 normal-case font-sans focus:border-lime-600/50 focus:outline-none"
            >
              <option value="">—</option>
              {sceneOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.chapter != null ? `Ch.${s.chapter} · ` : ""}
                  {s.title || "Untitled scene"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Narration
            <select
              value={value.narrationId ?? ""}
              onChange={(e) => setNarration(e.target.value)}
              disabled={narrationOptions.length === 0}
              className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 normal-case font-sans focus:border-lime-600/50 focus:outline-none disabled:opacity-40"
            >
              <option value="">—</option>
              {narrationOptions.map((n, i) => (
                <option key={n.id} value={n.id}>
                  {n.title || `Narration ${(n.moment ?? i) + 1}`}
                </option>
              ))}
            </select>
          </label>
          {value.moment != null ? (
            <p className="text-[10px] text-zinc-600 sm:col-span-2">
              In-story moment: <span className="text-lime-500">{value.moment}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
