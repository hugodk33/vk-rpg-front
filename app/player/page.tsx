import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTable, GameTableCharacters, GameTableNpcs, Sheet, TableCharacter, TableNpc } from "@/lib/types";
import SeatPicker, { type SeatOption } from "@/components/player/SeatPicker";

export const dynamic = "force-dynamic";

interface PlayerEntry {
  table: GameTable;
  ch: TableCharacter;
}

async function loadPlayerEntries(): Promise<PlayerEntry[]> {
  try {
    const tables = await api<GameTable[]>("/game-tables");
    const entries: PlayerEntry[] = [];
    for (const t of tables) {
      const [chars, npcs] = await Promise.all([
        api<GameTableCharacters>(`/game-table-characters/${t.id}`),
        api<GameTableNpcs>(`/game-table-npcs/${t.id}`).catch(() => ({ table: null, npcs: [] })),
      ]);
      const npcIds = new Set((npcs?.npcs ?? []).map((n: TableNpc) => n.character_id));
      for (const ch of chars?.characters ?? []) {
        if (!npcIds.has(ch.id)) entries.push({ table: t, ch });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/* -------- sigil (per-character hue) -------- */

const PALETTE = [
  { dot: "#2dd4bf", ring: "#2dd4bf55" }, // teal
  { dot: "#38bdf8", ring: "#38bdf855" }, // sky
  { dot: "#a78bfa", ring: "#a78bfa55" }, // violet
  { dot: "#f472b6", ring: "#f472b655" }, // pink
  { dot: "#fbbf24", ring: "#fbbf2455" }, // amber
  { dot: "#34d399", ring: "#34d39955" }, // emerald
];

function hueFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  const h = PALETTE[sum % PALETTE.length];
  const letters = (name || "?").slice(0, 2).toUpperCase();
  return { ...h, letters };
}

/* -------- stats helpers -------- */

function statRow(s: Sheet) {
  return [
    { label: "ST", value: s.st ?? s.base_st, hex: "#f87171" },
    { label: "DX", value: s.dx ?? s.base_dx, hex: "#34d399" },
    { label: "IQ", value: s.iq ?? s.base_iq, hex: "#60a5fa" },
    { label: "HT", value: s.ht ?? s.base_ht, hex: "#a78bfa" },
  ];
}

function hpBar(s: Sheet) {
  const max = s.hp ?? s.base_hp ?? 0;
  const cur = s.current_hp ?? max;
  const pct = max ? Math.max(0, Math.min(1, cur / max)) : 0;
  return { max, cur, pct };
}

function seatOptionsFrom(entries: PlayerEntry[]): SeatOption[] {
  const seen = new Map<string, SeatOption>();
  for (const { ch } of entries) {
    const uid = ch.user?.id ?? ch.userId;
    if (uid && !seen.has(uid)) {
      seen.set(uid, { userId: uid, username: ch.user?.username ?? uid });
    }
  }
  return Array.from(seen.values());
}

export default async function PlayerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ seat?: string }>;
}) {
  const { seat } = await searchParams;
  const entries = await loadPlayerEntries();
  const seatOptions = seatOptionsFrom(entries);
  const shown = seat ? entries.filter((e) => (e.ch.user?.id ?? e.ch.userId) === seat) : entries;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* ---- hero ---- */}
      <div className="relative rounded-2xl border border-blue-600/30 bg-gradient-to-b from-zinc-900/70 to-zinc-950 p-6 mb-8 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1/2 opacity-[0.05] pointer-events-none select-none">
          <div className="absolute -bottom-14 -left-16 w-72 h-72 rounded-full border border-blue-500" />
          <div className="absolute top-4 -left-6 w-56 h-56 rounded-full border border-blue-500" />
        </div>
        <div className="relative">
          <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">At the table</p>
          <div className="flex flex-wrap items-end justify-between gap-4 mt-1">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-zinc-100">Your Company</h1>
              <p className="text-stone-400 text-sm mt-1.5">
                {shown.length === 0
                  ? "No adventurers yet — claim a seat in a campaign."
                  : `${shown.length} ${shown.length === 1 ? "adventurer" : "adventurers"} ride under your banner.`}
              </p>
            </div>
            {seatOptions.length > 0 ? <SeatPicker options={seatOptions} /> : null}
          </div>
        </div>
      </div>

      {/* ---- company (characters only) ---- */}
      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-blue-700/40 text-center py-20 bg-zinc-900/40">
          <div className="font-mono text-[10px] tracking-widest uppercase text-blue-400/60">Empty roster</div>
          <p className="text-zinc-300 mt-2 max-w-sm mx-auto text-sm">
            {seat
              ? "This user has no character seats yet — pick another user above."
              : "When a narrator adds you to a campaign and you claim a character, it will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map(({ table, ch }) => {
            const s = ch.sheet ?? ({} as Sheet);
            const name = s.name || ch.name || "Unnamed adventurer";
            const hue = hueFor(name);
            const hp = hpBar(s);
            const attrs = statRow(s);
            const sessionUrl = `/player/character/${ch.id}/session`;
            const sheetUrl = `/player/character/${ch.id}`;
            return (
              <div
                key={ch.id}
                className="group relative bg-zinc-900/60 border border-zinc-700/50 rounded-2xl overflow-hidden hover:border-blue-700/50 transition-colors flex flex-col sm:flex-row"
              >
                {/* hue rail */}
                <div className="hidden sm:block w-1 shrink-0" style={{ background: `linear-gradient(180deg, ${hue.dot}, ${hue.dot}33)` }} />

                <div className="flex-1 p-5 flex flex-col sm:flex-row items-start gap-4">
                  {/* sigil */}
                  <div className="relative flex items-center justify-center shrink-0" style={{ width: 56, height: 56 }}>
                    <svg viewBox="0 0 64 64" className="absolute inset-0" style={{ width: 56, height: 56 }}>
                      <circle cx="32" cy="32" r="27" fill="none" stroke={hue.ring} strokeWidth="1.5" />
                      <circle cx="32" cy="32" r="27" fill="none" stroke={hue.dot} strokeWidth="0.75" strokeDasharray="1.5 6" strokeDashoffset="14" />
                    </svg>
                    <span className="font-mono font-bold leading-none relative z-10" style={{ color: hue.dot, fontSize: 20, letterSpacing: "-0.02em" }}>
                      {hue.letters}
                    </span>
                  </div>

                  {/* identity + vitals */}
                  <div className="min-w-0 flex-1 w-full">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-zinc-100 leading-tight truncate">{name}</h2>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
                          {table ? table.title : "Unknown table"}
                        </p>
                      </div>
                      {hp.max ? (
                        <div className="text-right shrink-0">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block">HP</span>
                          <span className="font-mono text-sm font-bold text-red-300">{hp.cur}<span className="text-zinc-600">/</span>{hp.max}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                      {attrs.map((a) => (
                        <span key={a.label} className="inline-flex items-baseline gap-1">
                          <span className="font-mono text-[10px] uppercase text-zinc-600">{a.label}</span>
                          <span className="font-mono text-lg font-bold leading-none" style={{ color: a.hex }}>{a.value ?? "–"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* actions */}
                <div className="flex sm:flex-col gap-2 px-5 pb-5 sm:pb-0 sm:pr-5 sm:justify-center shrink-0">
                  <Link
                    href={sessionUrl}
                    className="flex-1 sm:flex-none text-center bg-blue-600 hover:bg-blue-500 text-blue-950 text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                  >
                    Enter Session
                  </Link>
                  <Link
                    href={`/player/table/${table.id}?user=${encodeURIComponent(seat ?? (ch.user?.id ?? ch.userId ?? ""))}&character=${encodeURIComponent(ch.id)}`}
                    className="flex-1 sm:flex-none text-center border border-zinc-700 hover:border-blue-700/60 text-zinc-300 hover:text-blue-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Table
                  </Link>
                  <Link
                    href={sheetUrl}
                    className="flex-1 sm:flex-none text-center border border-zinc-700 hover:border-blue-700/60 text-zinc-300 hover:text-blue-200 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Sheet
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="text-zinc-500 hover:text-blue-300 text-sm transition-colors">
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
