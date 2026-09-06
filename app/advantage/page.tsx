"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Advantage, GameTableAdvantages } from "@/lib/types";
import { api } from "@/lib/api";

interface CatalogEntry extends Advantage {
  tableTitle?: string;
}

const TYPE_CONFIG: Record<string, { color: string; active: string }> = {
  Physical: {
    color: "text-amber-400",
    active: "bg-amber-400/10 border-amber-400/40 text-amber-300",
  },
  Mental: {
    color: "text-violet-400",
    active: "bg-violet-400/10 border-violet-400/40 text-violet-300",
  },
  Social: {
    color: "text-teal-400",
    active: "bg-teal-400/10 border-teal-400/40 text-teal-300",
  },
};

export default function AdvantagesPage() {
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const tables = await api<Array<{ id: string; title?: string }>>("/game-tables");
        const results = await Promise.all(
          tables.map(async (table) => {
            try {
              const data = await api<GameTableAdvantages>(`/game-table-advantages/${table.id}`);
              return (data.advantages ?? []).map((advantage) => ({
                ...advantage,
                tableTitle: table.title,
              }));
            } catch {
              return [];
            }
          }),
        );
        if (!cancelled) {
          const seen = new Set<string>();
          const merged = results
            .flat()
            .filter((entry) => {
              if (!entry.id || seen.has(entry.id)) return false;
              seen.add(entry.id);
              return true;
            })
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
          setEntries(merged);
        }
      } catch {
        if (!cancelled) setEntries([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries ?? []) {
      if (entry.category) set.add(entry.category);
    }
    return ["All", ...Array.from(set).sort()];
  }, [entries]);

  const filtered = (entries ?? []).filter((entry) => {
    if (category !== "All" && entry.category !== category) return false;
    if (!search) return true;
    const query = search.toLowerCase();
    return (
      (entry.name ?? "").toLowerCase().includes(query)
      || (entry.description ?? "").toLowerCase().includes(query)
      || (entry.category ?? "").toLowerCase().includes(query)
      || (entry.subcategory ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">Advantages</h1>
        <span className="text-sm text-zinc-500">all tables</span>
      </div>

      <div className="flex items-center gap-3 mb-6 text-xs text-zinc-500">
        <span>
          {filtered.length} advantage{filtered.length !== 1 ? "s" : ""}
          {entries ? ` of ${entries.length}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter advantages..."
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-700/60"
          />
        </div>
        {search ? (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50"
          >
            Clear
          </button>
        ) : null}
      </div>

      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => {
            const isActive = category === cat;
            const config = TYPE_CONFIG[cat];
            const base = "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors";
            const classes = isActive
              ? config
                ? config.active
                : "bg-zinc-200/10 border-zinc-500/50 text-zinc-200"
              : "bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600/60";
            return (
              <button key={cat} type="button" onClick={() => setCategory(cat)} className={`${base} ${classes}`}>
                {cat}
              </button>
            );
          })}
        </div>
      ) : null}

      {entries === null ? (
        <div className="text-center py-16">
          <p className="text-zinc-600 text-sm">Loading advantages...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-zinc-500 text-sm">
            {search || category !== "All"
              ? "No advantages match your filter."
              : "No advantages recorded on any table yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const typeColor = entry.category ? TYPE_CONFIG[entry.category]?.color ?? "text-zinc-400" : "text-zinc-400";
            return (
              <Link
                key={entry.id}
                href={`/advantage/${entry.id}`}
                className="group block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] border-l-emerald-400/70 px-4 py-3 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-4 h-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate">
                      {entry.name || "Unnamed"}
                    </span>
                  </div>
                  {entry.cost_points != null ? (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded shrink-0">
                      {entry.cost_points >= 0 ? "+" : ""}
                      {entry.cost_points}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 mt-1.5 ml-7 text-[11px]">
                  {entry.category ? (
                    <span className={`shrink-0 ${typeColor}`}>
                      {entry.category}
                      {entry.subcategory ? ` / ${entry.subcategory}` : ""}
                    </span>
                  ) : entry.subcategory ? (
                    <span className="shrink-0 text-zinc-500">{entry.subcategory}</span>
                  ) : null}
                  {entry.description ? (
                    <span className="text-zinc-600 truncate">— {entry.description}</span>
                  ) : null}
                  {entry.tableTitle ? (
                    <span className="ml-auto shrink-0 max-w-[35%] truncate text-zinc-600 group-hover:text-zinc-500 pl-2">
                      {entry.tableTitle}
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
