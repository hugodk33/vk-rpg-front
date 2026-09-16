"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  Advantage,
  CharacterViewer,
  Disadvantage,
  GameTable,
  Item,
  Location,
  NarrationAction,
  QueueEntry,
  Scene,
  SkillItem,
  TableCharacter,
  TableNpc,
  VisibilityRule,
} from "@/lib/types";
import TurnPanel from "@/components/player/PlayerSession";
import SceneTimeline from "@/components/scenes/SceneTimeline";
import CharacterSheet from "@/components/character/CharacterSheet";
import CharacterJourney from "@/components/character/CharacterJourney";
import TableResources from "@/components/player/TableResources";
import PlayerInventory from "@/components/player/PlayerInventory";

/* ============================================================
   Player Console — one panel per character.
   A single tab bar unifies the player's flow:
     · SESSION  — the scene console (queue + dice, turn-gated).
     · JOURNEY  — the character's own evolution, moment by moment.
     · CHRONICLE— the table's timeline, read-only.
· TABLE    — the table's sandbox inline: characters, items,
                skills, advantages, disadvantages and locations
                (read-only, through the player's eyes).
     · GEAR     — the player's own inventory: equip, store,
                  discard, sell and trade items.
     · SHEET    — the player's own sheet, visibility-aware.
   The narrator sees a full desk; the player sees a ritual built
   around waiting for their moment.
   ============================================================ */

export type PlayerTab = "turn" | "journey" | "chronicle" | "table" | "gear" | "sheet";

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
  latestNarrationId: string;
  visibility: VisibilityRule[] | null;
  items: Item[];
  skills: SkillItem[];
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  locations: Location[];
  npcs: TableNpc[];
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
  { key: "journey", label: "Journey", icon: "M3 3v18h18M7 14l4-5 3 3 5-8" },
  { key: "chronicle", label: "Chronicle", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "table", label: "Table", icon: "M3 6h18v12H3V6zm0 0V4m0 2v2m18-2V4m0 2v2M3 10h18M3 14h18M3 18h18M7 4v2M12 4v2M17 4v2" },
  { key: "gear", label: "Gear", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
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
  latestNarrationId,
  visibility,
  items,
  skills,
  advantages,
  disadvantages,
  locations,
  npcs,
  basePath,
  initialTab = "sheet",
}: PlayerConsoleProps) {
  const [tab, setTab] = useState<PlayerTab>(initialTab);
  const name = character?.sheet?.name || character?.name || "Your character";

  const presence = useMemo(() => {
    const latest = scenes.flatMap((s) => s.narrations).find((n) => n.id === latestNarrationId);
    if (!latest) return { hasPresence: false, presentIds: new Set<string>(), consciousIds: new Set<string>() };
    const presentIds = new Set<string>();
    const consciousIds = new Set<string>();
    for (const c of latest.characters ?? []) {
      presentIds.add(c.id);
      if (c.conscious !== false) consciousIds.add(c.id);
    }
    for (const n of latest.npcs ?? []) {
      if (n.characterId) presentIds.add(n.characterId);
    }
    return { hasPresence: true, presentIds, consciousIds };
  }, [scenes, latestNarrationId]);

  const presentTargets: TableCharacter[] = useMemo(() => {
    if (!presence.hasPresence) return roster;
    const pool = roster.filter(
      (c) => presence.presentIds.has(c.id) && presence.consciousIds.has(c.id)
    );
    const npcPool = (npcs ?? [])
      .filter((n) => n.character_id && presence.presentIds.has(n.character_id))
      .map((n) => ({ id: n.character_id!, name: n.name || "NPC", isNpc: true }) as TableCharacter);
    const seen = new Set(pool.map((c) => c.id));
    return [...pool, ...npcPool.filter((n) => !seen.has(n.id))];
  }, [presence, roster, npcs]);

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
          latestNarrationId={latestNarrationId}
          actions={actions}
          queue={queue}
          roster={roster}
          targets={presentTargets}
          myId={character?.id ?? ""}
          mySkills={character?.skills ?? []}
        />
      ) : null}

      {tab === "chronicle" ? (
        <SceneTimeline table={table} scenes={scenes} showEditButtons={false} role="player" viewerId={character?.id ?? undefined} visibility={visibility ?? undefined} />
      ) : null}

      {tab === "journey" ? (
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">Your journey</p>
            <h2 className="text-lg font-bold text-zinc-100 mt-1">Evolution</h2>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-xl mb-5">
              Each mark is a moment the dice or the story moved you — HP, FP and attributes
              tracked before and after, chapter by chapter.
            </p>
            <CharacterJourney characterId={character?.id ?? ""} selectedMoment={null} viewerId={character?.id ?? undefined} />
          </div>
        </div>
      ) : null}

      {tab === "table" && tableId ? (
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">The Table</p>
            <h2 className="text-lg font-bold text-zinc-100 mt-1">{table?.title || "Table resources"}</h2>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-xl mb-5">
              Everything the table shares with your seat: characters, items, skills and the
              party&rsquo;s advantages and disadvantages — read-only, through your own eyes.
            </p>
            <TableResources
              roster={roster}
              myId={character?.id ?? undefined}
              npcs={npcs}
              items={items}
              skills={skills}
              advantages={advantages}
              disadvantages={disadvantages}
              locations={locations}
            />
          </div>
        </div>
      ) : null}

      {tab === "gear" && character?.id ? (
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">Your gear</p>
            <h2 className="text-lg font-bold text-zinc-100 mt-1">Inventory</h2>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-xl mb-5">
              Equip, store, discard, sell or trade the items your character carries.
            </p>
            <PlayerInventory items={character.items ?? []} characterId={character.id} roster={roster} targets={presentTargets} />
          </div>
        </div>
      ) : null}

      {tab === "sheet" && viewer ? (
        <CharacterSheet data={viewer} basePath={basePath} visibility={null} />
      ) : null}
    </div>
  );
}
