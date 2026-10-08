"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { SkillItem } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";

/* ============================================================
   1-hop skill network: the current skill sits in the middle,
   incoming relations (skills that require this one or offer it
   a default) on the left, outgoing ones on the right. Pure SVG,
   no graph library — a few dozen nodes at most.
   Incoming edges are aggregated client-side from the table's
   skill list, whose rows already carry their ledgers.
   ============================================================ */

const REQ = "#fb7185";
const NODE_W = 170;
const NODE_H = 32;
const ROW = 46;
const PAD = 28;
const W = 700;

type Edge = {
  id: string | null;
  name: string;
  kind: "req" | "def";
};

function short(s: string, n = 22): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export default function SkillNetwork({
  skill,
  tableId,
  accent,
}: {
  skill: SkillItem;
  tableId?: string;
  accent?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const def = accent ?? "#a1a1aa";
  const [incoming, setIncoming] = useState<Edge[]>([]);

  useEffect(() => {
    if (!tableId) return;
    let cancel = false;
    api<{ skills?: SkillItem[] }>(`/game-table-skills/${tableId}`)
      .then((res) => {
        if (cancel) return;
        const inc: Edge[] = [];
        for (const s of res.skills ?? []) {
          if (s.id === skill.id) continue;
          const from = { id: s.id, name: s.name || s.id };
          for (const d of s.dependencies ?? []) {
            if (d.skill_id === skill.id && (d.skill || d.value || d.type)) {
              inc.push({ ...from, kind: "req" });
            }
          }
          for (const d of s.predefinition ?? []) {
            if (
              d.skill_id === skill.id &&
              (d.skill || d.value || d.depends_on_skill_for_others_attributes)
            ) {
              inc.push({ ...from, kind: "def" });
            }
          }
        }
        setIncoming(inc);
      })
      .catch(() => {
        if (!cancel) setIncoming([]);
      });
    return () => {
      cancel = true;
    };
  }, [tableId, skill.id]);

  const outgoing: Edge[] = [
    ...(skill.dependencies ?? [])
      .filter((d) => d.skill || d.value || d.type)
      .map((d) => ({ id: d.skill_id ?? null, name: d.skill || d.value || t("skx.skill"), kind: "req" as const })),
    ...(skill.predefinition ?? [])
      .filter((d) => d.skill || d.value || d.depends_on_skill_for_others_attributes)
      .map((d) => ({
        id: d.skill_id ?? null,
        name: d.skill || d.value || d.depends_on_skill_for_others_attributes || t("skx.skill"),
        kind: "def" as const,
      })),
  ];

  if (incoming.length === 0 && outgoing.length === 0) {
    return <p className="font-mono text-xs text-zinc-600 italic">{t("skx.netEmpty")}</p>;
  }

  const rows = Math.max(incoming.length, outgoing.length, 1);
  const H = PAD * 2 + rows * ROW;
  const cy = H / 2;
  const colInX = 6;
  const colCenterX = Math.round((W - NODE_W) / 2);
  const colOutX = W - NODE_W - 6;
  const yAt = (i: number, count: number) => Math.round((H - count * ROW) / 2 + i * ROW + NODE_H / 2);

  const open = (id: string | null) => {
    if (id) router.push(`/skill/${id}`);
  };

  const node = (x: number, y: number, e: { id: string | null; name: string; hex: string; strong?: boolean }) => (
    <g
      key={`${e.hex}-${e.name}-${x}-${y}`}
      role={e.id ? "button" : undefined}
      tabIndex={e.id ? 0 : undefined}
      aria-label={e.id ? e.name : undefined}
      onClick={() => open(e.id)}
      onKeyDown={(ev) => {
        if (e.id && (ev.key === "Enter" || ev.key === " ")) {
          ev.preventDefault();
          open(e.id);
        }
      }}
      style={{ cursor: e.id ? "pointer" : "default" }}
    >
      <rect
        x={x}
        y={y - NODE_H / 2}
        width={NODE_W}
        height={NODE_H}
        rx={7}
        fill="#18181b"
        stroke={e.hex}
        strokeWidth={e.strong ? 2 : 1}
        strokeOpacity={e.strong ? 1 : 0.55}
      />
      <text
        x={x + NODE_W / 2}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        className="font-mono"
        fill={e.strong ? "#f4f4f5" : "#d4d4d4"}
      >
        {short(e.name)}
      </text>
    </g>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1 font-mono text-[9px] tracking-widest uppercase text-zinc-600">
        <span>{incoming.length ? t("skx.netIn") : ""}</span>
        <span>{outgoing.length ? t("skx.netOut") : ""}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t("skx.skillNet")}>
        <defs>
          <marker id="sknet-req" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={REQ} />
          </marker>
          <marker id="sknet-def" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={def} />
          </marker>
        </defs>

        {/* incoming: other skill → center */}
        {incoming.map((e, i) => {
          const y = yAt(i, incoming.length);
          const x1 = colInX + NODE_W;
          const x2 = colCenterX;
          const hex = e.kind === "req" ? REQ : def;
          return (
            <path
              key={`in-${e.id}-${e.kind}-${i}`}
              d={`M ${x1},${y} C ${x1 + 42},${y} ${x2 - 42},${cy} ${x2},${cy}`}
              fill="none"
              stroke={hex}
              strokeWidth={1.25}
              strokeOpacity={0.7}
              markerEnd={`url(#${e.kind === "req" ? "sknet-req" : "sknet-def"})`}
            />
          );
        })}

        {/* outgoing: center → other skill */}
        {outgoing.map((e, i) => {
          const y = yAt(i, outgoing.length);
          const x1 = colCenterX + NODE_W;
          const x2 = colOutX;
          const hex = e.kind === "req" ? REQ : def;
          return (
            <path
              key={`out-${e.id}-${e.kind}-${i}`}
              d={`M ${x1},${cy} C ${x1 + 42},${cy} ${x2 - 42},${y} ${x2},${y}`}
              fill="none"
              stroke={hex}
              strokeWidth={1.25}
              strokeOpacity={0.7}
              markerEnd={`url(#${e.kind === "req" ? "sknet-req" : "sknet-def"})`}
            />
          );
        })}

        {incoming.map((e, i) => node(colInX, yAt(i, incoming.length), { ...e, hex: e.kind === "req" ? `${REQ}88` : `${def}88` }))}
        {node(colCenterX, cy, { id: skill.id ?? null, name: skill.name, hex: def, strong: true })}
        {outgoing.map((e, i) => node(colOutX, yAt(i, outgoing.length), { ...e, hex: e.kind === "req" ? `${REQ}88` : `${def}88` }))}
      </svg>
      <div className="flex items-center gap-4 mt-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: REQ }} />
          {t("skx.requires")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: def }} />
          {t("skx.offersDefault")}
        </span>
      </div>
    </div>
  );
}
