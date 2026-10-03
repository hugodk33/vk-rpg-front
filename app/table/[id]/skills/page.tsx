"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { GameTableSkills, SkillItem } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import RowActions from "@/components/table/RowActions";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";

const TYPE_ICON: Record<string, { color: string; path: string }> = {
  Physical: { color: "text-amber-400", path: "M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11" },
  Mental: { color: "text-violet-400", path: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  Social: { color: "text-teal-400", path: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
};
const FALLBACK_ICON = { color: "text-zinc-400", path: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" };

const DIFF_DOTS: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3, "Very Hard": 4 };
const KNOWN_TYPES = new Set(["Physical", "Mental", "Social"]);

export default function TableSkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [data, setData] = useState<GameTableSkills | null>(null);
  const [search, setSearch] = useState("");

  const typeName = (raw?: string) =>
    raw && KNOWN_TYPES.has(raw) ? t(`sk.type.${raw}`) : raw ?? "";

  useEffect(() => {
    api<GameTableSkills>(`/game-table-skills/${id}`).then(setData).catch(() => setData({ table: null, skills: [] }));
  }, [id]);

  const skills = (data?.skills ?? []).filter((s: SkillItem) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name ?? "").toLowerCase().includes(q)
      || (s.effect ?? "").toLowerCase().includes(q)
      || (s.predefinition_type ?? "").toLowerCase().includes(q)
      || (s.category ?? "").toLowerCase().includes(q);
  });

  const typeCounts = (data?.skills ?? []).reduce<Record<string, number>>((acc, s) => {
    const t = s.predefinition_type ?? "Other";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  /* Pré-definição numa linha só, cobrindo as duas formas que o banco tem:
     fórmula de atributo ("iq - 6") e nível padrão em outra skill. */
  const predefParts = (s: SkillItem): string[] =>
    (s.predefinition ?? [])
      .map((pre) => {
        if (pre.depends_on_skill_for_others_attributes) {
          return pre.depends_on_skill_for_others_attributes;
        }
        if (pre.skill) {
          return pre.value ? `${pre.skill} ${pre.value}` : pre.skill;
        }
        return "";
      })
      .filter(Boolean);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">{t("nav.skills")}</h1>
        <span className="text-sm text-zinc-500">{data?.table?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{interpolate(t(skills.length !== 1 ? "tp.count.skillsMany" : "tp.count.skillsOne"), { n: skills.length })}</span>
          {Object.entries(typeCounts).map(([ty, c]) => (
            <span key={ty} className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${TYPE_ICON[ty]?.color?.replace("text-", "bg-") ?? "bg-zinc-500"}`} />
              {c} {typeName(ty)}
            </span>
          ))}
        </div>
        <Link
          href={`/skill/new?table_id=${id}`}
          className="bg-green-800/70 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + {t("tp.add.skill")}
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("tp.skills.searchPh")}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-green-900/60"
          />
        </div>
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50">
            {t("s2.clearAll")}
          </button>
        ) : null}
      </div>

      {skills.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-zinc-500 text-sm">{search ? t("tp.skills.emptySearch") : t("tp.skills.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((s: SkillItem) => {
            const icon = TYPE_ICON[s.predefinition_type ?? ""] ?? FALLBACK_ICON;
            const dots = DIFF_DOTS[s.predefinition_difficulty ?? ""] ?? 0;
            const parts = predefParts(s);
            return (
<div
                key={s.id}
                className="group relative block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] border-l-amber-400/70 px-4 py-3 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className={`w-4 h-4 shrink-0 ${icon.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon.path} />
                    </svg>
<Link
                      href={`/skill/${s.id}`}
                      className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate after:absolute after:inset-0 after:content-['']"
                    >
                      {s.name || t("it.unnamed")}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.predefinition_difficulty ? (
                      <span className="flex items-center gap-1">
                        {Array.from({ length: 4 }, (_, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i < dots ? "bg-amber-400" : "bg-zinc-700"}`} />
                        ))}
                        <span className="text-[10px] text-zinc-500 ml-1">{t(`sk.diff.${s.predefinition_difficulty}`)}</span>
                      </span>
                    ) : null}
                    {s.predefinition_type ? (
                      <span className="text-[10px] text-zinc-600 hidden sm:inline">{typeName(s.predefinition_type)}</span>
                    ) : null}
                    <RowActions
                      editHref={`/skill/${s.id}/edit?table_id=${id}`}
                      onDelete={() => submitJson(`/api/game-table-skill/${s.id}`, "DELETE")}
                      copyHref={`/api/game-table-skill/${s.id}/copy`}
                      tableId={id}
                    />
                  </div>
                </div>
<div className="flex items-center gap-2 mt-1.5 ml-7">
                  {s.category ? (
                    <span className="text-[11px] text-zinc-500">
                      {s.category}{s.subcategory ? ` / ${s.subcategory}` : ""}
                    </span>
                  ) : null}
                  {s.effect ? (
                    <span className="text-[11px] text-zinc-600 truncate">→ {s.effect}</span>
                  ) : null}
                </div>
                {/* Pré-definição: o nível padrão que a skill dá a outras. A
                    API já devolve `predefinition` com duas formas — fórmula
                    de atributo ("iq - 6") e nível em outra skill. Fica como
                    texto puro: a linha ja e um card, e caixa dentro de caixa
                    nao entra. */}
                {parts.length ? (
                  <div className="flex items-center gap-1.5 mt-1 ml-7 text-[11px] text-zinc-600 flex-wrap">
                    <span className="text-zinc-500">{t("fr.tip.predef")}</span>
                    {parts.slice(0, 3).map((part, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 ? <span className="text-zinc-700">·</span> : null}
                        <span>{part}</span>
                      </span>
                    ))}
                    {parts.length > 3 ? (
                      <span className="text-zinc-700">+{parts.length - 3}</span>
                    ) : null}
                  </div>
) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

