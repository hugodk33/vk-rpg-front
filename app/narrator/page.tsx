import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTable, TableCharacter } from "@/lib/types";
export const dynamic = "force-dynamic";

/* ---------- campaign sigil ---------- */

function sigilLetters(title: string): string {
  const words = title.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const PALETTE = [
  { dot: "#fbbf24", ring: "#fbbf2455" }, // amber
  { dot: "#34d399", ring: "#34d39955" }, // emerald
  { dot: "#38bdf8", ring: "#38bdf855" }, // sky
  { dot: "#f472b6", ring: "#f472b655" }, // pink
  { dot: "#a78bfa", ring: "#a78bfa55" }, // violet
  { dot: "#fb923c", ring: "#fb923c55" }, // orange
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

/* ---------- stats ---------- */

function partyStats(table: GameTable) {
  const chars = (table.players ?? []).map((p) => p.character).filter(Boolean) as TableCharacter[];
  const totalPoints = chars.reduce((acc, c) => acc + (c.sheet?.points ?? 0), 0);
  return { count: chars.length, totalPoints };
}

function RosterChip({ name, points, hp, baseHp }: { name: string; points?: number; hp?: number; baseHp?: number }) {
  const hue = hueFor(name);
  const maxHp = baseHp ?? hp ?? 0;
  const hpPct = maxHp ? Math.max(0, Math.min(1, (hp ?? 0) / maxHp)) : 0;
  return (
    <div className="flex items-center gap-2 bg-zinc-950/60 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 min-w-0">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hue.dot, boxShadow: `0 0 6px ${hue.ring}` }} />
      <div className="min-w-0 leading-tight">
        <div className="text-xs text-zinc-200 truncate max-w-[9rem]">{name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="font-mono text-[9px] uppercase text-amber-400/80">PTS {points ?? "–"}</span>
          {maxHp ? (
            <span className="flex items-center gap-1">
              <span className="w-8 h-1 rounded-full bg-zinc-700/70 overflow-hidden">
                <span className="block h-full rounded-full bg-red-400/80" style={{ width: `${hpPct * 100}%` }} />
              </span>
              <span className="font-mono text-[9px] text-zinc-400">{hp}/{maxHp}</span>
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyParty() {
  return (
    <div className="flex items-center gap-2 text-zinc-600 text-xs font-mono italic">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      No party signed up yet — recruit players to make the story theirs.
    </div>
  );
}

export default async function NarratorDashboard() {
  let tables: GameTable[] = [];
  try {
    tables = await api<GameTable[]>("/game-tables");
  } catch {
    tables = [];
  }

  const narratorName = tables.find((t) => t.narrator)?.narrator?.username || "the Narrator";
  const withParty = tables.filter((t) => (t.players ?? []).some((p) => p.character)).length;
  const totalPlayers = tables.reduce((acc, t) => acc + partyStats(t).count, 0);
  const sealer = tables.find((t) => t.narrator)?.narrator;

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* ---- GM desk hero ---- */}
      <div className="rounded-2xl border border-zinc-700/50 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-6 mb-6 overflow-hidden relative">
        <div className="absolute inset-y-0 right-0 w-1/2 opacity-[0.06] pointer-events-none select-none">
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full border border-amber-500" />
          <div className="absolute -top-4 -right-4 w-56 h-56 rounded-full border border-amber-500" />
          <div className="absolute top-6 right-6 w-40 h-40 rounded-full border border-amber-500" />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 relative">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-amber-400/90">GM Desk</p>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mt-1">Command Center</h1>
            <p className="text-stone-400 text-sm mt-1.5">Welcome, {narratorName}. The table awaits its storyteller.</p>
          </div>
          <Link
            href="/table/new"
            className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-amber-900/30"
          >
            + New Table
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6 relative">
          {[
            { label: "Campaigns", value: tables.length },
            { label: "Tables with party", value: withParty },
            { label: "Party members", value: totalPlayers },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-zinc-700/40 bg-zinc-900/60 px-4 py-3">
              <div className="font-mono text-2xl font-bold text-amber-300 leading-none">{s.value}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- campaign dossiers ---- */}
      {tables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-700/60 text-center py-20">
          <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">No campaigns yet</div>
          <p className="text-zinc-300 text-lg mt-2">Found your first table and begin a campaign.</p>
          <Link
            href="/table/new"
            className="inline-block mt-5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            + Found a Table
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {tables.map((t) => {
            const { count, totalPoints } = partyStats(t);
            const chars = (t.players ?? []).map((p) => p.character).filter(Boolean) as TableCharacter[];
            return (
              <div
                key={t.id}
                className="group bg-zinc-900/70 border border-zinc-700/50 rounded-2xl overflow-hidden hover:border-amber-700/50 transition-colors flex flex-col"
              >
                <div className="p-5 flex items-start gap-4 border-b border-zinc-700/40">
                  <Sigil title={t.title} name={sealer?.name || "GM"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-zinc-100 leading-tight">{t.title || "Untitled"}</h2>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400/80">
                        {t.system || "System"}
                      </span>
                      <span className="text-zinc-700">·</span>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        {count} in party
                      </span>
                      {count > 0 ? (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                            {totalPoints} pts
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {t.intro ? (
                  <p className="px-5 pt-3 text-sm text-stone-400 leading-relaxed line-clamp-2">{t.intro}</p>
                ) : null}

                <div className="px-5 py-4 flex-1">
                  {chars.length ? (
                    <div className="flex flex-wrap gap-2">
                      {chars.map((c) => (
                        <RosterChip
                          key={c.id}
                          name={c.name || "Unnamed"}
                          points={c.sheet?.points}
                          hp={c.sheet?.hp}
                          baseHp={c.sheet?.base_hp}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyParty />
                  )}
                </div>

                <div className="px-5 pb-5">
                  <Link
                    href={`/table/${t.id}`}
                    className="block w-full text-center bg-amber-700/60 group-hover:bg-amber-600 text-amber-50 text-sm font-semibold px-3 py-2.5 rounded-lg transition-colors"
                  >
                    Open Table
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
