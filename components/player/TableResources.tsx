"use client";

import { useState } from "react";
import type {
  Advantage,
  Disadvantage,
  Item,
  Location,
  SkillItem,
  TableCharacter,
  TableNpc,
} from "@/lib/types";
import ItemIcon from "@/components/items/ItemIcon";

/* ============================================================
   Table Resources — the table's shared encyclopedia, inline in
   the player console. Read-only. Mirrors the old separate
   /player/table/<id>/* pages without the navigation trail:
   the table reference already lives in every console response,
   so the player browses everything from a single seat.
   ============================================================ */

export type ResourceTab = "characters" | "items" | "skills" | "advantages" | "disadvantages" | "locations";

interface TableResourcesProps {
  roster: TableCharacter[];
  myId?: string;
  npcs?: TableNpc[];
  items?: Item[];
  skills?: SkillItem[];
  advantages?: Advantage[];
  disadvantages?: Disadvantage[];
  locations?: Location[];
  /** Controlled mode — the parent owns the selection and hides the strip. */
  tab?: ResourceTab;
  onTabChange?: (tab: ResourceTab) => void;
}

export const RESOURCE_TABS: Array<{ key: ResourceTab; label: string }> = [
  { key: "characters", label: "Personagens" },
  { key: "items", label: "Itens" },
  { key: "skills", label: "Perícias" },
  { key: "advantages", label: "Vantagens" },
  { key: "disadvantages", label: "Desvantagens" },
  { key: "locations", label: "Locais" },
];

export default function TableResources({
  roster,
  myId,
  npcs = [],
  items = [],
  skills = [],
  advantages = [],
  disadvantages = [],
  locations = [],
  tab: controlledTab,
  onTabChange,
}: TableResourcesProps) {
  const [internalTab, setInternalTab] = useState<ResourceTab>("characters");
  const tab = controlledTab ?? internalTab;
  const setTab = (next: ResourceTab) => {
    onTabChange?.(next);
    setInternalTab(next);
  };
  const npcIds = new Set(npcs.map((n) => n.character_id));

  return (
    <div className="space-y-5">
      {controlledTab == null ? (
      <div role="tablist" aria-label="Recursos da mesa" className="flex items-center gap-1 border-b border-zinc-700/40 flex-wrap">
        {RESOURCE_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-md ${
              tab === t.key ? "text-blue-300" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
            {tab === t.key ? (
              <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600" />
            ) : null}
          </button>
        ))}
      </div>
      ) : null}

      {/* ---- characters ---- */}
      {tab === "characters" ? (
        roster.length === 0 ? (
          <Empty label="Nenhum personagem visto nesta mesa ainda." />
        ) : (
          <div className="space-y-2">
            {roster.map((c) => {
              const s = c.sheet;
              const name = s?.name || c.name || c.user?.username || "Sem nome";
              const attrs = [
                { label: "ST", value: s?.st ?? s?.base_st, hex: "#f87171" },
                { label: "DX", value: s?.dx ?? s?.base_dx, hex: "#34d399" },
                { label: "IQ", value: s?.iq ?? s?.base_iq, hex: "#60a5fa" },
                { label: "HT", value: s?.ht ?? s?.base_ht, hex: "#a78bfa" },
              ];
              const hpMax = s?.hp ?? s?.base_hp;
              const hpCur = s?.current_hp ?? hpMax;
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-zinc-700/40 bg-zinc-900/50 px-4 py-3">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      npcIds.has(c.id) ? "bg-amber-400" : "bg-blue-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-100 truncate">
                      {name}
                      {c.id === myId ? (
                        <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-blue-400">você</span>
                      ) : null}
                      {npcIds.has(c.id) ? (
                        <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-amber-300">NPC</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2.5 flex-wrap">
                      {attrs.map((a) => (
                        <span key={a.label} className="inline-flex items-baseline gap-0.5">
                          <span className="font-mono text-[9px] uppercase text-zinc-600">{a.label}</span>
                          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: a.hex }}>{a.value ?? "–"}</span>
                        </span>
                      ))}
                      {hpCur != null && hpMax ? (
                        <span className="font-mono text-[10px] text-zinc-500">HP {hpCur}/{hpMax}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}

      {/* ---- items ---- */}
      {tab === "items" ? (
        items.length === 0 ? (
          <Empty label="Nenhum item registrado para esta mesa." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((i) => (
              <div key={i.id} className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="flex items-center gap-2 text-zinc-200 font-medium min-w-0">
                    <ItemIcon item={i} className="w-4 h-4 shrink-0" imgClassName="w-4 h-4 object-cover rounded" />
                    <span className="truncate">{i.name || "Sem nome"}</span>
                  </span>
                  {i.weight_lb != null ? <span className="text-zinc-500 text-xs shrink-0">{i.weight_lb} lb</span> : null}
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
                      {i.weapon.attacks.length} ataque{i.weapon.attacks.length !== 1 ? "s" : ""}
                    </span>
                    {i.weapon.reach ? <span className="text-zinc-500">Alcance {i.weapon.reach}</span> : null}
                  </div>
                ) : null}
                {i.armor ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 bg-cyan-900/40 border border-cyan-700/50 text-cyan-300 px-2 py-0.5 rounded">
                      DR {i.armor.dr ?? "—"}
                    </span>
                    {i.armor.locations ? <span className="text-zinc-500">{i.armor.locations}</span> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )
      ) : null}

      {/* ---- skills ---- */}
      {tab === "skills" ? (
        skills.length === 0 ? (
          <Empty label="Nenhuma perícia registrada para esta mesa." />
        ) : (
          <div className="space-y-2">
            {skills.map((sk) => (
              <div key={sk.id} className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 px-4 py-3">
                <div className="text-sm font-semibold text-zinc-100">{sk.name}</div>
                {sk.category || sk.type ? (
                  <div className="flex flex-wrap gap-x-3 text-xs text-zinc-500 mt-0.5">
                    {sk.category ? <span>{sk.category}</span> : null}
                    {sk.type ? <span>{sk.type}</span> : null}
                  </div>
                ) : null}
                {sk.effect ? <p className="text-zinc-400 text-xs mt-1">{sk.effect}</p> : null}
                {sk.description ? <p className="text-zinc-500 text-xs mt-0.5">{sk.description}</p> : null}
              </div>
            ))}
          </div>
        )
      ) : null}

      {/* ---- advantages ---- */}
      {tab === "advantages" ? (
        advantages.length === 0 ? (
          <Empty label="Nenhuma vantagem registrada para esta mesa." />
        ) : (
          <div className="space-y-2">
            {advantages.map((a) => (
              <div key={a.id} className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-emerald-200">{a.name}</span>
                  {a.cost_points != null ? (
                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{a.cost_points} pts</span>
                  ) : null}
                </div>
                {a.category ? <p className="text-xs text-zinc-500 mt-0.5">{a.category}</p> : null}
                {a.description ? <p className="text-zinc-400 text-xs mt-1">{a.description}</p> : null}
              </div>
            ))}
          </div>
        )
      ) : null}

      {/* ---- disadvantages ---- */}
      {tab === "disadvantages" ? (
        disadvantages.length === 0 ? (
          <Empty label="Nenhuma desvantagem registrada para esta mesa." />
        ) : (
          <div className="space-y-2">
            {disadvantages.map((d) => (
              <div key={d.id} className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-red-200">{d.name}</span>
                  {d.cost_points != null ? (
                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">{d.cost_points} pts</span>
                  ) : null}
                </div>
                {d.category ? <p className="text-xs text-zinc-500 mt-0.5">{d.category}</p> : null}
                {d.effect ? <p className="text-zinc-400 text-xs mt-1">{d.effect}</p> : null}
                {d.description ? <p className="text-zinc-500 text-xs mt-0.5">{d.description}</p> : null}
              </div>
            ))}
          </div>
        )
      ) : null}

      {/* ---- locations ---- */}
      {tab === "locations" ? (
        locations.length === 0 ? (
          <Empty label="Nenhum local visto neste mapa ainda." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-xl border border-zinc-700/40 bg-zinc-900/50 px-4 py-3">
                <div className="text-sm font-semibold text-zinc-100">{loc.name || "Sem nome"}</div>
                {loc.kind || loc.path ? (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {[loc.kind, loc.path].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {loc.description ? <p className="text-zinc-500 text-xs mt-1">{loc.description}</p> : null}
              </div>
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-zinc-500 italic">{label}</p>;
}