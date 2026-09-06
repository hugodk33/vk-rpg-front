"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  CharacterViewer,
  GameTable,
  NarrationAction,
  QueueEntry,
  Scene,
  TableCharacter,
  VisibilityRule,
} from "@/lib/types";
import TurnPanel from "@/components/player/PlayerSession";
import SceneTimeline from "@/components/scenes/SceneTimeline";
import CharacterSheet from "@/components/character/CharacterSheet";
import PlayerTablePanel from "@/components/player/PlayerTablePanel";

/* ============================================================
   Player Console — one panel per character.
   A single tab bar unifies the player's flow:
     · SESSION  — the scene console (queue + dice, turn-gated).
     · CHRONICLE— the table's timeline, read-only.
     · TABLE    — the table's sandbox: items, npcs, skills,
                  advantages and disadvantages (read-only).
     · SHEET    — the player's own sheet, visibility-aware.
   The narrator sees a full desk; the player sees a ritual built
   around waiting for their moment.
   ============================================================ */

export type PlayerTab = "turn" | "chronicle" | "table" | "sheet";

interface PlayerConsoleProps {
  character: TableCharacter | null;
  viewer: CharacterViewer | null;
  tableId: string;
  roster: TableCharacter[];
  table: GameTable | null;
  scenes: Scene[];
  actions: NarrationAction[];
  queue: QueueEntry[];
  chapter: number;
  part: string;
  latestTitle: string;
  latestNarration: string;
  visibility: VisibilityRule[];
  basePath: string;
  initialTab?: PlayerTab;
}

const icon = (path: string, cls = "w-4 h-4") => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
  </svg>
);

const TABS: Array<{ key: PlayerTab; label: string; icon: string }> = [
  { key: "turn", label: "Session", icon: "M4 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm0 8a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" },
  { key: "chronicle", label: "Chronicle", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "table", label: "Table", icon: "M3 6h18v12H3V6zm0 0V4m0 2v2m18-2V4m0 2v2M3 10h18M3 14h18M3 18h18M7 4v2M12 4v2M17 4v2" },
  { key: "sheet", label: "Sheet", icon: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 16a3.001 3.001 0 00-2.83-2M15 11a2 2 0 11-4 0 2 2 0 014 0z" },
];

export default function PlayerConsole({
  character,
  viewer,
  tableId,
  roster,
  table,
  scenes,
  actions,
  queue,
  chapter,
  part,
  latestTitle,
  latestNarration,
  visibility,
  basePath,
  initialTab = "sheet",
}: PlayerConsoleProps) {
  const [tab, setTab] = useState<PlayerTab>(initialTab);
  const myId = character?.id ?? "";
  const name = character?.sheet?.name || character?.name || "Your character";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* heading */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">Your seat at the table</p>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mt-1">{name}</h1>
          {table?.title ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">{table.title}</p>
          ) : null}
        </div>
        <Link
          href="/player"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-300 transition-colors"
        >
          {icon("M15 19l-7-7 7-7", "w-4 h-4")} Your company
        </Link>
      </div>

      {/* unified tab bar */}
      <div role="tablist" aria-label="Player console" className="inline-flex bg-zinc-800/50 border border-zinc-700/40 rounded-lg p-0.5 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              tab === t.key ? "bg-zinc-700 text-blue-300" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {icon(t.icon, "w-3.5 h-3.5")} {t.label}
          </button>
        ))}
      </div>

      {tab === "turn" ? (
        <TurnPanel
          chapter={chapter}
          part={part}
          latestTitle={latestTitle}
          latestNarration={latestNarration}
          actions={actions}
          queue={queue}
          roster={roster}
          myId={myId}
        />
      ) : null}

      {tab === "chronicle" ? (
        <SceneTimeline table={table} scenes={scenes} showEditButtons={false} role="player" />
      ) : null}

      {tab === "table" ? <PlayerTablePanel tableId={tableId} viewerId={character?.id ?? ""} /> : null}

      {tab === "sheet" && viewer ? (
        <CharacterSheet data={viewer} basePath={basePath} visibility={visibility} />
      ) : null}
    </div>
  );
}
