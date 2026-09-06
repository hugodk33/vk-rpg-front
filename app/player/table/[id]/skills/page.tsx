"use client";

import { use, useEffect, useState } from "react";
import type { GameTableSkills, SkillItem } from "@/lib/types";
import { getPlayerCharacterUrl } from "@/lib/table";
import TableTabs from "@/components/TableTabs";
import { api } from "@/lib/api";

export default function PlayerTableSkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<GameTableSkills | null>(null);
  const [characterUrl, setCharacterUrl] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPlayerCharacterUrl(id).then((url) => {
      if (cancelled) return;
      setCharacterUrl(url);
      const viewerId = url?.split("/").pop() ?? "";
      const q = viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : "";
      api<GameTableSkills>(`/game-table-skills/${id}${q}`)
        .then((d) => { if (!cancelled) setData(d); })
        .catch(() => { if (!cancelled) setData({ table: null, skills: [] }); });
    }).catch(() => { if (!cancelled) setCharacterUrl(undefined); });
    return () => { cancelled = true; };
  }, [id]);

  const skills = (data?.skills ?? []).filter((s: SkillItem) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name ?? "").toLowerCase().includes(q)
      || (s.effect ?? "").toLowerCase().includes(q)
      || (s.predefinition_type ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="player" characterUrl={characterUrl} />
      <h1 className="text-2xl font-bold text-blue-100 mb-4">
        {data?.table?.title || "Table"} — Skills
      </h1>

      <div className="flex gap-2 mb-6">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search skills..." className="flex-1 bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-700/60" />
        <button type="button" onClick={() => setSearch("")} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors">Clear</button>
      </div>

      {skills.length === 0 ? (
        <p className="text-zinc-500 italic">No skills found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((s: SkillItem) => (
            <div key={s.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex justify-between items-start mb-1">
                <span className="text-zinc-200 font-medium">{s.name || "Unnamed"}</span>
                <span className="text-zinc-500 text-xs">{s.predefinition_type || ""}{s.predefinition_difficulty ? "/" + s.predefinition_difficulty : ""}</span>
              </div>
              {s.effect ? <p className="text-zinc-500 text-xs mt-1">{s.effect}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
