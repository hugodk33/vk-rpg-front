import Link from "next/link";
import { Activity, BookOpen, MapPin, Package, Skull, Sparkles, Users, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { getLang, makeT } from "@/lib/i18n-server";
import type {
  CharacterViewer,
  GameTable,
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableModifiers,
  GameTableNpcs,
  GameTableScenes,
  GameTableSkills,
} from "@/lib/types";
import { getSessionState } from "@/lib/session";
import TableTabs from "@/components/TableTabs";
import StoryRail from "@/components/scenes/StoryRail";
import SeatGrid from "@/components/table/SeatGrid";
import type { SeatData } from "@/components/table/SeatCard";
import { hueFor } from "@/lib/hue";
import TableQuickActions, {
  type QuickItem,
  type QuickTarget,
} from "@/components/table/TableQuickActions";

export const dynamic = "force-dynamic";

/* ============================================================
   The Campaign Ledger — the table overview as the cover page
   of a chronicle:
   - hero carries the campaign identity + the MARKER RIBBON,
     a bookmark plate recording where the story now rests;
   - a running status line (mono) gives the campaign's vital
     reading;
   - SEATING lists who is at the table, with live wounds;
   - THE ARCHIVE is a card-catalog of the records on file,
     grouped by the campaign's own lexicon.
   ============================================================ */

const ROMAN = ["0","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX"];
function roman(n: number): string {
  return ROMAN[Math.max(0, Math.min(ROMAN.length - 1, Math.floor(n)))] ?? String(n);
}

/* ---------- sigil ---------- */

function sigilLetters(title: string): string {
  const words = title.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function Sigil({ title, name }: { title: string; name: string }) {
  const hue = hueFor(title || name);
  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: 54, height: 54 }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0" style={{ width: 54, height: 54 }}>
        <circle cx="32" cy="32" r="27" fill="none" stroke={hue.ring} strokeWidth="1.5" />
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke={hue.dot}
          strokeWidth="0.75"
          strokeDasharray="1.5 6"
          strokeDashoffset="14"
        />
      </svg>
      <span
        className="font-mono font-bold leading-none relative z-10"
        style={{ color: hue.dot, fontSize: 20, letterSpacing: "-0.02em" }}
      >
        {sigilLetters(title)}
      </span>
    </div>
  );
}

/* ---------- archive ---------- */

interface ArchiveCell {
  group: string;
  name: string;
  unit: string;
  count: number;
  seal: string;
  icon: LucideIcon;
  href?: string;
  addHref?: string;
  addLabel?: string;
}

function ArchiveRow({ cell, t }: { cell: ArchiveCell; t: (key: string) => string }) {
  const Icon = cell.icon;
  return (
    <div
      className="group flex flex-col items-center text-center rounded-lg border border-l-[3px] border-zinc-700/40 bg-zinc-900/50 px-4 py-4 transition-colors hover:bg-zinc-800/40 hover:border-zinc-600/60"
      style={{ borderLeftColor: cell.seal }}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-lg border"
        style={{ background: `${cell.seal}14`, borderColor: `${cell.seal}55`, color: cell.seal }}
      >
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </span>
      <span className="block text-sm font-semibold text-zinc-100 mt-2.5 leading-tight">{cell.name}</span>
      <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-1">
        {cell.count} {cell.unit}
      </span>
      <span className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-zinc-700/40 w-full flex-wrap">
        {cell.href ? (
          <Link
            href={cell.href}
            className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest rounded-md border border-zinc-700/50 px-2 py-1 text-zinc-400 hover:text-zinc-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
          >
            {t("tp.open")}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ) : null}
        {cell.addHref ? (
          <Link
            href={cell.addHref}
            className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest rounded-md border border-green-700/25 bg-green-700/10 px-2 py-1 text-green-400 hover:bg-green-700/20 hover:text-green-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
          >
            + {cell.addLabel}
          </Link>
        ) : null}
      </span>
    </div>
  );
}

/* ---------- section header ---------- */

function LedgerHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</h2>
      <span className="flex-1 h-px bg-zinc-800" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{meta}</span>
    </div>
  );
}

/* ---------- page ---------- */

export default async function TableOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = makeT(await getLang());

  const [table, scenesRes, charsRes, itemsRes, advRes, disRes, skillsRes, npcsRes, modsRes] = await Promise.all([
    api<GameTable>(`/game-table/${id}`).catch(() => null as GameTable | null),
    api<GameTableScenes>(`/game-table-scenes/${id}`).catch(() => ({ table: null, scenes: [] })),
    api<GameTableCharacters>(`/game-table-characters/${id}`).catch(() => ({ table: null, characters: [] })),
    api<GameTableItems>(`/game-table-items/${id}`).catch(() => ({ table: null, items: [] })),
    api<GameTableAdvantages>(`/game-table-advantages/${id}`).catch(() => ({ table: null, advantages: [] })),
    api<GameTableDisadvantages>(`/game-table-disadvantages/${id}`).catch(() => ({ table: null, disadvantages: [] })),
    api<GameTableSkills>(`/game-table-skills/${id}`).catch(() => ({ table: null, skills: [] })),
    api<GameTableNpcs>(`/game-table-npcs/${id}`).catch(() => ({ table: null, npcs: [] })),
    api<GameTableModifiers>(`/game-table-modifiers/${id}`).catch(() => ({ table: null, modifiers: [] })),
  ]);

  const scenes = scenesRes?.scenes ?? [];
  const state = getSessionState(scenes);
  const hasChronicle = scenes.length > 0;

  /* live seats — per-character effect state for HP reading */
  const seats: SeatData[] = (
    await Promise.all(
      (table?.players ?? []).map(async (p): Promise<SeatData> => {
        const c = p.character;
        const base: SeatData = {
          id: c?.id ?? "",
          name: c?.name || p.username || t("tp.seat.noNamePlayer"),
          owner: p.username ?? t("tp.seat.player"),
          effects: [],
          hasSheet: false,
        };
        if (!c?.id) return base;
        const viewer = await api<CharacterViewer>(`/game-table-character/${c.id}`).catch(() => null);
        const sheet = viewer?.character?.sheet;
        if (!sheet) return base;
        const effects = viewer?.character?.active_effects ?? [];
        return {
          ...base,
          hasSheet: true,
          points: sheet.points,
          base: sheet.base_hp ?? sheet.hp ?? 0,
          current: sheet.hp ?? 0,
          effects,
        };
      })
    )
  ).filter((s) => s.hasSheet || s.id || (table?.players ?? []).length === 0);

  const seated = seats.filter((s) => s.hasSheet).length;

  /* npc seats — same per-character effect state as players */
  const npcs = npcsRes?.npcs ?? [];
  const npcSeats: SeatData[] = await Promise.all(
    npcs.map(async (n): Promise<SeatData> => {
      const base: SeatData = {
        id: n.character_id ?? "",
        name: n.name || n.status || t("tp.seat.noNameNpc"),
        owner: n.status || t("tp.seat.npc"),
        effects: [],
        hasSheet: false,
      };
      if (!n.character_id) return base;
      const viewer = await api<CharacterViewer>(`/game-table-character/${n.character_id}`).catch(() => null);
      const sheet = viewer?.character?.sheet;
      if (!sheet) return base;
      return {
        ...base,
        hasSheet: true,
        points: sheet.points,
        base: sheet.base_hp ?? sheet.hp ?? 0,
        current: sheet.hp ?? 0,
        effects: viewer?.character?.active_effects ?? [],
      };
    })
  );

  /* gm quick actions — every sheet-bearing character as a target */
  const quickTargets: QuickTarget[] = [
    ...seats
      .filter((s) => s.hasSheet && s.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: "player" as const,
        hp: s.current ?? null,
        baseHp: s.base ?? null,
        points: s.points ?? null,
      })),
    ...npcSeats
      .filter((s) => s.hasSheet && s.id)
      .map((s) => ({
        id: s.id,
        name: s.name,
        kind: "npc" as const,
        hp: s.current ?? null,
        baseHp: s.base ?? null,
        points: s.points ?? null,
      })),
  ];
  const quickItems: QuickItem[] = itemsRes?.items
    ? itemsRes.items.map((i: { id: string; name: string; cost?: number }) => ({ id: i.id, name: i.name, cost: i.cost }))
    : [];

  /* records on file */
  const characters = charsRes?.characters ?? [];
  const items = itemsRes?.items ?? [];
  const advantages = advRes?.advantages ?? [];
  const disadvantages = disRes?.disadvantages ?? [];
  const skills = skillsRes?.skills ?? [];

  const seenPlaces = new Set<string>();
  for (const scene of scenes) {
    for (const n of scene.narrations ?? []) {
      const loc = n.location;
      if (loc?.name && !seenPlaces.has(loc.name)) seenPlaces.add(loc.name);
    }
  }
  const places = seenPlaces.size;

  const recordTotal =
    characters.length + items.length + advantages.length + disadvantages.length + skills.length + places +
    (modsRes?.modifiers?.length ?? 0);

  const cells: ArchiveCell[] = [
    { group: "People", name: t("nav.characters"), unit: t("tp.unit.dossiers"), count: characters.length, seal: "#34d399", icon: Users, href: `/table/${id}/characters`, addHref: `/character/new?table_id=${id}`, addLabel: t("tp.add.character") },
    { group: "Gear", name: t("nav.items"), unit: t("tp.unit.records"), count: items.length, seal: "#f59e0b", icon: Package, href: `/table/${id}/items`, addHref: `/item/new?table_id=${id}`, addLabel: t("tp.add.item") },
    { group: "Traits", name: t("nav.advantages"), unit: t("tp.unit.records"), count: advantages.length, seal: "#818cf8", icon: Sparkles, href: `/table/${id}/advantages`, addHref: `/advantage/new?table_id=${id}`, addLabel: t("tp.add.advantage") },
    { group: "Traits", name: t("nav.disadvantages"), unit: t("tp.unit.records"), count: disadvantages.length, seal: "#f87171", icon: Skull, href: `/table/${id}/disadvantages`, addHref: `/disadvantage/new?table_id=${id}`, addLabel: t("tp.add.disadvantage") },
    { group: "Study", name: t("nav.skills"), unit: t("tp.unit.sheets"), count: skills.length, seal: "#a78bfa", icon: BookOpen, href: `/table/${id}/skills`, addHref: `/skill/new?table_id=${id}`, addLabel: t("tp.add.skill") },
    { group: "Places", name: t("nav.locations"), unit: t("tp.unit.places"), count: places, seal: "#2dd4bf", icon: MapPin, href: `/table/${id}/locations`, addHref: `/table/${id}/locations/new`, addLabel: t("tp.add.location") },
    { group: "Conditions", name: t("nav.modifiers"), unit: t("tp.unit.conditions"), count: modsRes?.modifiers?.length ?? 0, seal: "#f472b6", icon: Activity, href: `/table/${id}/modifiers`, addHref: `/table/${id}/modifiers?tab=new`, addLabel: t("tp.add.modifier") },
  ];

  const system = table?.system?.trim();
  const sealer = table?.narrator;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} active="overview" />

      {/* ---- campaign ledger ---- */}
      <section className="relative rounded-2xl border border-zinc-700/50 bg-gradient-to-b from-zinc-900/80 to-zinc-950">
        {/* ambience */}
        <div aria-hidden className="absolute inset-0 overflow-hidden rounded-2xl opacity-[0.06] pointer-events-none select-none">
          <div className="absolute -top-10 -right-8 w-80 h-80 rounded-full border border-green-700" />
          <div className="absolute -top-2 -right-2 w-64 h-64 rounded-full border border-green-700" />
          <div className="absolute top-10 right-8 w-44 h-44 rounded-full border border-green-700" />
          <span className="hidden md:block absolute right-56 top-1/2 -translate-y-1/2 font-mono font-bold text-[150px] leading-none text-zinc-900/70">
            {hasChronicle ? roman(state.chapter) : "·"}
          </span>
        </div>

        <div className="flex flex-col md:flex-row relative">
          <div className="flex-1 p-6 md:p-7 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Sigil title={table?.title ?? t("tp.ledger.title")} name={sealer?.name || t("tp.ledger.gm")} />
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-widest uppercase text-green-500/90">{t("tp.ledger.campaign")}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5 truncate">
                    {[sealer ? t("tp.ledger.ruledBy").replace("{name}", sealer.username) : null, system ? system.toUpperCase() : null]
                      .filter(Boolean)
                      .join(" · ") || t("tp.ledger.noSeed")}
                  </p>
                </div>
              </div>
              <Link
                href={`/table/${id}/edit`}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-200 transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60 px-2 py-1.5 -m-1.5 shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {t("tp.ledger.edit")}
              </Link>
            </div>

            <h1 className="text-[clamp(26px,5vw,44px)] font-bold tracking-tight text-green-100 leading-[1.05] mt-5">
              {table?.title || t("tp.ledger.title")}
            </h1>

            {table?.intro ? (
              <p className="text-stone-400 text-sm mt-4 max-w-2xl leading-relaxed">{table.intro}</p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---- running status line ---- */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 leading-none select-none">
        <span>{seated === 1 ? t("tp.count.seatsOne").replace("{n}", String(seated)) : t("tp.count.seatsMany").replace("{n}", String(seated))}</span>
        <span className="text-zinc-700">·</span>
        {hasChronicle ? (
          <>
            <span>
              {t("tp.chapter")} <span className="text-green-500/80">{roman(state.chapter)}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              {scenes.length === 1 ? t("tp.count.scenesOne").replace("{n}", String(scenes.length)) : t("tp.count.scenesMany").replace("{n}", String(scenes.length))}
            </span>
          </>
        ) : (
          <span className="italic">{t("tp.chronicle.awaiting")}</span>
        )}
        <span className="text-zinc-700">·</span>
        <span>
          {recordTotal === 1 ? t("tp.count.recordsInFileOne").replace("{n}", String(recordTotal)) : t("tp.count.recordsInFileMany").replace("{n}", String(recordTotal))}
        </span>
      </div>

      {/* ---- chronicle rail ---- */}
      {hasChronicle ? (
        <section className="mt-8">
          <StoryRail tableId={id} scenes={scenes} state={state} modifierCount={modsRes?.modifiers?.length ?? 0} />
        </section>
      ) : null}

      {/* ---- seating (players) ---- */}
      <section className="mt-8">
        <LedgerHeader title={t("tp.players")} meta={t("tp.seatedOf").replace("{a}", String(seated)).replace("{b}", String((table?.players ?? []).length))} />

        {seats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700/60 px-4 py-10 text-center">
            <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{t("tp.seats.emptyTitle")}</div>
            <p className="text-zinc-400 text-sm mt-2">{t("tp.seats.emptyBody")}</p>
            <Link
              href={`/character/new?table_id=${id}`}
              className="inline-flex items-center gap-1.5 mt-5 font-mono text-[10px] uppercase tracking-widest text-green-400 border border-green-700/30 bg-green-700/10 rounded-md px-3 py-2 hover:bg-green-700/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
            >
              + {t("tp.add.placeCharacter")}
            </Link>
          </div>
        ) : (
          <SeatGrid seats={seats} resetKey="players" pageSize={12} accent="green" />
        )}
      </section>

      {/* ---- npcs ---- */}
      {npcs.length > 0 ? (
        <section className="mt-8">
          <LedgerHeader title={t("tp.npcs")} meta={t("tp.npcsMarked").replace("{n}", String(npcs.length))} />
          <SeatGrid seats={npcSeats} hue={{ dot: "#38bdf8", ring: "#38bdf855" }} resetKey="npcs" pageSize={12} accent="teal" />
        </section>
      ) : null}

      {/* ---- gm quick actions ---- */}
      <section className="mt-8">
        <LedgerHeader title={t("tp.ledger.gmActions")} meta={t("tp.ledger.gmActionsMeta")} />
        <TableQuickActions tableId={id} targets={quickTargets} items={quickItems} />
      </section>

      {/* ---- archive ---- */}
      <section className="mt-8">
        <LedgerHeader title={t("tp.ledger.archive")} meta={t("tp.count.recordsInArchive").replace("{n}", String(recordTotal))} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {cells.map((cell) => (
            <ArchiveRow key={`${cell.group}-${cell.name}`} cell={cell} t={t} />
          ))}
        </div>
      </section>

      {/* ---- continue ---- */}
      <div className="mt-8 flex justify-end">
        <Link
          href={`/table/${id}/sessions`}
          className="inline-flex items-center gap-2 bg-green-800 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-green-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-800/60"
        >
          {hasChronicle ? t("tp.chronicle.continue") : t("tp.chronicle.open")}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5-5 5M18 12H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}