import Link from "next/link";
import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import NarratorTabs from "@/components/NarratorTabs";

export const dynamic = "force-dynamic";

export default async function NarratorDashboard() {
  let tables: GameTable[] = [];
  try {
    tables = await api<GameTable[]>("/game-tables");
  } catch {
    tables = [];
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <NarratorTabs active="tables" />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-amber-100">Narrator Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Narrator — {tables.length} table{tables.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/table/new"
          className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Table
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tables.map((t) => (
          <div
            key={t.id}
            className="bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden hover:border-amber-700/50 transition-colors"
          >
            <div className="px-5 py-4 border-b border-zinc-700/40">
              <h2 className="text-lg font-bold text-zinc-100">{t.title || "Untitled"}</h2>
              {t.system ? (
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{t.system}</span>
              ) : null}
              {t.intro ? (
                <p className="text-zinc-400 text-sm mt-1.5 line-clamp-2">{t.intro}</p>
              ) : null}
            </div>
            <div className="px-5 py-4">
              <Link
                href={`/table/${t.id}`}
                className="block w-full text-center bg-amber-700/60 hover:bg-amber-600 text-amber-100 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
              >
                Open
              </Link>
            </div>
          </div>
        ))}
        {tables.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <p className="text-zinc-500 text-lg mb-2">No tables yet</p>
            <p className="text-zinc-600 text-sm">Create your first table to start the campaign</p>
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
