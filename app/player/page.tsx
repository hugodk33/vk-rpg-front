import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTable, GameTableCharacters, GameTableNpcs, Sheet, TableCharacter, TableNpc } from "@/lib/types";

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

export default async function PlayerDashboard() {
  const entries = await loadPlayerEntries();
  const tables = entries.map((e) => e.table);
  const characters = entries.map((e) => e.ch);
  const totalItems = characters.reduce((sum, c) => sum + (c.items?.length ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-amber-100">Player Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Player — {characters.length} character{characters.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-5 py-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{tables.length}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Tables</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-5 py-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{characters.length}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Characters</p>
        </div>
        <div className="bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-5 py-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{totalItems}</p>
          <p className="text-zinc-500 text-xs uppercase tracking-wider mt-1">Items</p>
        </div>
      </div>

      <h2 className="text-lg font-bold text-zinc-200 mb-4">My Characters</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map(({ table, ch }) => {
          const s = ch.sheet ?? ({} as Sheet);
          return (
            <div
              key={ch.id}
              className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden hover:border-emerald-700/50 transition-colors"
            >
              <div className="px-5 py-4 border-b border-zinc-700/40">
                <h3 className="text-lg font-bold text-zinc-100">{s.name || ch.name || "No name"}</h3>
                {table ? <p className="text-xs text-zinc-500 mt-0.5">{table.title}</p> : null}
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "ST", value: s.st, color: "text-red-400" },
                    { label: "DX", value: s.dx, color: "text-emerald-400" },
                    { label: "IQ", value: s.iq, color: "text-blue-400" },
                    { label: "HT", value: s.ht, color: "text-purple-400" },
                  ].map((a) => (
                    <div key={a.label} className="text-center">
                      <span className={`block ${a.color} font-bold`}>{a.value ?? "-"}</span>
                      <span className="text-zinc-600 text-xs uppercase">{a.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/character/${ch.id}`}
                    className="flex-1 text-center bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    Sheet
                  </Link>
                  {table ? (
                    <>
                      <Link
                        href={`/player/table/${table.id}`}
                        className="flex-1 text-center bg-emerald-700/60 hover:bg-emerald-600 text-emerald-100 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        Session
                      </Link>
                      <Link
                        href={`/player/table/${table.id}/scenes`}
                        className="flex-1 text-center bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                      >
                        Scenes
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
        {characters.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <p className="text-zinc-500 text-lg mb-2">No characters yet</p>
            <p className="text-zinc-600 text-sm">Join a table to create your first character</p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 text-center">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
