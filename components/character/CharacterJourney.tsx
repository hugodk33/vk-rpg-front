"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { skillLevel } from "@/lib/skill";
import type {
  CharacterHistory,
  CharacterHistoryBaseline,
  CharacterHistoryEvent,
  CharacterStatsSnapshot,
  CharacterSkill,
  CharacterViewer,
  Sheet,
} from "@/lib/types";
import ItemIcon from "@/components/items/ItemIcon";

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

function eventChips(e: CharacterHistoryEvent): Array<{ key: string; label: string; value: string; cls: string }> {
  const chips: Array<{ key: string; label: string; value: string; cls: string }> = [];
  if (e.mod_hp != null) chips.push({ key: "hp", label: "HP", value: signed(e.mod_hp), cls: "text-red-400" });
  if (e.mod_st != null) chips.push({ key: "st", label: "ST", value: signed(e.mod_st), cls: "text-red-400" });
  if (e.mod_dx != null) chips.push({ key: "dx", label: "DX", value: signed(e.mod_dx), cls: "text-emerald-400" });
  if (e.mod_iq != null) chips.push({ key: "iq", label: "IQ", value: signed(e.mod_iq), cls: "text-blue-400" });
  if (e.mod_ht != null) chips.push({ key: "ht", label: "HT", value: signed(e.mod_ht), cls: "text-purple-400" });
  if (e.mod_fatigue != null) chips.push({ key: "fp", label: "FP", value: signed(e.mod_fatigue), cls: "text-blue-400" });
  if (e.encumbrance != null) chips.push({ key: "enc", label: "CAR", value: e.encumbrance, cls: "text-zinc-400" });
  if (e.damage_value != null) chips.push({ key: "dmg", label: "DANO", value: e.damage_value, cls: "text-amber-400/80" });
  if (e.item_quantity != null) chips.push({ key: "qty", label: "QTD", value: String(e.item_quantity), cls: "text-zinc-400" });
  return chips;
}

/* ============================================================
   StateStrip — a compact "before → after" readout of the
   character's live stats at the moment this event happened.
   ============================================================ */

function StateBar({
  label,
  before,
  after,
  max,
  tone,
  big,
}: {
  label: string;
  before: number;
  after: number;
  max: number;
  tone: "amber" | "sky";
  big?: boolean;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  const b = clamp(before);
  const a = clamp(after);
  const pct = (v: number) => `${(v / Math.max(1, max)) * 100}%`;
  const solid = tone === "amber" ? "bg-amber-500/80" : "bg-sky-500/80";
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] tracking-widest uppercase text-zinc-500 w-5 shrink-0">{label}</span>
      <div className={`relative ${big ? "h-2.5" : "h-1.5"} flex-1 rounded-full bg-zinc-950/80`}>
        <div className={`absolute inset-y-0 left-0 rounded-full ${solid} opacity-35`} style={{ width: pct(b) }} />
        <div className={`absolute inset-y-0 left-0 rounded-full ${solid}`} style={{ width: pct(a) }} />
      </div>
      <span className={`font-mono ${big ? "text-xs" : "text-[10px]"} text-zinc-400 shrink-0 whitespace-nowrap`}>
        {before} → {after}
      </span>
    </div>
  );
}

const ATTRS: Array<{ key: "st" | "dx" | "iq" | "ht"; label: string }> = [
  { key: "st", label: "ST" },
  { key: "dx", label: "DX" },
  { key: "iq", label: "IQ" },
  { key: "ht", label: "HT" },
];

function StateStrip({ before, after, baseline }: { before?: CharacterStatsSnapshot | null; after?: CharacterStatsSnapshot | null; baseline?: CharacterHistoryBaseline | null }) {
  if (!before || !after) return null;
  const b = before;
  const a = after;
  const changed = ATTRS.some(({ key }) => b[key] != null && a[key] != null && b[key] !== a[key]);
  const hpChanged = (b.hp ?? 0) !== (a.hp ?? 0);
  const fpChanged = (b.fatigue ?? 0) !== (a.fatigue ?? 0);
  if (!changed && !hpChanged && !fpChanged) return null;

  const maxHp = Math.max(1, baseline?.hp ?? 10);
  const fpMax = Math.max(1, (baseline?.fatigue ?? 0) > 0 ? baseline!.fatigue! : (baseline?.ht ?? 10));
  const hpB = b.hp ?? 0;
  const hpA = a.hp ?? 0;
  const fpB = Math.max(0, fpMax - (b.fatigue ?? 0));
  const fpA = Math.max(0, fpMax - (a.fatigue ?? 0));

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-zinc-950/40 border border-zinc-700/40 px-2.5 py-2">
      <StateBar label="HP" before={hpB} after={hpA} max={maxHp} tone="amber" />
      <StateBar label="FP" before={fpB} after={fpA} max={fpMax} tone="sky" />
      {changed ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {ATTRS.map(({ key, label }) => {
            if (b[key] == null || a[key] == null || b[key] === a[key]) return null;
            const up = (a[key] as number) > (b[key] as number);
            return (
              <span
                key={key}
                className={`font-mono text-[10px] rounded px-1.5 py-0.5 border bg-zinc-900/70 ${
                  up ? "text-emerald-400 border-emerald-700/40" : "text-red-400 border-red-700/40"
                }`}
              >
                {label} {b[key]} → {a[key]}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================
   Mini ficha — the sheet's live core as it stood at a given
   moment. Reuses the real sheet's attribute colors/icons.
   ============================================================ */

const ATTR_CARDS: Array<{ key: "st" | "dx" | "iq" | "ht"; label: string; color: string; svg: string }> = [
  { key: "st", label: "ST", color: "text-red-400", svg: "M13 10V3L4 14h7v7l9-11h-7z" },
  { key: "dx", label: "DX", color: "text-emerald-400", svg: "M13 5l7 7-7 7M5 5l7 7-7 7" },
  { key: "iq", label: "IQ", color: "text-blue-400", svg: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { key: "ht", label: "HT", color: "text-purple-400", svg: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
];

function MomentFicha({
  ev,
  baseline,
  embedded = false,
}: {
  ev: CharacterHistoryEvent;
  baseline?: CharacterHistoryBaseline | null;
  embedded?: boolean;
}) {
  const before = ev.state_before ?? {};
  const after = ev.state_after ?? {};
  const maxHp = Math.max(1, baseline?.hp ?? 10);
  const fpMax = Math.max(1, (baseline?.fatigue ?? 0) > 0 ? baseline!.fatigue! : (baseline?.ht ?? 10));
  const hp = after.hp ?? maxHp;
  const fp = Math.max(0, fpMax - (after.fatigue ?? 0));
  const hpBefore = before.hp ?? maxHp;
  const fpBefore = Math.max(0, fpMax - (before.fatigue ?? 0));

  return (
    <div className={embedded ? "flex flex-col gap-3" : "rounded-xl border border-blue-400/20 bg-blue-400/[0.04] p-3"}>
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-300/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="font-mono text-[10px] tracking-widest uppercase text-blue-300/80">Ficha</span>
        <span aria-hidden className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(96,165,250,.3), transparent)" }} />
        {ev.narration_moment != null ? (
          <span className="font-mono text-[10px] text-amber-300/80 shrink-0">M.{ev.narration_moment}</span>
        ) : null}
      </div>

      <div className="mt-2.5 space-y-1.5">
        <StateBar label="HP" before={hpBefore} after={hp} max={maxHp} tone="amber" big />
        <StateBar label="FP" before={fpBefore} after={fp} max={fpMax} tone="sky" big />
      </div>

      <div className={embedded ? "mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5" : "mt-2.5 grid grid-cols-2 gap-2"}>
        {ATTR_CARDS.map(({ key, label, color, svg }) => {
          const b = before[key];
          const a = after[key];
          const value = a ?? baseline?.[key] ?? 10;
          const base = baseline?.[key] != null ? baseline![key]! : value;
          const delta = a != null && b != null && a !== b ? (a as number) - (b as number) : null;
          return (
            <div key={key} className={embedded ? "flex items-center gap-2.5 py-1" : "flex items-center gap-2.5 rounded-lg border border-zinc-700/40 bg-zinc-900/50 px-2.5 py-2"}>
              <svg className={`w-5 h-5 ${color} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d={svg} />
              </svg>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-mono text-lg font-bold leading-none ${color}`}>{value}</span>
                  {delta != null ? (
                    <span className={`font-mono text-[10px] font-bold ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {signed(delta)}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-[8px] font-semibold uppercase tracking-widest text-zinc-500">{label}</span>
                  {base !== value ? (
                    <span className="font-mono text-[9px] text-zinc-600">base {base}</span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Full ficha at a moment — the core (above) plus the filled
   profile: skills with levels recomputed from that moment's
   attributes, advantages/disadvantages and carried gear.
   ============================================================ */

function attrsSheet(ev: CharacterHistoryEvent | null | undefined, baseline?: CharacterHistoryBaseline | null): Sheet {
  const s = ev?.state_after ?? {};
  return {
    st: s.st ?? baseline?.st ?? 10,
    dx: s.dx ?? baseline?.dx ?? 10,
    iq: s.iq ?? baseline?.iq ?? 10,
    ht: s.ht ?? baseline?.ht ?? 10,
  } as Sheet;
}

function SkillsBlock({ skills, sheet, matchSheet }: { skills: CharacterSkill[]; sheet: Sheet; matchSheet: Sheet | null }) {
  if (!skills || skills.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[9px] tracking-widest uppercase text-zinc-500 mb-1.5">Perícias</p>
      <div className="flex flex-wrap gap-1">
        {skills.map((sk) => {
          const name = sk.skill_name || sk.name || "Perícia";
          const lv = skillLevel(sk, sheet);
          const lvM = matchSheet ? skillLevel(sk, matchSheet) : null;
          const changed = lv != null && lvM != null && lv !== lvM;
          return (
            <span
              key={sk.id}
              className={`font-mono text-[10px] rounded border px-1.5 py-0.5 bg-zinc-900/60 ${
                lv == null ? "text-zinc-500 border-zinc-700/40" : "text-zinc-200 border-zinc-700/50"
              }`}
            >
              {name}
              {lv != null ? ` ${lv}` : " ·"}
              {changed ? (
                <span className={lv > lvM ? "text-emerald-400" : "text-red-400"}> ({lvM}→{lv})</span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TagChips({ title, items }: { title: string; items: Array<{ id: string; name: string; cost_points?: number | null }> }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[9px] tracking-widest uppercase text-zinc-500 mb-1.5">{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span key={it.id} className="font-mono text-[10px] rounded border border-zinc-700/40 bg-zinc-900/60 px-1.5 py-0.5 text-zinc-300">
            {it.name}
            {it.cost_points != null ? <span className="text-zinc-500"> ({it.cost_points})</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

function GearBlock({ items }: { items: Array<{ id: string; name?: string; quantity?: number; equipment_status?: string; kind?: string }> }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="font-mono text-[9px] tracking-widest uppercase text-zinc-500 mb-1.5">Equipamento</p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-[11px] text-zinc-300">
            <ItemIcon
              item={{
                name: it.name,
                kind:
                  it.kind ??
                  (it.equipment_status === "wielded" ? "weapon" : it.equipment_status === "equipped" || it.equipment_status === "worn" ? "armor" : "equipment"),
              }}
              className="w-3.5 h-3.5 shrink-0"
              imgClassName="w-3.5 h-3.5 object-cover rounded"
            />
            <span className="truncate">{it.name}</span>
            {it.quantity != null && it.quantity > 1 ? (
              <span className="font-mono text-[10px] text-zinc-500 shrink-0">×{it.quantity}</span>
            ) : null}
            {it.equipment_status ? (
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 shrink-0">{it.equipment_status}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FullFicha({
  ev,
  profile,
  match,
  baseline,
  tag,
}: {
  ev: CharacterHistoryEvent;
  profile: CharacterViewer | null;
  match: CharacterHistoryEvent | null;
  baseline?: CharacterHistoryBaseline | null;
  tag?: string;
}) {
  const ch = profile?.character;
  const sheet = attrsSheet(ev, baseline);
  const matchSheet = match ? attrsSheet(match, baseline) : null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-700/40 bg-zinc-900/25 p-3">
      <div className="flex items-center gap-2">
        {tag ? (
          <span className="font-mono text-[9px] uppercase tracking-widest rounded border border-blue-700/40 px-1 py-0.5 text-blue-300/90">
            {tag}
          </span>
        ) : null}
        <span className="text-sm font-medium text-zinc-100 truncate">{nodeTitle(ev)}</span>
        <span aria-hidden className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(255,255,255,.12), transparent)" }} />
        {ev.chapter != null ? <span className="font-mono text-[9px] text-zinc-500 shrink-0">C{ev.chapter}</span> : null}
        {ev.narration_moment != null ? (
          <span className="font-mono text-[9px] text-amber-300/80 shrink-0">M.{ev.narration_moment}</span>
        ) : null}
      </div>

      <MomentFicha ev={ev} baseline={baseline} embedded />

      {ch ? (
        <>
          <SkillsBlock skills={ch.skills ?? []} sheet={sheet} matchSheet={matchSheet} />
          <TagChips title="Vantagens" items={ch.advantages ?? []} />
          <TagChips title="Desvantagens" items={ch.disadvantages ?? []} />
          <GearBlock items={ch.items ?? []} />
        </>
      ) : (
        <p className="text-[10px] text-zinc-600 italic">Carregando a ficha completa…</p>
      )}
    </div>
  );
}

/* ============================================================
   The horizontal "escala" — every event becomes a node on a
   time-scale, like the locations breadcrumb. The top strip draws
   the HP (amber) and FP (sky) rivers; the middle strip draws the
   ST/DX/IQ/HT attributes; the bottom row holds the clickable
   nodes. Below: a compare mode with two full ficha cards locked
   to any two moments (e.g. first vs last).
   ============================================================ */

const CELL = 220;
const RIVER = { h: 96, top: 14, bottom: 82 };
const ATTR_H = 76;
const ATTR_TOP = 14;
const ATTR_BOTTOM = 64;
const LABEL_H = 96;

function momentLabel(ev: CharacterHistoryEvent): string {
  return ev.narration_moment != null ? `M.${ev.narration_moment}` : "—";
}

function nodeTitle(ev: CharacterHistoryEvent): string {
  if (ev.kind === "test") return ev.test_skill_name ?? ev.test_skill ?? "Teste";
  return ev.name || "Evento";
}

const ATTR_STROKES: Array<{ key: "st" | "dx" | "iq" | "ht"; color: string; label: string }> = [
  { key: "st", label: "ST", color: "#f87171" },
  { key: "dx", label: "DX", color: "#34d399" },
  { key: "iq", label: "IQ", color: "#60a5fa" },
  { key: "ht", label: "HT", color: "#a78bfa" },
];

export default function CharacterJourney({
  characterId,
  selectedMoment,
  viewerId,
}: {
  characterId: string;
  selectedMoment: number | null;
  viewerId?: string;
}) {
  const [data, setData] = useState<CharacterHistory | null>(null);
  const [profile, setProfile] = useState<CharacterViewer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cmpA, setCmpA] = useState<string | null>(null);
  const [cmpB, setCmpB] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const q = viewerId ? `?viewer=${encodeURIComponent(viewerId)}` : "";
    api<CharacterHistory>(`/game-table-character/${characterId}/history`)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    api<CharacterViewer>(`/game-table-character/${characterId}${q}`)
      .then((d) => {
        if (alive) setProfile(d);
      })
      .catch(() => {
        if (alive) setProfile(null);
      });
    return () => {
      alive = false;
    };
  }, [characterId, viewerId]);

  if (error) {
    return <p className="text-xs text-zinc-600 italic">A crônica está inacessível no momento.</p>;
  }
  if (!data) {
    return <p className="text-xs text-zinc-600 italic animate-pulse">Seguindo o rastro dos eventos…</p>;
  }
  if (!data.events || data.events.length === 0) {
    return (
      <p className="text-zinc-600 text-sm italic">
        Nenhum evento registrado ainda — a jornada começa quando os dados rolam.
      </p>
    );
  }

  const events = data.events;
  const baseline = data.baseline ?? null;
  const maxHp = Math.max(1, baseline?.hp ?? 10);
  const fpMax = Math.max(1, (baseline?.fatigue ?? 0) > 0 ? baseline!.fatigue! : (baseline?.ht ?? 10));
  const keyOf = (ev: CharacterHistoryEvent, i: number) => `${ev.kind === "test" ? "t" : "c"}-${ev.id ?? i}`;
  const byKey = new Map(events.map((ev, i) => [keyOf(ev, i), ev]));
  const selected = (selectedId ? byKey.get(selectedId) : undefined) ?? events[events.length - 1];
  const ca = (cmpA ? byKey.get(cmpA) : undefined) ?? events[0];
  const cb = (cmpB ? byKey.get(cmpB) : undefined) ?? events[events.length - 1];
  const caKey = keyOf(ca, events.indexOf(ca));
  const cbKey = keyOf(cb, events.indexOf(cb));

  const W = events.length * CELL;
  const xOf = (i: number) => i * CELL + CELL / 2;

  const hpY = (hp: number) =>
    RIVER.bottom - (Math.max(0, Math.min(maxHp, hp)) / maxHp) * (RIVER.bottom - RIVER.top);
  const fpY = (fp: number) =>
    RIVER.bottom - (Math.max(0, Math.min(fpMax, fp)) / fpMax) * (RIVER.bottom - RIVER.top);

  const pts = events.map((ev, i) => {
    const hp = ev.state_after?.hp ?? maxHp;
    const fp = Math.max(0, fpMax - (ev.state_after?.fatigue ?? 0));
    return { x: xOf(i), hp, fp };
  });
  const hpLine = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${hpY(p.hp)}`).join(" ");
  const hpArea =
    pts.length > 1 ? `${hpLine} L ${pts[pts.length - 1].x} ${RIVER.bottom} L ${pts[0].x} ${RIVER.bottom} Z` : "";
  const fpLine = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${fpY(p.fp)}`).join(" ");
  const fpArea =
    pts.length > 1 ? `${fpLine} L ${pts[pts.length - 1].x} ${RIVER.bottom} L ${pts[0].x} ${RIVER.bottom} Z` : "";

  const attrScale = (key: "st" | "dx" | "iq" | "ht") => {
    const vals = [baseline?.[key] ?? 10, ...events.map((ev) => ev.state_after?.[key] ?? baseline?.[key] ?? 10)];
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const pad = Math.max(1, (hi - lo) * 0.15);
    lo -= pad;
    hi += pad;
    return (v: number) =>
      ATTR_BOTTOM - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (ATTR_BOTTOM - ATTR_TOP);
  };
  const attrPts = ATTR_STROKES.map(({ key }) => {
    const y = attrScale(key);
    return events.map((ev, i) => ({
      x: xOf(i),
      v: ev.state_after?.[key] ?? baseline?.[key] ?? 10,
      y: y(ev.state_after?.[key] ?? baseline?.[key] ?? 10),
      moved:
        (ev.state_after?.[key] ?? baseline?.[key] ?? 10) !==
        (i === 0 ? baseline?.[key] ?? 10 : events[i - 1].state_after?.[key] ?? baseline?.[key] ?? 10),
    }));
  });

  const dimmed = (ev: CharacterHistoryEvent) =>
    selectedMoment != null && ev.narration_moment != null
      ? (ev.narration_moment ?? 0) > selectedMoment
      : false;

  const totalH = RIVER.h + ATTR_H + LABEL_H;

  const compareRows = [
    { label: "HP", a: ca.state_after?.hp ?? maxHp, b: cb.state_after?.hp ?? maxHp },
    { label: "FP", a: Math.max(0, fpMax - (ca.state_after?.fatigue ?? 0)), b: Math.max(0, fpMax - (cb.state_after?.fatigue ?? 0)) },
    ...ATTRS.map(({ key, label }) => ({
      label,
      a: ca.state_after?.[key] ?? baseline?.[key] ?? 10,
      b: cb.state_after?.[key] ?? baseline?.[key] ?? 10,
    })),
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-1">Jornada</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
          {events.length} {events.length === 1 ? "evento" : "eventos"}
        </span>
        <span aria-hidden className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(96,165,250,.35), transparent)" }} />
      </div>

      {/* ---- horizontal scale ---- */}
      <div className="relative overflow-x-auto scroll-thin rounded-lg border border-zinc-700/40 bg-zinc-900/25 pb-3">
        <div className="relative" style={{ width: W, height: totalH }}>
          {/* HP + FP rivers */}
          <svg width={W} height={RIVER.h} className="absolute left-0 top-0 block">
            <defs>
              <linearGradient id="journeyHpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="journeyFpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1={0} y1={RIVER.bottom} x2={W} y2={RIVER.bottom} stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 3" />
            {hpArea ? <path d={hpArea} fill="url(#journeyHpGrad)" /> : null}
            {fpArea ? <path d={fpArea} fill="url(#journeyFpGrad)" /> : null}
            {hpLine ? <path d={hpLine} fill="none" stroke="#fbbf24" strokeWidth="1.8" /> : null}
            {fpLine ? <path d={fpLine} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="4 3" /> : null}
            {pts.map((p, i) => (
              <circle key={`h${i}`} cx={p.x} cy={hpY(p.hp)} r={3.1} fill="#fbbf24" />
            ))}
            {pts.map((p, i) => (
              <circle key={`f${i}`} cx={p.x} cy={fpY(p.fp)} r={2.1} fill="#38bdf8" />
            ))}
          </svg>
          <div className="absolute top-1.5 left-1.5 flex items-center gap-2 font-mono text-[9px] tracking-widest uppercase text-zinc-500">
            <span className="text-amber-400/90">HP · base {maxHp}</span>
            <span className="text-zinc-700">/</span>
            <span className="text-sky-400/80">FP · base {fpMax}</span>
          </div>

          {/* attributes strip */}
          <svg width={W} height={ATTR_H} className="absolute left-0 block" style={{ top: RIVER.h }}>
            <line x1={0} y1={ATTR_BOTTOM} x2={W} y2={ATTR_BOTTOM} stroke="#3f3f46" strokeWidth="1" strokeDasharray="2 3" />
            {attrPts.map((series, si) => {
              const line = series.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              return (
                <g key={ATTR_STROKES[si].key}>
                  <path d={line} fill="none" stroke={ATTR_STROKES[si].color} strokeWidth="1.4" opacity="0.85" />
                  {series.map((p, i) =>
                    p.moved ? (
                      <circle key={`${si}-${i}`} cx={p.x} cy={p.y} r={2.8} fill={ATTR_STROKES[si].color} />
                    ) : null
                  )}
                </g>
              );
            })}
          </svg>
          <div className="absolute flex items-center gap-2.5 font-mono text-[9px] tracking-widest uppercase" style={{ top: RIVER.h + 4, right: 8 }}>
            {ATTR_STROKES.map(({ key, label, color }) => (
              <span key={key} style={{ color }}>
                {label} {baseline?.[key] ?? 10}
              </span>
            ))}
          </div>

          {/* chapter dividers */}
          {events.slice(1).map((ev, i) =>
            ev.chapter !== events[i].chapter ? (
              <span
                key={`divider-${i}`}
                className="absolute top-0 bottom-0 w-px bg-zinc-600/70"
                style={{ left: i * CELL }}
              />
            ) : null
          )}

          {/* node rows */}
          {events.map((ev, i) => {
            const isSelected = keyOf(selected, events.indexOf(selected)) === keyOf(ev, i);
            const isCmpA = caKey === keyOf(ev, i);
            const isCmpB = cbKey === keyOf(ev, i);
            const isTest = ev.kind === "test";
            const hp = ev.state_after?.hp ?? maxHp;
            const firstInChapter = i === 0 || ev.chapter !== events[i - 1].chapter;
            const ringCls = isSelected
              ? "ring-2 ring-blue-500/60"
              : isCmpB
                ? "ring-2 ring-sky-500/50"
                : isCmpA
                  ? "ring-2 ring-emerald-500/50"
                  : "";
            return (
              <button
                key={keyOf(ev, i)}
                type="button"
                onClick={() => setSelectedId(keyOf(ev, i))}
                title={nodeTitle(ev)}
                className={`absolute rounded-md px-1.5 pb-2 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${
                  isSelected ? "bg-blue-500/10" : "hover:bg-zinc-800/70"
                } ${ringCls} ${dimmed(ev) ? "opacity-40" : ""}`}
                style={{ left: i * CELL, width: CELL, top: RIVER.h + ATTR_H, height: LABEL_H }}
              >
                {firstInChapter ? (
                  <span className="absolute top-1.5 left-1.5 font-mono text-[8px] text-zinc-500 border border-zinc-600/60 rounded px-0.5">
                    C{ev.chapter ?? "—"}
                  </span>
                ) : null}
                <div className="absolute bottom-2 left-0 right-0 px-2">
                  <div className={`font-mono text-[10px] uppercase tracking-widest ${isTest ? "text-sky-300/80" : "text-amber-300/80"}`}>
                    {momentLabel(ev)}
                    {isTest ? " · teste" : ""}
                  </div>
                  <div className={`text-[12px] font-medium leading-tight truncate ${isSelected ? "text-blue-100" : "text-zinc-300"}`}>
                    {nodeTitle(ev)}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-zinc-500">
                    {hp}
                    <span className="text-zinc-600">/{maxHp}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- detail + ficha at the moment ---- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {selected.kind === "test" ? (
                  <span className="text-[9px] font-mono uppercase tracking-widest text-sky-300/90 border border-sky-700/40 rounded px-1 py-0.5 shrink-0">
                    Teste
                  </span>
                ) : null}
                <span className="text-sm font-medium text-zinc-100">{nodeTitle(selected)}</span>
                {selected.narration_moment != null ? (
                  <span className="text-[10px] uppercase tracking-widest text-amber-400/60 font-mono shrink-0">
                    M.{selected.narration_moment}
                  </span>
                ) : null}
              </div>
              {selected.kind === "test" && selected.action_dice_roll ? (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="font-mono text-xs text-sky-300/90">{selected.action_dice_roll}</span>
                  {selected.action_result ? (
                    <span className="font-mono text-xs font-bold tabular-nums text-sky-100">= {selected.action_result}</span>
                  ) : null}
                </div>
              ) : null}
              {selected.kind === "test" ? (
                selected.action_description ? (
                  <p className="text-zinc-500 text-xs mt-1">{selected.action_description}</p>
                ) : null
              ) : selected.description ? (
                <p className="text-zinc-500 text-xs mt-1">{selected.description}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-zinc-400">
                {selected.scene_title ? <span>{selected.scene_title}</span> : null}
                {selected.narration_title ? (
                  <span className="text-zinc-500 italic">“{selected.narration_title}”</span>
                ) : null}
                {selected.action_queue != null ? (
                  <span className={`font-mono text-[10px] ${selected.kind === "test" ? "text-sky-400/60" : "text-amber-400/70"}`}>
                    A{selected.action_queue}.
                  </span>
                ) : null}
                {selected.kind !== "test" && selected.action_description ? <span>{selected.action_description}</span> : null}
                {selected.kind !== "test" && selected.action_result ? (
                  <span className="capitalize text-cyan-400/80">{selected.action_result}</span>
                ) : null}
              </div>
            </div>
            {eventChips(selected).length > 0 ? (
              <div className="flex flex-wrap gap-1 justify-end shrink-0">
                {eventChips(selected).map((c) => (
                  <span
                    key={c.key}
                    className={`text-[10px] font-mono bg-zinc-900/70 border border-zinc-700/50 rounded px-1.5 py-0.5 ${c.cls}`}
                  >
                    {c.label} {c.value}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {selected.kind !== "test" ? (
            <StateStrip before={selected.state_before} after={selected.state_after} baseline={baseline} />
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <MomentFicha ev={selected} baseline={baseline} />
        </div>
      </div>

      {/* ---- compare full ficha between two moments ---- */}
      {events.length >= 2 ? (
        <div className="mt-7">
          <div className="flex items-center gap-2 flex-wrap">
            <svg className="w-4 h-4 text-blue-300/80 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="font-mono text-[10px] tracking-widest uppercase text-blue-300/80">
              Ficha completa — comparar momentos
            </span>
            <span aria-hidden className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(96,165,250,.3), transparent)" }} />
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap font-mono text-[11px]">
            <label className="flex items-center gap-1.5 text-zinc-500">
              <span className="uppercase tracking-widest text-emerald-400/90">De</span>
              <select
                value={caKey}
                onChange={(e) => setCmpA(e.target.value || null)}
                className="bg-zinc-800 border border-zinc-700/50 rounded-md px-2 py-1 text-zinc-200 focus:outline-none focus:border-emerald-600/70"
              >
                {events.map((ev, i) => (
                  <option key={keyOf(ev, i)} value={keyOf(ev, i)}>
                    {momentLabel(ev)} · {nodeTitle(ev)}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-zinc-600" aria-hidden>→</span>
            <label className="flex items-center gap-1.5 text-zinc-500">
              <span className="uppercase tracking-widest text-sky-400/90">Para</span>
              <select
                value={cbKey}
                onChange={(e) => setCmpB(e.target.value || null)}
                className="bg-zinc-800 border border-zinc-700/50 rounded-md px-2 py-1 text-zinc-200 focus:outline-none focus:border-sky-600/70"
              >
                {events.map((ev, i) => (
                  <option key={keyOf(ev, i)} value={keyOf(ev, i)}>
                    {momentLabel(ev)} · {nodeTitle(ev)}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[10px] text-zinc-600 italic ml-auto hidden sm:block">
              As perícias são recalculadas com os atributos de cada momento.
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto_1fr] items-stretch">
            <FullFicha ev={ca} profile={profile} match={cb} baseline={baseline} tag="De" />

            <div className="flex flex-row lg:flex-col items-center justify-center gap-1.5 lg:px-1.5">
              {compareRows.map((row) => {
                const cls =
                  row.b > row.a ? "text-emerald-400" : row.b < row.a ? "text-red-400" : "text-zinc-500";
                return (
                  <span
                    key={row.label}
                    className="font-mono text-[10px] rounded border border-zinc-700/40 bg-zinc-900/60 px-1.5 py-0.5 whitespace-nowrap"
                  >
                    <span className="text-zinc-500">{row.label}</span>{" "}
                    <span className={cls}>{row.a} → {row.b}</span>
                  </span>
                );
              })}
            </div>

            <FullFicha ev={cb} profile={profile} match={ca} baseline={baseline} tag="Para" />
          </div>

          <p className="mt-3 text-[10px] text-zinc-600 italic">
            Perícias, vantagens e equipamento refletem o registro atual da mesa — os atributos centrais (HP/FP/ST/DX/IQ/HT) e os níveis derivados de perícia aparecem exatamente como estavam em cada momento selecionado.
          </p>
        </div>
      ) : null}
    </div>
  );
}