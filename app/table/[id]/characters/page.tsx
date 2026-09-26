"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { GameTableCharacters, GameTableNpcs, TableCharacter } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import RadarChart from "@/components/RadarChart";
import RowActions from "@/components/table/RowActions";
import { api } from "@/lib/api";
import { submitJson } from "@/components/forms/submit";
import { interpolate, useTranslation } from "@/lib/i18n";

export default function TableCharactersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useTranslation();
  const [data, setData] = useState<GameTableCharacters | null>(null);
  const [npcs, setNpcs] = useState<GameTableNpcs | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<GameTableCharacters>(`/game-table-characters/${id}`).then(setData).catch(() => setData({ table: null, characters: [] }));
    api<GameTableNpcs>(`/game-table-npcs/${id}`).then(setNpcs).catch(() => setNpcs({ table: null, npcs: [] }));
  }, [id]);

  const characters = (data?.characters ?? []).filter((ch: TableCharacter) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const s = ch.sheet;
    return (s?.name ?? ch.name ?? "").toLowerCase().includes(q)
      || (ch.user?.username ?? "").toLowerCase().includes(q);
  });

  const npcStatusById = new Map((npcs?.npcs ?? []).map((n) => [n.character_id, n.status]));
  const npcIdByCharacter = new Map((npcs?.npcs ?? []).map((n) => [n.character_id, n.id]));

  const isNpc = (ch: TableCharacter): boolean => ch.user?.type === 0;
  const isAlly = (ch: TableCharacter): boolean => {
    if (!isNpc(ch)) return false;
    const st = npcStatusById.get(ch.id);
    return st ? st.toLowerCase() !== "enemy" : true;
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} />

      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-2xl font-bold text-zinc-100">{t("nav.characters")}</h1>
        <span className="text-sm text-zinc-500">{data?.table?.title}</span>
      </div>

      <div className="flex items-center justify-between gap-6 mb-6">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span>{interpolate(t(characters.length !== 1 ? "tp.count.charactersMany" : "tp.count.charactersOne"), { n: characters.length })}</span>
        </div>
        <Link
          href={`/character/new?table_id=${id}`}
          className="bg-green-800/70 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + {t("tp.add.character")}
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
            placeholder={t("tp.characters.searchPh")}
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-700/60"
          />
        </div>
        {search ? (
          <button type="button" onClick={() => setSearch("")} className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 text-sm px-3 py-2 rounded-lg transition-colors border border-zinc-700/50">
            {t("s2.clearAll")}
          </button>
        ) : null}
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <p className="text-zinc-500 text-sm">{search ? t("tp.characters.emptySearch") : t("tp.characters.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {characters.map((ch) => {
            const s = ch.sheet;
            if (isNpc(ch)) {
              const ally = isAlly(ch);
              return (
                <Link
                  key={ch.id}
                  href={`/character/${ch.id}`}
                  className="group block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] px-4 py-3 transition-all"
                  style={{ borderLeftColor: ally ? "#34d399" : "#f87171" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <svg className="w-4 h-4 shrink-0 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate block">
                          {s?.name || ch.name || t("it.unnamed")}
                        </span>
                        <span className="text-[11px] text-zinc-500">NPC</span>
                      </div>
                      {ch.is_active === false ? (
                        <span className="shrink-0 inline-block font-mono text-[9px] uppercase tracking-widest text-red-300/90 border border-red-500/40 rounded px-1.5 py-0.5">
                          {t("tp.characters.inactive")}
                        </span>
                      ) : null}
                      <span
                        className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-zinc-900 bg-zinc-200 rounded px-1.5 py-0.5"
                        style={{ background: ally ? "#34d399" : "#f87171", color: "#18181b" }}
                      >
                        {ally ? t("tp.characters.ally") : t("tp.characters.enemy")}
                      </span>
                    </div>
                    {s ? (
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-red-400">ST {s.st ?? "-"}</span>
                          <span className="text-emerald-400">DX {s.dx ?? "-"}</span>
                          <span className="text-blue-400">IQ {s.iq ?? "-"}</span>
                          <span className="text-purple-400">HT {s.ht ?? "-"}</span>
                        </div>
                        <RadarChart st={s.st} dx={s.dx} iq={s.iq} ht={s.ht} size={48} />
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-600 italic shrink-0">{t("tp.characters.noSheet")}</span>
                    )}
                    <RowActions
                      editHref={`/npc/${npcIdByCharacter.get(ch.id) ?? ""}/edit`}
                      onDelete={() => submitJson(`/api/game-table-npc/${npcIdByCharacter.get(ch.id) ?? ""}`, "DELETE")}
                      copyHref={`/api/game-table-npc/${npcIdByCharacter.get(ch.id) ?? ""}/copy`}
                      tableId={id}
                    />
                  </div>
                </Link>
              );
            }
            return (
              <Link
                key={ch.id}
                href={`/character/${ch.id}`}
                className="group block bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/40 hover:border-zinc-600/60 rounded-lg border-l-[3px] border-l-violet-400/70 px-4 py-3 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg className="w-4 h-4 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100 truncate block">
                        {s?.name || ch.name || t("it.unnamed")}
                      </span>
                      {ch.user?.username ? (
                        <span className="text-[11px] text-zinc-500">{ch.user.username}</span>
                      ) : null}
                      {ch.is_active === false ? (
                        <span className="inline-block font-mono text-[9px] uppercase tracking-widest text-red-300/90 border border-red-500/40 rounded px-1.5 py-0.5 mt-0.5">
                          {t("tp.characters.inactive")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {s ? (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-red-400">ST {s.st ?? "-"}</span>
                        <span className="text-emerald-400">DX {s.dx ?? "-"}</span>
                        <span className="text-blue-400">IQ {s.iq ?? "-"}</span>
                        <span className="text-purple-400">HT {s.ht ?? "-"}</span>
                      </div>
                      <RadarChart st={s.st} dx={s.dx} iq={s.iq} ht={s.ht} size={48} />
                    </div>
                  ) : (
                    <span className="text-[11px] text-zinc-600 italic shrink-0">{t("tp.characters.noSheet")}</span>
                  )}
                  <RowActions
                    editHref={`/character/${ch.id}/edit?table_id=${id}`}
                    onDelete={() => submitJson(`/api/game-table-character/${ch.id}`, "DELETE")}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
