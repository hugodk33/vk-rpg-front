"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  Advantage,
  Disadvantage,
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableSkills,
  Item,
  SkillItem,
  TableCharacter,
} from "@/lib/types";
import { api } from "@/lib/api";
import RadarChart from "@/components/RadarChart";

/* ============================================================
   Player Table Panel — the table's shared sandbox.
   A sub-tabbed view inside the Player Console showing what the
   table owns: items, npcs/characters, skills, advantages and
   disadvantages. Read-only for the player; the narrator manages
   these from the desk.
   ============================================================ */

type TableSection = "items" | "npcs" | "skills" | "advantages" | "disadvantages";

const SECTIONS: Array<{ key: TableSection; label: string }> = [
  { key: "items", label: "Items" },
  { key: "npcs", label: "NPCs" },
  { key: "skills", label: "Skills" },
  { key: "advantages", label: "Advantages" },
  { key: "disadvantages", label: "Disadvantages" },
];

const DISADV_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  Mental: { bg: "#1e1b4b", border: "#4338ca", badge: "bg-purple-600/80 text-purple-200" },
  Physical: { bg: "#450a0a", border: "#dc2626", badge: "bg-red-600/80 text-red-200" },
  Social: { bg: "#172554", border: "#2563eb", badge: "bg-blue-600/80 text-blue-200" },
  Exotic: { bg: "#083344", border: "#0891b2", badge: "bg-cyan-600/80 text-cyan-200" },
  "Self-Control": { bg: "#2e1065", border: "#7c3aed", badge: "bg-indigo-600/80 text-indigo-200" },
};
const DISADV_FALLBACK = { bg: "#27272a", border: "#52525b", badge: "bg-zinc-600/80 text-zinc-200" };
const ADV_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  Mental: { bg: "#052e16", border: "#16a34a", badge: "bg-emerald-700/80 text-emerald-200" },
  Physical: { bg: "#1c1917", border: "#d97706", badge: "bg-amber-700/80 text-amber-200" },
  Social: { bg: "#0f2b1d", border: "#059669", badge: "bg-teal-700/80 text-teal-200" },
  Exotic: { bg: "#3b0a2e", border: "#db2777", badge: "bg-pink-700/80 text-pink-200" },
  Supernatural: { bg: "#1e1b4b", border: "#7c3aed", badge: "bg-violet-700/80 text-violet-200" },
};
const ADV_FALLBACK = { bg: "#14532d", border: "#16a34a", badge: "bg-emerald-700/80 text-emerald-200" };

interface PlayerTablePanelProps {
  tableId: string;
}

export default function PlayerTablePanel({ tableId }: PlayerTablePanelProps) {
  const [section, setSection] = useState<TableSection>("items");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [npcs, setNpcs] = useState<TableCharacter[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [advantages, setAdvantages] = useState<Advantage[]>([]);
  const [disadvantages, setDisadvantages] = useState<Disadvantage[]>([]);

  useEffect(() => {
    if (!tableId) return;
    api<GameTableItems>(`/game-table-items/${tableId}`)
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
    api<GameTableCharacters>(`/game-table-characters/${tableId}`)
      .then((d) => setNpcs((d.characters ?? []).filter((c) => c.isNpc)))
      .catch(() => setNpcs([]));
    api<GameTableSkills>(`/game-table-skills/${tableId}`)
      .then((d) => setSkills(d.skills ?? []))
      .catch(() => setSkills([]));
    api<GameTableAdvantages>(`/game-table-advantages/${tableId}`)
      .then((d) => setAdvantages(d.advantages ?? []))
      .catch(() => setAdvantages([]));
    api<GameTableDisadvantages>(`/game-table-disadvantages/${tableId}`)
      .then((d) => setDisadvantages(d.disadvantages ?? []))
      .catch(() => setDisadvantages([]));
  }, [tableId]);

  const q = search.toLowerCase();

  const filteredItems = items.filter((i) => !q || (i.name ?? "").toLowerCase().includes(q));
  const filteredNpcs = npcs.filter((c) => {
    if (!q) return true;
    const s = c.sheet;
    return (s?.name ?? c.name ?? "").toLowerCase().includes(q);
  });
  const filteredSkills = skills.filter((s) => !q || (s.name ?? "").toLowerCase().includes(q));
  const filteredAdvantages = advantages.filter((a) => !q || (a.name ?? "").toLowerCase().includes(q));
  const filteredDisadvantages = disadvantages.filter((d) => !q || (d.name ?? "").toLowerCase().includes(q));

  return (
    <div>
      {/* section switcher */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setSection(s.key); setSearch(""); }}
            className={`px-3 py-1.5 rounded-md font-mono text-[11px] uppercase tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 ${
              section === s.key ? "bg-amber-700/60 text-amber-100" : "bg-zinc-800/50 border border-zinc-700/40 text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${section}...`}
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

      {section === "items" ? renderItems(filteredItems) : null}
      {section === "npcs" ? renderNpcs(filteredNpcs) : null}
      {section === "skills" ? renderSkills(filteredSkills) : null}
      {section === "advantages" ? renderAdvantages(filteredAdvantages) : null}
      {section === "disadvantages" ? renderDisadvantages(filteredDisadvantages) : null}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-zinc-500 italic">{msg}</p>;
}

function renderItems(items: Item[]) {
  if (items.length === 0) return <Empty msg="No items in this table." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((i) => (
        <div key={i.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
          <div className="flex justify-between items-start mb-1">
            <span className="text-zinc-200 font-medium">{i.name || "Unnamed"}</span>
            {i.weight_lb != null ? <span className="text-zinc-500 text-xs">{i.weight_lb} lb</span> : null}
          </div>
          {i.category || i.quality || i.condition ? (
            <div className="flex flex-wrap gap-x-3 text-xs text-zinc-500 mb-1">
              {i.category ? <span>{i.category}</span> : null}
              {i.quality ? <span>{i.quality}</span> : null}
              {i.condition ? <span>{i.condition}</span> : null}
            </div>
          ) : null}
          {i.description ? <p className="text-zinc-500 text-xs">{i.description}</p> : null}
          {i.weapon?.attacks?.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 bg-red-900/40 border border-red-700/50 text-red-300 px-2 py-0.5 rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243-4.243z" />
                </svg>
                {i.weapon.attacks.length} ataque{i.weapon.attacks.length !== 1 ? "s" : ""}
              </span>
              {i.weapon.reach ? <span className="text-zinc-500">Reach {i.weapon.reach}</span> : null}
            </div>
          ) : null}
          {i.armor ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 bg-cyan-900/40 border border-cyan-700/50 text-cyan-300 px-2 py-0.5 rounded">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                DR {i.armor.dr ?? "—"}
              </span>
              {i.armor.locations ? <span className="text-zinc-500">{i.armor.locations}</span> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function renderNpcs(npcs: TableCharacter[]) {
  if (npcs.length === 0) return <Empty msg="No NPCs registered in this table yet." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {npcs.map((ch) => {
        const s = ch.sheet;
        return (
          <div key={ch.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3 flex flex-col items-center">
            <div className="w-full flex justify-between items-start mb-1">
              <span className="text-zinc-200 font-medium">{s?.name || ch.name || "Unnamed"}</span>
              <span className="text-zinc-500 text-xs">NPC</span>
            </div>
            {s ? <RadarChart st={s.st} dx={s.dx} iq={s.iq} ht={s.ht} /> : null}
            {s ? (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-xs mt-2">
                <span className="text-red-400">ST {s.st ?? "-"}</span>
                <span className="text-emerald-400">DX {s.dx ?? "-"}</span>
                <span className="text-blue-400">IQ {s.iq ?? "-"}</span>
                <span className="text-purple-400">HT {s.ht ?? "-"}</span>
              </div>
            ) : (
              <p className="text-zinc-600 text-xs italic mt-1">No sheet</p>
            )}
            {ch.id ? (
              <Link
                href={`/character/${ch.id}`}
                className="w-full text-center bg-amber-700/60 hover:bg-amber-600 text-amber-100 text-xs font-medium px-3 py-2 rounded-lg transition-colors mt-3"
              >
                Sheet
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function renderSkills(skills: SkillItem[]) {
  if (skills.length === 0) return <Empty msg="No skills registered in this table." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {skills.map((s) => (
        <div key={s.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
          <div className="flex justify-between items-start mb-1">
            <span className="text-zinc-200 font-medium">{s.name || "Unnamed"}</span>
            <span className="text-zinc-500 text-xs">{s.predefinition_type || ""}{s.predefinition_difficulty ? "/" + s.predefinition_difficulty : ""}</span>
          </div>
          {s.effect ? <p className="text-zinc-500 text-xs mt-1">{s.effect}</p> : null}
        </div>
      ))}
    </div>
  );
}

function renderAdvantages(advantages: Advantage[]) {
  if (advantages.length === 0) return <Empty msg="No advantages registered in this table." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {advantages.map((a) => {
        const colors = ADV_COLORS[a.category ?? ""] ?? ADV_FALLBACK;
        return (
          <div key={a.id} className="rounded-lg px-4 py-3" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-zinc-100 font-medium">{a.name || "Unnamed"}</span>
              <span className="text-emerald-400 text-xs font-semibold">{a.cost_points ?? ""}</span>
            </div>
            {a.category ? <span className={`inline-block ${colors.badge} text-xs px-2 py-0.5 rounded-full mt-1`}>{a.category}{a.subcategory ? ` / ${a.subcategory}` : ""}</span> : null}
            {a.description ? <p className="text-zinc-400 text-xs mt-2">{a.description}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function renderDisadvantages(disadvantages: Disadvantage[]) {
  if (disadvantages.length === 0) return <Empty msg="No disadvantages registered in this table." />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {disadvantages.map((d) => {
        const colors = DISADV_COLORS[d.category ?? ""] ?? DISADV_FALLBACK;
        return (
          <div key={d.id} className="rounded-lg px-4 py-3" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-zinc-100 font-medium">{d.name || "Unnamed"}</span>
              <span className="text-red-400 text-xs font-semibold">{d.cost_points ?? ""}</span>
            </div>
            {d.category ? <span className={`inline-block ${colors.badge} text-xs px-2 py-0.5 rounded-full mt-1`}>{d.category}{d.subcategory ? ` / ${d.subcategory}` : ""}</span> : null}
            {d.effect ? <p className="text-zinc-400 text-xs mt-2">{d.effect}</p> : null}
            {d.description ? <p className="text-zinc-500 text-xs mt-1">{d.description}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
