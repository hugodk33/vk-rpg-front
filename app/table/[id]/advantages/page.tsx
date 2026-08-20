"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Advantage, GameTableAdvantages } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

export default function TableAdvantagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<GameTableAdvantages | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<GameTableAdvantages>(`/game-table-advantages/${id}`).then(setData).catch(() => setData({ table: null, advantages: [] }));
  }, [id]);

  const advantages = (data?.advantages ?? []).filter((a: Advantage) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (a.name ?? "").toLowerCase().includes(q)
      || (a.description ?? "").toLowerCase().includes(q)
      || (a.category ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <TableTabs tableId={id} />
      <h1 className="text-2xl font-bold text-amber-100 mb-4">
        {data?.table?.title || "Table"} — Advantages
      </h1>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search advantages..."
          className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-700/60"
        />
        <button
          type="button"
          onClick={() => setSearch("")}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Clear
        </button>
      </div>

      {advantages.length === 0 ? (
        <p className="text-zinc-500 italic">No advantages found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {advantages.map((a: Advantage) => (
            <div key={a.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-zinc-200 font-medium">{a.name || "Unnamed"}</span>
                <span className="text-emerald-400 text-xs font-semibold">{a.cost_points ?? ""}</span>
              </div>
              {a.category ? (
                <span className="text-xs text-zinc-500">
                  {a.category}
                  {a.subcategory ? ` / ${a.subcategory}` : ""}
                </span>
              ) : null}
              {a.description ? <p className="text-zinc-500 text-xs mt-1">{a.description}</p> : null}
              <div className="mt-2">
                <Link href={`/advantage/${a.id}/edit?table_id=${id}`} className="text-xs text-amber-400 hover:text-amber-300">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
