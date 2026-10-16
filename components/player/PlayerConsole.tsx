"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Advantage,
  CharacterViewer,
  Disadvantage,
  GameTable,
  Item,
  Location,
  LocationConnection,
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
import MapLog from "@/components/map/MapLog";
import CharacterSheet from "@/components/character/CharacterSheet";
import CharacterJourney from "@/components/character/CharacterJourney";
import CharacterGallery from "@/components/gallery/CharacterGallery";
import TableResources, { RESOURCE_TABS, type ResourceTab } from "@/components/player/TableResources";
import PlayerInventory from "@/components/player/PlayerInventory";
import { getSessionState } from "@/lib/session";
import { useTableLive } from "@/lib/useTableLive";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

/* ============================================================
   Player Console — one panel per character.
   A single tab bar unifies the player's flow:
     · SESSION  — the scene console (queue + dice, turn-gated).
     · JOURNEY  — the character's own evolution, moment by moment.
     · CHRONICLE— a dropdown: the Timeline (the table's read-only record)
                  and the Map (the battle-log floor plan — chapter, scene,
                  beat and move scrubbed one at a time, through the player's eyes).
· CHARACTERS / ITEMS / SKILLS / ADVANTAGES / DISADVANTAGES /
     LOCATIONS — the table's sandbox inline; each resource own
     its own button in the trail (read-only, through the player's eyes).
     · GEAR     — the player's own inventory: equip, store,
                  discard, sell and trade items.
     · SHEET    — the player's own sheet, visibility-aware.
   The narrator sees a full desk; the player sees a ritual built
   around waiting for their moment.
   ============================================================ */

export type PlayerTab =
  | "turn"
  | "journey"
  | "chronicle"
  | "map"
  | ResourceTab
  | "gear"
  | "sheet";

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
  connections: LocationConnection[];
  locationTree: Location[];
  defaultLocationId: string | null;
  npcs: TableNpc[];
  basePath: string;
  initialTab?: PlayerTab;
}

const icon = (path: string, cls = "w-4 h-4") => (
  <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={path} />
  </svg>
);

const RESOURCE_ICONS: Record<ResourceTab, string> = {
  characters: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  items: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4",
  skills: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  advantages: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  disadvantages: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM9.05 7.4a3 3 0 000 9.2M14.95 7.4a3 3 0 010 9.2M12 2a10 10 0 100 20 10 10 0 000-20z",
  locations: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z",
};

const MAP_ICON = "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7";
const CHRONICLE_ICON = "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253";

const TABS: Array<{ key: PlayerTab; labelKey: string; icon: string }> = [
  { key: "turn", labelKey: "pl.tab.session", icon: "M4 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm0 8a2 2 0 012-2h6a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" },
  { key: "journey", labelKey: "pl.tab.journey", icon: "M3 3v18h18M7 14l4-5 3 3 5-8" },
  { key: "chronicle", labelKey: "pl.tab.chronicle", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { key: "map", labelKey: "pl.tab.map", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  ...RESOURCE_TABS.map((r) => ({ key: r.key as PlayerTab, labelKey: r.labelKey, icon: RESOURCE_ICONS[r.key] })),
  { key: "gear", labelKey: "pl.tab.gear", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { key: "sheet", labelKey: "pl.tab.sheet", icon: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 16a3.001 3.001 0 00-2.83-2M15 11a2 2 0 11-4 0 2 2 0 014 0z" },
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
  connections,
  locationTree,
  defaultLocationId,
  npcs,
  basePath,
  initialTab = "sheet",
}: PlayerConsoleProps) {
  const [tab, setTab] = useState<PlayerTab>(initialTab);
  const { t } = useTranslation();
  const [tableOpen, setTableOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const [chronOpen, setChronOpen] = useState(false);
  const chronRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const name = character?.sheet?.name || character?.name || t("pl.console.yourCharacter");

  /* tempo real: a mesa muda (narração/fila/mapa) sem recarregar a página */
  useTableLive(tableId, () => router.refresh());

  useEffect(() => {
    if (!tableOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) setTableOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [tableOpen]);

  useEffect(() => {
    if (!chronOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (chronRef.current && !chronRef.current.contains(e.target as Node)) setChronOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [chronOpen]);

  const latestBeat = useMemo(() => getSessionState(scenes).latestBeat, [scenes]);

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

  const resourceActive = RESOURCE_TABS.some((r) => r.key === tab);
  const chronActive = tab === "chronicle" || tab === "map";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* heading */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">{t("pl.console.seatEyebrow")}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mt-1">{name}</h1>
          {table?.title ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">{table.title}</p>
          ) : null}
        </div>
        <Link
          href="/player"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-blue-300 transition-colors"
        >
          {icon("M15 19l-7-7 7-7", "w-4 h-4")} {t("pl.console.yourParty")}
        </Link>
      </div>

      {/* unified tab bar */}
      <div role="tablist" aria-label={t("pl.console.tablist")} className="inline-flex bg-zinc-800/50 border border-zinc-700/40 rounded-lg p-0.5 mb-6">
        {TABS.filter((r) => ["turn", "journey"].includes(r.key)).map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={tab === r.key}
            onClick={() => setTab(r.key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              tab === r.key ? "bg-zinc-700 text-blue-300" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {icon(r.icon, "w-3.5 h-3.5")} {t(r.labelKey)}
          </button>
        ))}

        {/* chronicle dropdown: timeline + map */}
        <div className="relative" ref={chronRef}>
          <button
            role="tab"
            aria-selected={chronActive}
            aria-haspopup="menu"
            aria-expanded={chronOpen}
            onClick={() => setChronOpen((o) => !o)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              chronActive ? "bg-zinc-700 text-blue-300" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {icon(CHRONICLE_ICON, "w-3.5 h-3.5")} {t("pl.console.chronicle")}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={chronOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>

          {chronOpen ? (
            <div
              role="menu"
              aria-label={t("pl.console.chronicleViews")}
              className="absolute left-0 top-full mt-1 z-20 min-w-[12rem] rounded-lg border border-zinc-700/50 bg-zinc-900 p-1 shadow-xl shadow-black/40"
            >
              <button
                role="menuitemradio"
                aria-checked={tab === "map"}
                onClick={() => {
                  setTab("map");
                  setChronOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                  tab === "map" ? "bg-zinc-800 text-blue-300" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60"
                }`}
              >
                {icon(MAP_ICON, "w-3.5 h-3.5")} {t("pl.console.map")}
              </button>
              <button
                role="menuitemradio"
                aria-checked={tab === "chronicle"}
                onClick={() => {
                  setTab("chronicle");
                  setChronOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                  tab === "chronicle" ? "bg-zinc-800 text-blue-300" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60"
                }`}
              >
                {icon(CHRONICLE_ICON, "w-3.5 h-3.5")} {t("pl.console.timeline")}
              </button>
            </div>
          ) : null}
        </div>

        {/* table resources dropdown */}
        <div className="relative" ref={tableRef}>
          <button
            role="tab"
            aria-selected={resourceActive}
            aria-haspopup="menu"
            aria-expanded={tableOpen}
            onClick={() => setTableOpen((o) => !o)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              resourceActive ? "bg-zinc-700 text-blue-300" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {icon(RESOURCE_ICONS.characters, "w-3.5 h-3.5")} {t("pl.console.table")}
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tableOpen ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
            </svg>
          </button>

          {tableOpen ? (
            <div
              role="menu"
              aria-label={t("pl.console.tableResources")}
              className="absolute left-0 top-full mt-1 z-20 min-w-[13rem] rounded-lg border border-zinc-700/50 bg-zinc-900 p-1 shadow-xl shadow-black/40"
            >
              {RESOURCE_TABS.map((r) => (
                <button
                  key={r.key}
                  role="menuitemradio"
                  aria-checked={tab === r.key}
                  onClick={() => {
                    setTab(r.key);
                    setTableOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
                    tab === r.key ? "bg-zinc-800 text-blue-300" : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60"
                  }`}
                >
                  {icon(RESOURCE_ICONS[r.key], "w-3.5 h-3.5")} {t(r.labelKey)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {TABS.filter((r) => ["gear", "sheet"].includes(r.key)).map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={tab === r.key}
            onClick={() => setTab(r.key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md font-mono text-[12px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
              tab === r.key ? "bg-zinc-700 text-blue-300" : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {icon(r.icon, "w-3.5 h-3.5")} {t(r.labelKey)}
          </button>
        ))}
      </div>

      {tab === "turn" ? (
        <TurnPanel
          tableId={tableId}
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
          locations={locations}
          latestBeat={latestBeat}
          visibility={visibility}
        />
      ) : null}

      {tab === "chronicle" ? (
        <SceneTimeline table={table} scenes={scenes} showEditButtons={false} role="player" viewerId={character?.id ?? undefined} visibility={visibility ?? undefined} />
      ) : null}

      {tab === "map" ? (
        <MapLog
          scenes={scenes}
          locations={locations}
          connections={connections}
          characters={roster}
          npcIds={npcs?.map((n) => n.character_id).filter(Boolean) as string[]}
          role="player"
          viewerId={character?.id ?? undefined}
          visibility={visibility}
          tableId={tableId}
          defaultLocationId={defaultLocationId}
        />
      ) : null}

      {tab === "journey" ? (
        <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/40 overflow-hidden">
          <div className="px-5 py-6">
            <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">{t("pl.console.journeyEyebrow")}</p>
            <h2 className="text-lg font-bold text-zinc-100 mt-1">{t("pl.console.evolution")}</h2>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-xl mb-5">
              {t("pl.console.journeyDesc")}
            </p>
            <CharacterJourney characterId={character?.id ?? ""} selectedMoment={null} viewerId={character?.id ?? undefined} />
          </div>
        </div>
      ) : null}

      {RESOURCE_TABS.some((r) => r.key === tab) && tableId ? (
        <div className="">
          <div className="pt-2">
            <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">{t("pl.res.eyebrow")}</p>
            <h2 className="text-lg font-bold text-zinc-100 mt-1">
              {t(RESOURCE_TABS.find((r) => r.key === tab)?.labelKey ?? "pl.res.title")}
            </h2>
            <p className="text-sm text-zinc-400 mt-1.5 max-w-xl mb-5">
              {t("pl.res.desc")}
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
              locationTree={locationTree}
              defaultLocationId={defaultLocationId}
              currentLocationId={latestBeat?.location?.id ?? null}
              tab={tab as ResourceTab}
            />
          </div>
        </div>
      ) : null}

      {tab === "gear" && character?.id ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">{t("pl.console.gearEyebrow")}</p>
            <h2 className="text-lg font-bold text-zinc-100">{t("pl.console.gearTitle")}</h2>
            <p className="text-sm text-zinc-400 max-w-xl">
              {t("pl.console.gearDesc")}
            </p>
          </div>
          <PlayerInventory items={character.items ?? []} characterId={character.id} roster={roster} targets={presentTargets} />
        </div>
      ) : null}

      {tab === "sheet" && viewer && character?.id ? (
        <div className="mb-6">
          <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">{t("fr.ch.images")}</p>
          <div className="mt-2">
            <CharacterGallery
              characterId={character.id}
              name={viewer.character.sheet?.name || viewer.character.name || ""}
              portraitUrl={viewer.character.portraitUrl}
              bodyUrl={viewer.character.bodyUrl}
              images={viewer.character.images ?? []}
            />
          </div>
        </div>
      ) : null}

      {tab === "sheet" && viewer ? (
        <CharacterSheet data={viewer} basePath={basePath} visibility={null} showName={false} />
      ) : null}
    </div>
  );
}
