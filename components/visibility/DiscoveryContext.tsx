"use client";

/* ============================================================
   DiscoveryContext — per-record picker for "when was this known".
   Attaches a scene + narration (the exact moment of the story) to
   a SINGLE visibility change, so each discovery carries its own
   moment (e.g. "Elric saw Lyra's ST lifting the stone"). Nothing
   is required — a rule can keep no context. The global shared box
   is gone: every record edits its repertory, its own instant.
   ============================================================ */

import { useMemo } from "react";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { GameTableScenes } from "@/lib/types";

export interface DiscoverySelection {
  sceneId?: string;
  narrationId?: string;
  moment?: number | null;
}

export function discoveryFromRule(r?: {
  scene_id?: string | null;
  narration_id?: string | null;
  moment?: number | null;
}): DiscoverySelection | null {
  if (!r) return null;
  const { scene_id: sceneId, narration_id: narrationId, moment } = r;
  if (!sceneId && narrationId == null && moment == null) return null;
  return {
    sceneId: sceneId ?? undefined,
    narrationId: narrationId ?? undefined,
    moment: moment ?? null,
  };
}

export default function DiscoveryContext({
  scenes,
  value,
  onChange,
  allowClear = true,
}: {
  scenes: GameTableScenes | null;
  value: DiscoverySelection;
  onChange: (sel: DiscoverySelection) => void;
  allowClear?: boolean;
}) {
  const { t } = useTranslation();
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

  const attached = !!(value.sceneId || value.narrationId);

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-2.5 mt-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
          {attached ? (
            <span className="inline-flex items-center gap-1.5 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {t("vs.vis.momentAttached")}
            </span>
          ) : (
            t("vs.dc.title")
          )}
        </span>
        {attached && allowClear ? (
          <button
            type="button"
            onClick={() => onChange({})}
            className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {t("vs.dc.clear")}
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 mt-2">
        <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          {t("vs.dc.scene")}
          <select
            value={value.sceneId ?? ""}
            onChange={(e) => setScene(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 normal-case font-sans focus:border-green-700/50 focus:outline-none"
          >
            <option value="">—</option>
            {sceneOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.chapter != null ? interpolate(t("vs.dc.chapterShort"), { n: s.chapter }) : ""}
                {s.title || t("vs.dc.untitledScene")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          {t("vs.dc.narration")}
          <select
            value={value.narrationId ?? ""}
            onChange={(e) => setNarration(e.target.value)}
            disabled={narrationOptions.length === 0}
            className="bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 normal-case font-sans focus:border-green-700/50 focus:outline-none disabled:opacity-40"
          >
            <option value="">—</option>
            {narrationOptions.map((n, i) => (
              <option key={n.id} value={n.id}>
                {n.title || interpolate(t("vs.dc.narrationN"), { n: (n.moment ?? i) + 1 })}
              </option>
            ))}
          </select>
        </label>
        {value.moment != null ? (
          <p className="text-[10px] text-zinc-600 sm:col-span-2">
            {t("vs.dc.momentInStory")} <span className="text-green-500">{value.moment}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}