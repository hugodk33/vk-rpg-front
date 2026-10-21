"use client";

/* ============================================================
   SeatCard — o cartão de assento (jogador ou NPC) do painel do
   narrador. É um Client Component porque usa useTranslation()
   (o painel é um Server Component e não pode passar a função `t`
   para cá).

   As três ações têm ícones PROPRIOS — antes eram dois "olhinhos"
   iguais flanqueando o lápis, o que tornava impossível saber
   qual botão fazia o quê:
     · FileText → abrir a ficha
     · Pencil   → editar a ficha
     · Eye      → visibilidade (o que o personagem enxerga)
   ============================================================ */

import Link from "next/link";
import { Eye, FileText, Pencil } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { hueFor, type Hue } from "@/lib/hue";
import type { Modifier } from "@/lib/types";

export interface SeatData {
  id: string;
  name: string;
  owner: string;
  points?: number;
  base?: number;
  current?: number;
  effects: Modifier[];
  hasSheet: boolean;
}

function hpPct(current: number, base: number): number {
  return base ? Math.max(0, Math.min(100, (current / base) * 100)) : 0;
}

export default function SeatCard({ s, hue }: { s: SeatData; hue?: Hue }) {
  const { t } = useTranslation();
  const linkable = s.id.length > 0;
  const maxN = Math.max(s.base ?? 0, s.current ?? 0);
  const dot = hue ?? hueFor(s.name);

  const actionCls =
    "inline-flex items-center justify-center w-6 h-6 rounded-md border border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600/60 transition-colors";

  return (
    <div className="group relative flex flex-col w-full rounded-lg border border-zinc-700/40 bg-zinc-900/60 px-3.5 py-2.5 min-w-[15rem] hover:border-green-800/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot.dot, boxShadow: `0 0 6px ${dot.ring}` }} />
            <span className="block text-sm font-medium text-zinc-200 leading-tight break-words">{s.name}</span>
          </span>
          <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5 ml-4 break-words">
            {s.owner}
          </span>
        </div>
        {linkable ? (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity relative z-10">
            <Link
              href={`/character/${s.id}`}
              title={t("tp.seat.openSheet")}
              aria-label={t("tp.seat.openSheet")}
              className={actionCls}
            >
              <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
            </Link>
            <Link
              href={`/character/${s.id}/edit`}
              title={t("tp.seat.editSheet")}
              aria-label={t("tp.seat.editSheet")}
              className={actionCls}
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
            </Link>
            <Link
              href={`/character/${s.id}?visibility=1`}
              title={t("tp.seat.visibility")}
              aria-label={t("tp.seat.visibility")}
              className={actionCls}
            >
              <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        ) : null}
      </div>

      {s.hasSheet ? (
        <span className="grid grid-cols-3 items-center gap-2 mt-2.5 pt-2.5 border-t border-zinc-700/40">
          <span className="font-mono text-[9px] uppercase tracking-widest text-green-500/80 whitespace-nowrap">
            Pts {s.points ?? "–"}
          </span>
          <span className="flex items-center gap-1.5 min-w-0" title={`${s.current ?? s.base}/${s.base} HP`}>
            <span className="flex-1 w-14 h-1.5 rounded-full bg-zinc-700/70 overflow-hidden">
              <span
                className="block h-full rounded-full bg-red-400/90"
                style={{ width: `${hpPct(s.current ?? s.base ?? 0, maxN)}%` }}
              />
            </span>
            <span className="font-mono text-[10px] text-zinc-400 tabular-nums whitespace-nowrap">
              {s.current ?? s.base}/{s.base}
            </span>
          </span>
          <span className="flex justify-end">
            {s.effects.length > 0 ? (
              <span
                title={s.effects.map((e) => e.name).filter(Boolean).join(", ") || t("tp.seat.effectsApplied")}
                className="font-mono text-[9px] uppercase tracking-widest text-rose-300/90 bg-rose-500/10 border border-rose-500/30 rounded px-1.5 py-0.5 whitespace-nowrap"
              >
                {s.effects.length === 1
                  ? t("tp.seat.effectsOne").replace("{n}", String(s.effects.length))
                  : t("tp.seat.effectsMany").replace("{n}", String(s.effects.length))}
              </span>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 whitespace-nowrap">{t("tp.seat.noEffects")}</span>
            )}
          </span>
        </span>
      ) : (
        <span className="block font-mono text-[9px] uppercase tracking-widest text-zinc-500 mt-2.5 pt-2.5 border-t border-zinc-700/40">
          {t("tp.seat.noSheetYet")}
        </span>
      )}
    </div>
  );
}
