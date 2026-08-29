"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CharacterHistory, CharacterHistoryEvent } from "@/lib/types";

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

function eventChips(e: CharacterHistoryEvent): Array<{ key: string; label: string; value: string; cls: string }> {
  const chips: Array<{ key: string; label: string; value: string; cls: string }> = [];
  if (e.mod_hp != null) chips.push({ key: "hp", label: "HP", value: signed(e.mod_hp), cls: "text-red-400" });
  if (e.mod_st != null) chips.push({ key: "st", label: "ST", value: signed(e.mod_st), cls: "text-red-400" });
  if (e.mod_dx != null) chips.push({ key: "dx", label: "DX", value: signed(e.mod_dx), cls: "text-emerald-400" });
  if (e.mod_iq != null) chips.push({ key: "iq", label: "IQ", value: signed(e.mod_iq), cls: "text-blue-400" });
  if (e.mod_ht != null) chips.push({ key: "ht", label: "HT", value: signed(e.mod_ht), cls: "text-purple-400" });
  if (e.mod_fatigue != null) chips.push({ key: "fp", label: "FP", value: signed(e.mod_fatigue), cls: "text-blue-400" });
  if (e.encumbrance != null) chips.push({ key: "enc", label: "ENC", value: e.encumbrance, cls: "text-zinc-400" });
  if (e.damage_value != null) chips.push({ key: "dmg", label: "DMG", value: e.damage_value, cls: "text-amber-400/80" });
  if (e.item_quantity != null) chips.push({ key: "qty", label: "QTY", value: String(e.item_quantity), cls: "text-zinc-400" });
  return chips;
}

export default function CharacterJourney({
  characterId,
  selectedMoment,
}: {
  characterId: string;
  selectedMoment: number | null;
}) {
  const [data, setData] = useState<CharacterHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<CharacterHistory>(`/game-table-character/${characterId}/history`)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, [characterId]);

  if (error) {
    return <p className="text-xs text-zinc-600 italic">The chronicle is out of reach right now.</p>;
  }
  if (!data) {
    return <p className="text-xs text-zinc-600 italic animate-pulse">Following the trail of events…</p>;
  }
  if (!data.events || data.events.length === 0) {
    return (
      <p className="text-zinc-600 text-sm italic">
        No recorded events yet — the journey begins when the dice roll.
      </p>
    );
  }

  const chapters: Array<{ chapter: number | null; events: CharacterHistoryEvent[] }> = [];
  for (const ev of data.events) {
    const last = chapters[chapters.length - 1];
    if (last && last.chapter === ev.chapter) last.events.push(ev);
    else chapters.push({ chapter: ev.chapter ?? null, events: [ev] });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-1">Journey</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
          {data.events.length} event{data.events.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="relative pl-5">
        <div className="absolute left-1.5 top-1 bottom-1 w-px bg-zinc-700/60" />
        {chapters.map((group, gi) => (
          <div key={gi} className="mb-4 last:mb-0">
            <div className="text-[10px] uppercase tracking-widest text-amber-400/70 font-semibold mb-1.5">
              Chapter {group.chapter ?? "—"}
            </div>
            <div className="space-y-2.5">
              {group.events.map((ev) => {
                const chips = eventChips(ev);
                const isCurrent = selectedMoment != null && ev.narration_moment != null
                  ? ev.narration_moment === selectedMoment || (ev.narration_moment ?? 0) <= selectedMoment
                  : true;
                return (
                  <div
                    key={ev.id}
                    className={`relative bg-zinc-800/50 rounded-lg border border-zinc-700/40 px-3 py-2 ${
                      isCurrent ? "" : "opacity-45"
                    }`}
                  >
                    <div
                      className={`absolute -left-[15px] top-3.5 w-2 h-2 rounded-full ${
                        ev.narration_moment === selectedMoment
                          ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                          : "bg-zinc-500"
                      }`}
                    />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-200 text-sm font-medium">{ev.name || "Event"}</span>
                          {ev.narration_moment != null ? (
                            <span className="text-[10px] uppercase tracking-widest text-amber-400/60 font-mono shrink-0">
                              M.{ev.narration_moment}
                            </span>
                          ) : null}
                        </div>
                        {ev.description ? (
                          <p className="text-zinc-500 text-xs mt-0.5">{ev.description}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-zinc-400">
                          {ev.scene_title ? <span>{ev.scene_title}</span> : null}
                          {ev.narration_title ? (
                            <span className="text-zinc-500 italic">“{ev.narration_title}”</span>
                          ) : null}
                          {ev.action_description ? <span>{ev.action_description}</span> : null}
                          {ev.action_result ? (
                            <span className="capitalize text-cyan-400/80">{ev.action_result}</span>
                          ) : null}
                        </div>
                      </div>
                      {chips.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end shrink-0">
                          {chips.map((c) => (
                            <span
                              key={c.key}
                              className={`text-[10px] font-mono bg-zinc-900/70 border border-zinc-700/50 rounded px-1.5 py-0.5 ${c.cls}`}
                            >
                              {c.label} {c.value}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}