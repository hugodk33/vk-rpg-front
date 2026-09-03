import Link from "next/link";
import { api } from "@/lib/api";
import type {
  CharacterViewer,
  GameTable,
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableNpcs,
  GameTableScenes,
  GameTableSkills,
  Modifier,
  TableNpc,
} from "@/lib/types";
import { getSessionState } from "@/lib/session";
import TableTabs from "@/components/TableTabs";

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

const PALETTE = [
  { dot: "#fbbf24", ring: "#fbbf2455" },
  { dot: "#34d399", ring: "#34d39955" },
  { dot: "#38bdf8", ring: "#38bdf855" },
  { dot: "#f472b6", ring: "#f472b655" },
  { dot: "#a78bfa", ring: "#a78bfa55" },
  { dot: "#fb923c", ring: "#fb923c55" },
];

function hueFor(name: string): (typeof PALETTE)[number] {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
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

/* ---------- marker ribbon (signature) ---------- */

function MarkerRibbon({ chapter, part, title, hasChronicle }: { chapter: number; part: string; title: string; hasChronicle: boolean }) {
  return (
    <div className="relative md:w-60 md:shrink-0 border-t md:border-l md:border-t-0 border-amber-500/20 bg-zinc-950/50 md:rounded-r-2xl">
      <div className="p-5 h-full">
        <p className="font-mono text-[9px] tracking-widest uppercase text-amber-400/80">Marker</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-bold leading-none text-amber-300">CH·{roman(chapter)}</span>
        </div>
        <div className="mt-2 font-mono text-[10px] tracking-widest uppercase text-blue-300/90">
          Scene {part}
        </div>
        <p className="mt-1.5 text-sm leading-snug text-zinc-300">
          {hasChronicle ? title || "A new scene lies ahead." : "The chronicle waits for its first scene."}
        </p>
      </div>
      <span aria-hidden className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]" />
    </div>
  );
}

/* ---------- seating ---------- */

interface Seat {
  id: string;
  name: string;
  owner: string;
  points?: number;
  base?: number;
  current?: number;
  effects: Modifier[];
  hasSheet: boolean;
}

function hpPct(current: number, base: number): number {
  return base ? Math.max(0, Math.min(100, (current / base) * 100)) : 0;
}

function SeatRow({ s }: { s: Seat }) {
  const linkable = s.id.length > 0;
  const maxN = Math.max(s.base ?? 0, s.current ?? 0);
  return (
    <Link
      href={linkable ? `/character/${s.id}` : "#"}
      aria-disabled={!linkable}
      className="group flex flex-col flex-1 rounded-lg border border-zinc-700/40 bg-zinc-900/60 px-3.5 py-2.5 min-w-[15rem] hover:border-amber-600/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
    >
      <span className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hueFor(s.name).dot, boxShadow: `0 0 6px ${hueFor(s.name).ring}` }} />
        <span className="block text-sm font-medium text-zinc-200 leading-tight break-words">{s.name}</span>
      </span>
      <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5 ml-4 break-words">
        {s.owner}
      </span>

      {s.hasSheet ? (
        <span className="grid grid-cols-3 items-center gap-2 mt-2.5 pt-2.5 border-t border-zinc-700/40">
          <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400/80 whitespace-nowrap">
            Pts {s.points ?? "–"}
          </span>
          <span className="flex items-center gap-1.5 min-w-0" title={`${s.current ?? s.base}/${s.base} HP`}>
            <span className="flex-1 w-14 h-1.5 rounded-full bg-zinc-700/70 overflow-hidden">
              <span
                className="block h-full rounded-full bg-red-400/90"
                style={{ width: `${hpPct(s.current ?? s.base ?? 0, maxN)}%` }}
              />
            </span>
            <span className="font-mono text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">
              {s.current ?? s.base}/{s.base}
            </span>
          </span>
          <span className="flex justify-end">
            {s.effects.length > 0 ? (
              <span
                title={s.effects.map((e) => e.name).filter(Boolean).join(", ") || "Modifiers applied"}
                className="font-mono text-[9px] uppercase tracking-widest text-rose-300/90 bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5 whitespace-nowrap"
              >
                {s.effects.length} effect{s.effects.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 whitespace-nowrap">No effects</span>
            )}
          </span>
        </span>
      ) : (
        <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-2.5 pt-2.5 border-t border-zinc-700/40">
          No sheet yet
        </span>
      )}
    </Link>
  );
}

/* ---------- npc card ---------- */

function NpcCard({ n }: { n: TableNpc }) {
  const id = n.character_id ?? "";
  return (
    <Link
      href={id ? `/character/${id}` : "#"}
      aria-disabled={!id}
      className="group flex flex-1 items-center gap-3 rounded-lg border border-zinc-700/40 bg-zinc-900/60 px-3.5 py-2.5 min-w-[15rem] hover:border-zinc-500/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
    >
      <span className="w-2 h-2 rounded-full shrink-0 bg-sky-400" style={{ boxShadow: "0 0 6px rgba(56,189,248,0.6)" }} />
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-medium text-zinc-200 break-words">{n.name || "Unnamed NPC"}</span>
        <span className="block font-mono text-[9px] uppercase tracking-widest text-sky-400/80 mt-0.5 break-words">
          {n.status || "NPC"}
        </span>
      </span>
    </Link>
  );
}

/* ---------- archive ---------- */

interface ArchiveCell {
  group: string;
  name: string;
  unit: string;
  count: number;
  seal: string;
  href?: string;
  addHref?: string;
  addLabel?: string;
}

function ArchiveRow({ cell }: { cell: ArchiveCell }) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3.5 border-b border-zinc-700/30 last:border-b-0 hover:bg-zinc-800/30 transition-colors">
      <span className="hidden sm:block w-20 shrink-0 font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-600">{cell.group}</span>
      <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: cell.seal, boxShadow: `0 0 8px ${cell.seal}40` }} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-200">{cell.name}</span>
        <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">
          {cell.count} {cell.unit}
        </span>
      </span>
      <span className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {cell.href ? (
          <Link
            href={cell.href}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest rounded-md border border-zinc-700/50 px-2.5 py-1.5 text-zinc-400 hover:text-zinc-100 group-hover:border-zinc-600/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          >
            Open
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ) : null}
        {cell.addHref ? (
          <Link
            href={cell.addHref}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
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

  const [table, scenesRes, charsRes, itemsRes, advRes, disRes, skillsRes, npcsRes] = await Promise.all([
    api<GameTable>(`/game-table/${id}`).catch(() => null as GameTable | null),
    api<GameTableScenes>(`/game-table-scenes/${id}`).catch(() => ({ table: null, scenes: [] })),
    api<GameTableCharacters>(`/game-table-characters/${id}`).catch(() => ({ table: null, characters: [] })),
    api<GameTableItems>(`/game-table-items/${id}`).catch(() => ({ table: null, items: [] })),
    api<GameTableAdvantages>(`/game-table-advantages/${id}`).catch(() => ({ table: null, advantages: [] })),
    api<GameTableDisadvantages>(`/game-table-disadvantages/${id}`).catch(() => ({ table: null, disadvantages: [] })),
    api<GameTableSkills>(`/game-table-skills/${id}`).catch(() => ({ table: null, skills: [] })),
    api<GameTableNpcs>(`/game-table-npcs/${id}`).catch(() => ({ table: null, npcs: [] })),
  ]);

  const scenes = scenesRes?.scenes ?? [];
  const state = getSessionState(scenes);
  const hasChronicle = scenes.length > 0;

  /* live seats — per-character effect state for HP reading */
  const seats: Seat[] = (
    await Promise.all(
      (table?.players ?? []).map(async (p): Promise<Seat> => {
        const c = p.character;
        const base: Seat = {
          id: c?.id ?? "",
          name: c?.name || p.username || "Unnamed player",
          owner: p.username ?? "Player",
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

  /* records on file */
  const characters = charsRes?.characters ?? [];
  const items = itemsRes?.items ?? [];
  const advantages = advRes?.advantages ?? [];
  const disadvantages = disRes?.disadvantages ?? [];
  const skills = skillsRes?.skills ?? [];
  const npcs = npcsRes?.npcs ?? [];

  const seenPlaces = new Set<string>();
  for (const scene of scenes) {
    for (const n of scene.narrations ?? []) {
      const loc = n.location;
      if (loc?.name && !seenPlaces.has(loc.name)) seenPlaces.add(loc.name);
    }
  }
  const places = seenPlaces.size;

  const recordTotal =
    characters.length + items.length + advantages.length + disadvantages.length + skills.length + places;

  const cells: ArchiveCell[] = [
    { group: "People", name: "Characters", unit: "dossiers", count: characters.length, seal: "#34d399", href: `/table/${id}/characters`, addHref: `/character/new?table_id=${id}`, addLabel: "New character" },
    { group: "Gear", name: "Items", unit: "records", count: items.length, seal: "#f59e0b", href: `/table/${id}/items`, addHref: `/item/new?table_id=${id}`, addLabel: "New item" },
    { group: "Traits", name: "Advantages", unit: "records", count: advantages.length, seal: "#818cf8", href: `/table/${id}/advantages`, addHref: `/advantage/new?table_id=${id}`, addLabel: "New advantage" },
    { group: "Traits", name: "Disadvantages", unit: "records", count: disadvantages.length, seal: "#f87171", href: `/table/${id}/disadvantages`, addHref: `/disadvantage/new?table_id=${id}`, addLabel: "New disadvantage" },
    { group: "Study", name: "Skills", unit: "folios", count: skills.length, seal: "#a78bfa", href: `/table/${id}/skills` },
    { group: "Places", name: "Locations", unit: "places", count: places, seal: "#2dd4bf", href: `/table/${id}/locations` },
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
          <div className="absolute -top-10 -right-8 w-80 h-80 rounded-full border border-amber-500" />
          <div className="absolute -top-2 -right-2 w-64 h-64 rounded-full border border-amber-500" />
          <div className="absolute top-10 right-8 w-44 h-44 rounded-full border border-amber-500" />
          <span className="hidden md:block absolute right-56 top-1/2 -translate-y-1/2 font-mono font-bold text-[150px] leading-none text-zinc-900/70">
            {hasChronicle ? roman(state.chapter) : "·"}
          </span>
        </div>

        <div className="flex flex-col md:flex-row relative">
          <div className="flex-1 p-6 md:p-7 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <Sigil title={table?.title ?? "The Ledger"} name={sealer?.name || "GM"} />
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-widest uppercase text-amber-400/90">Campaign Ledger</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5 truncate">
                    {[sealer ? `Ruled by ${sealer.username}` : null, system ? system.toUpperCase() : null]
                      .filter(Boolean)
                      .join(" · ") || "An unseeded table"}
                  </p>
                </div>
              </div>
              <Link
                href={`/table/${id}/edit`}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-200 transition-colors rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 px-2 py-1.5 -m-1.5 shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit ledger
              </Link>
            </div>

            <h1 className="text-[clamp(26px,5vw,44px)] font-bold tracking-tight text-amber-100 leading-[1.05] mt-5">
              {table?.title || "The Ledger"}
            </h1>

            {table?.intro ? (
              <p className="text-stone-400 text-sm mt-4 max-w-2xl leading-relaxed">{table.intro}</p>
            ) : null}
          </div>

          <MarkerRibbon
            chapter={hasChronicle ? state.chapter : 1}
            part={hasChronicle ? state.part : "1"}
            title={hasChronicle ? state.latestTitle : ""}
            hasChronicle={hasChronicle}
          />
        </div>
      </section>

      {/* ---- running status line ---- */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 leading-none select-none">
        <span>{seated} seat{seated === 1 ? "" : "s"}</span>
        <span className="text-zinc-700">·</span>
        {hasChronicle ? (
          <>
            <span>
              Chapter <span className="text-amber-400/80">{roman(state.chapter)}</span>
            </span>
            <span className="text-zinc-700">·</span>
            <span>
              {scenes.length} scene{scenes.length === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className="italic">The chronicle awaits its first scene</span>
        )}
        <span className="text-zinc-700">·</span>
        <span>
          {recordTotal} record{recordTotal === 1 ? "" : "s"} on file
        </span>
      </div>

      {/* ---- seating (players) ---- */}
      <section className="mt-8">
        <LedgerHeader title="Players" meta={`${seated} of ${(table?.players ?? []).length} seated`} />

        {seats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700/60 px-4 py-10 text-center">
            <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">No seats yet</div>
            <p className="text-zinc-400 text-sm mt-2">
              Players sit at this table as characters are placed here.
            </p>
            <Link
              href={`/character/new?table_id=${id}`}
              className="inline-flex items-center gap-1.5 mt-5 font-mono text-[10px] uppercase tracking-widest text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md px-3 py-2 hover:bg-amber-500/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            >
              + Place a character
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {seats.map((s) => (
              <SeatRow key={s.id || s.name} s={s} />
            ))}
          </div>
        )}
      </section>

      {/* ---- npcs ---- */}
      {npcs.length > 0 ? (
        <section className="mt-8">
          <LedgerHeader title="NPCs" meta={`${npcs.length} marked as NPC`} />
          <div className="flex flex-wrap gap-2">
            {npcs.map((n) => (
              <NpcCard key={n.id || n.character_id || n.name} n={n} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ---- archive ---- */}
      <section className="mt-8">
        <LedgerHeader title="The Archive" meta={`${recordTotal} records on file`} />
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 overflow-hidden">
          {cells.map((cell) => (
            <ArchiveRow key={`${cell.group}-${cell.name}`} cell={cell} />
          ))}
        </div>
      </section>

      {/* ---- continue ---- */}
      <div className="mt-8 flex justify-end">
        <Link
          href={`/table/${id}/sessions`}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-lg shadow-amber-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          {hasChronicle ? "Continue the chronicle" : "Open the chronicle"}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5-5 5M18 12H6" />
          </svg>
        </Link>
      </div>
    </div>
  );
}