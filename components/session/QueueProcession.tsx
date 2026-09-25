"use client";

import Link from "next/link";
import { interpolate, useTranslation } from "@/lib/i18n";
import type { QueueEntry, Sheet } from "@/lib/types";

/* ============================================================
   Queue Procession — the shared initiative queue interface.
   Both the player console and the narrator console render the
   SAME vertical procession (rail + dots, NOW/#n, sheet summary)
   so the table reads identically from either side. Only the
   controls differ:
     · player — a "you" tag and a "Roll now" beacon when up;
· narrator — a link to the character sheet and a remove
        button on each waiting seat (plus the add-to-queue bar,
        which lives with the caller). The narrator may also pass
        onEndTurn to resolve the NOW seat.
   Tone: blue for the player trail, green for the narrator trail.
   ============================================================ */

export interface QueueRosterEntry {
  id: string;
  name?: string | null;
  username?: string | null;
  st?: number | null;
  dx?: number | null;
  iq?: number | null;
  ht?: number | null;
  sheet?: Sheet | null;
}

interface QueueProcessionProps {
  entries: QueueEntry[];
  roster: QueueRosterEntry[];
  tone?: "blue" | "green";
  myId?: string;
  npcIds?: string[];
  emptyText?: string;
  linkHref?: (charId: string) => string;
  onRemove?: (entry: QueueEntry) => void;
  onEndTurn?: (entry: QueueEntry) => void;
}

const TONES = {
  blue: {
    rowUp: "border-blue-600/50 bg-blue-700/10",
    rowMine: "border-blue-700/50 bg-blue-900/10",
    rowIdle: "border-zinc-700/40 bg-zinc-900/50",
    dotUp: "border-blue-400 bg-blue-500 beacon",
    dotMine: "border-blue-500 bg-zinc-950",
    dotIdle: "border-zinc-600 bg-zinc-800",
    now: "text-blue-400",
    mineName: "text-blue-200",
    name: "text-zinc-200",
    you: "text-blue-400",
    rollNow: "text-blue-300",
    acting: "text-blue-400/70",
    endTurn: "border-blue-500/50 text-blue-300 hover:border-blue-400 hover:text-blue-100",
    shadow: "0 0 10px rgba(59,130,246,.6)",
  },
  green: {
    rowUp: "border-emerald-600/50 bg-emerald-700/10",
    rowMine: "border-emerald-700/50 bg-emerald-900/10",
    rowIdle: "border-zinc-700/40 bg-zinc-900/50",
    dotUp: "border-emerald-400 bg-emerald-500 beacon",
    dotMine: "border-emerald-500 bg-zinc-950",
    dotIdle: "border-zinc-600 bg-zinc-800",
    now: "text-emerald-400",
    mineName: "text-emerald-200",
    name: "text-zinc-200",
    you: "text-emerald-400",
    rollNow: "text-emerald-300",
    acting: "text-emerald-400/70",
    endTurn: "border-emerald-500/50 text-emerald-300 hover:border-emerald-400 hover:text-emerald-100",
    shadow: "0 0 10px rgba(16,185,129,.6)",
  },
} as const;

function queuePos(e: QueueEntry): number {
  const n = Number(e.queue);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

function AttrSummary({ c }: { c: QueueRosterEntry }) {
  const { t } = useTranslation();
  const s = c.sheet;
  if (!s && c.st == null && c.dx == null && c.iq == null && c.ht == null) {
    return <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{t("ss.queue.noSheet")}</span>;
  }
  const attrs = [
    { label: "ST", value: s?.st ?? s?.base_st ?? c.st ?? null, hex: "#f87171" },
    { label: "DX", value: s?.dx ?? s?.base_dx ?? c.dx ?? null, hex: "#34d399" },
    { label: "IQ", value: s?.iq ?? s?.base_iq ?? c.iq ?? null, hex: "#60a5fa" },
    { label: "HT", value: s?.ht ?? s?.base_ht ?? c.ht ?? null, hex: "#a78bfa" },
  ];
  const hpMax = s?.hp ?? s?.base_hp ?? null;
  const hpCur = s?.current_hp ?? hpMax;
  return (
    <span className="flex items-center gap-2.5">
      {attrs.map((a) => (
        <span key={a.label} className="inline-flex items-baseline gap-0.5">
          <span className="font-mono text-[9px] uppercase text-zinc-600">{a.label}</span>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: a.hex }}>{a.value ?? "–"}</span>
        </span>
      ))}
      {hpCur != null && hpMax ? (
        <span className="font-mono text-[10px] text-zinc-500 ml-1">HP {hpCur}/{hpMax}</span>
      ) : null}
    </span>
  );
}

export default function QueueProcession({
  entries,
  roster,
  tone = "blue",
  myId,
  npcIds = [],
  emptyText,
  linkHref,
  onRemove,
  onEndTurn,
}: QueueProcessionProps) {
  const { t } = useTranslation();
  const pending = [...entries]
    .filter((e) => (e.status ?? "pending") !== "done")
    .sort((a, b) => queuePos(a) - queuePos(b));
  const T = TONES[tone];
  const empty = emptyText ?? t("ss.queue.emptyScene");

  return (
    <section aria-label={t("ss.aria.initiativeQueue")}>
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[11px] tracking-widest uppercase text-zinc-400">{t("ss.queue.order")}</span>
        <span className="flex-1 h-px bg-zinc-700/40" />
        <span className="font-mono text-[10px] text-zinc-600">{interpolate(t("ss.queue.count"), { n: pending.length })}</span>
      </div>

      {pending.length === 0 ? (
        <div className="border border-dashed border-zinc-700/60 rounded-xl px-5 py-10 text-center">
          <p className="text-sm text-zinc-500">{empty}</p>
        </div>
      ) : (
        <div className="relative space-y-2.5 pl-5">
          <span aria-hidden className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800" />
          {pending.map((entry, i) => {
            const cid = entry.character_id || "";
            const c = roster.find((r) => r.id === cid);
            const mine = myId ? cid === myId : false;
            const up = i === 0;
            const name = c?.sheet?.name || c?.name || c?.username || t("ss.someone");
            const isNpc = npcIds.includes(cid);
            return (
              <div
                key={entry.id}
                className={`relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                  up ? T.rowUp : mine ? T.rowMine : T.rowIdle
                }`}
              >
                <span
                  className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 ${
                    up ? T.dotUp : mine ? T.dotMine : T.dotIdle
                  }`}
                  style={up ? { boxShadow: T.shadow } : undefined}
                />
                <span className="font-mono text-[11px] text-zinc-500 w-6 text-right shrink-0">
                  {up ? <span className={`font-bold ${T.now}`}>{t("ss.queue.now")}</span> : `#${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold truncate ${mine ? T.mineName : T.name}`}>
                    {linkHref && cid ? (
                      <Link href={linkHref(cid)} className={mine ? T.mineName : T.name}>{name}</Link>
                    ) : (
                      name
                    )}
                    {mine ? (
                      <span className={`ml-2 font-mono text-[9px] uppercase tracking-widest ${T.you}`}>{t("ss.you")}</span>
                    ) : null}
                    {isNpc ? (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-amber-300">NPC</span>
                    ) : null}
                  </div>
                  <div className="mt-0.5">
                    {c ? <AttrSummary c={c} /> : null}
                  </div>
                </div>
                {up && onEndTurn ? (
                  <button
                    onClick={() => onEndTurn(entry)}
                    aria-label={interpolate(t("ss.queue.ariaEndTurn"), { name })}
                    className={`shrink-0 font-mono text-[10px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-colors ${T.endTurn}`}
                  >
                    {t("ss.queue.endTurn")}
                  </button>
                ) : up && mine ? (
                  <span className={`shrink-0 font-mono text-[10px] uppercase tracking-widest ${T.rollNow}`}>{t("ss.queue.rollNow")}</span>
                ) : up ? (
                  <span className={`shrink-0 font-mono text-[10px] uppercase tracking-widest ${T.acting}`}>{t("ss.queue.acting")}</span>
                ) : onRemove ? (
                  <button
                    onClick={() => onRemove(entry)}
                    aria-label={interpolate(t("ss.queue.ariaRemove"), { name })}
                    className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors p-1 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}