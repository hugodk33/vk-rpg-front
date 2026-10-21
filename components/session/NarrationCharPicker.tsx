"use client";

/* ============================================================
   NarrationCharPicker — escolhe quem está NA CENA de uma narração.

   Duas camadas:
     · a BUSCA filtra a lista de personagens por nome/usuário;
     · os MARCADOS viram TAGS (chips) acima da lista — e as tags
       sobrevivem ao filtro, porque a seleção é a verdade e a
       busca é só uma forma de achar quem falta marcar.

   Cada tag carrega o estado de consciência (o checkbox antigo
   ficava preso na linha e sumia com a busca).
   ============================================================ */

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export interface PickerChar {
  id: string;
  name?: string;
  username?: string;
}

export default function NarrationCharPicker({
  characters,
  npcIds,
  selected,
  conscious,
  onToggle,
  onToggleConscious,
}: {
  characters: PickerChar[];
  npcIds: string[];
  selected: string[];
  conscious: Record<string, boolean>;
  onToggle: (id: string) => void;
  onToggleConscious: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const byId = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);

  const label = (c: PickerChar) => c.name || c.username || t("ss.unknown");
  const isNpc = (id: string) => npcIds.includes(id);

  const selectedChars = selected
    .map((id) => byId.get(id))
    .filter((c): c is PickerChar => Boolean(c));

  const q = query.trim().toLowerCase();
  const matches = q
    ? characters.filter((c) => {
        const name = (c.name || c.username || "").toLowerCase();
        return name.includes(q);
      })
    : characters;

  return (
    <div className="space-y-2">
      {/* ---- busca ---- */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("ss.sceneSearch")}
          aria-label={t("ss.sceneSearch")}
          className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-lg pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-green-900/60 transition-colors"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            title={t("ss.sceneSearchClear")}
            aria-label={t("ss.sceneSearchClear")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* ---- tags dos marcados ---- */}
      {selectedChars.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedChars.map((c) => {
            const on = conscious[c.id] !== false;
            return (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-green-800/50 bg-green-900/20 pl-2 pr-1 py-0.5 text-xs text-zinc-100"
              >
                <span className="max-w-[10rem] truncate">{label(c)}</span>
                {isNpc(c.id) ? (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-sky-300/90">NPC</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onToggleConscious(c.id)}
                  title={t("ss.consciousTitle")}
                  aria-label={t("ss.consciousTitle")}
                  aria-pressed={on}
                  className={`font-mono text-[9px] uppercase tracking-widest px-1 rounded transition-colors ${
                    on ? "text-emerald-300/90 hover:text-emerald-200" : "text-red-300/90 hover:text-red-200"
                  }`}
                >
                  {on ? t("ss.conscious") : t("ss.unconscious")}
                </button>
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  title={t("ss.sceneRemove")}
                  aria-label={t("ss.sceneRemove")}
                  className="p-0.5 rounded text-zinc-500 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      {/* ---- lista ---- */}
      <div className="max-h-40 overflow-y-auto border border-zinc-700/50 rounded-lg p-2 space-y-1">
        {matches.map((c) => {
          const checked = selected.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onToggle(c.id)}
              className="w-full flex items-center gap-2 text-sm text-left cursor-pointer select-none hover:text-zinc-100 transition-colors"
            >
              <span
                className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border shrink-0 ${
                  checked ? "bg-green-700 border-green-600 text-white" : "border-zinc-600"
                }`}
              >
                {checked ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : null}
              </span>
              <span className={checked ? "text-zinc-100" : "text-zinc-400"}>{label(c)}</span>
              {isNpc(c.id) ? (
                <span className="font-mono text-[9px] uppercase tracking-widest text-sky-300/80">NPC</span>
              ) : null}
            </button>
          );
        })}
        {matches.length === 0 ? (
          <p className="text-zinc-600 text-sm font-mono italic">
            {characters.length === 0 ? t("ss.noCharsHere") : t("ss.sceneSearchEmpty")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
