"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { GameTable, Location, Modifier, NarrationAction, Scene } from "@/lib/types";

/* ============================================================
   The Chronicle
   The Timeline tab reads as the table's editorial diary rather
   than a generic point-line:
   - chapters become FOLIO headers (roman numeral);
   - each narration is a "beat" with its MOMENT stamp;
   - the signature: DICE ROLLS (roll slips) — 3d6 tests come out
     as slips pasted into the chronicle, with the result and the
     per-attribute modifier chips. Randomness becomes an artifact.
   ============================================================ */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("exhibit-reveal-ready");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("exhibit-reveal-in")),
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`exhibit-reveal ${className}`}>
      {children}
    </div>
  );
}

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
function roman(n: number): string {
  return ROMAN[Math.max(0, Math.min(ROMAN.length - 1, Math.floor(n)))] ?? String(n);
}

/* ---------- location / cast ---------- */

function locationPin(loc: Location | null) {
  if (!loc) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-800/40 border border-zinc-700/40 rounded-full pl-2 pr-3 py-1">
      <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <Link href={`/location/${loc.id}`} className="text-blue-300 hover:text-blue-200 truncate">{loc.name}</Link>
      {loc.region ? <span className="text-zinc-500 hidden sm:inline">· {loc.region}</span> : null}
    </span>
  );
}

function CastChips({ chars, npcs, moment }: { chars: { id: string; name: string }[]; npcs: { characterId: string; name: string; status: string }[]; moment?: number }) {
  const players = chars.map((c) => ({
    id: c.id,
    name: c.name || "Player",
    sub: "Player",
    color: "#60a5fa",
  }));
  const npcList = npcs.map((n) => ({
    id: n.characterId,
    name: n.name || "NPC",
    sub: n.status || "NPC",
    color: n.status && /mort|death|fallen|dead/i.test(n.status) ? "#f87171" : "#fbbf24",
  }));
  const cast = [...players, ...npcList];
  if (!cast.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {cast.map((c) => (
        <Link
          key={c.id}
          href={`/character/${c.id}${moment != null ? `?moment=${moment}` : ""}`}
          className="inline-flex items-center gap-2 bg-zinc-800/60 hover:bg-zinc-700/70 border border-zinc-700/40 rounded-full px-3 py-1 transition-colors"
        >
          <span className="w-2 h-2 rounded-full" style={{ background: c.color, boxShadow: `0 0 6px ${c.color}66` }} />
          <span className="text-[13px] font-medium text-zinc-200">{c.name}</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{c.sub}</span>
        </Link>
      ))}
    </div>
  );
}

/* ---------- modifiers (attribute chips) ---------- */

type StatChip = { label: string; hex: string; val: string };

function modifierChips(m: Modifier | null): StatChip[] {
  if (!m) return [];
  const chips: StatChip[] = [];
  const signed = (v: number) => `${v >= 0 ? "+" : ""}${v}`;
  if (m.mod_hp != null) chips.push({ label: "HP", hex: "#f87171", val: signed(m.mod_hp) });
  if (m.mod_st != null) chips.push({ label: "ST", hex: "#f87171", val: signed(m.mod_st) });
  if (m.mod_dx != null) chips.push({ label: "DX", hex: "#34d399", val: signed(m.mod_dx) });
  if (m.mod_iq != null) chips.push({ label: "IQ", hex: "#60a5fa", val: signed(m.mod_iq) });
  if (m.mod_ht != null) chips.push({ label: "HT", hex: "#a78bfa", val: signed(m.mod_ht) });
  if (m.mod_fatigue != null) chips.push({ label: "FP", hex: "#38bdf8", val: signed(m.mod_fatigue) });
  if (m.hp != null) chips.push({ label: "HP→", hex: "#f87171", val: String(m.hp) });
  if (m.damage_value != null) chips.push({ label: "dmg", hex: "#f87171", val: m.damage_value });
  if (m.skill_value != null) chips.push({ label: "skill", hex: "#fbbf24", val: m.skill_value });
  if (m.item_quantity != null) chips.push({ label: "qty", hex: "#fbbf24", val: String(m.item_quantity) });
  if (m.item_weight != null) chips.push({ label: "wgt", hex: "#fbbf24", val: String(m.item_weight) });
  return chips;
}

/* ---------- ROLL SLIP (signature) ---------- */

/* Roll tone heuristic: with no target in the payload, we classify
   by presence of damage/degradation as "damage", otherwise "free". */
function rollTone(a: NarrationAction): { hex: string; tag: string } {
  const m = a.modifier;
  const isDamage = m?.damage_value != null || m?.mod_hp != null || m?.mod_st != null;
  const roll = (a.dice_roll ?? "").toLowerCase();
  const isCrit = /crit|crítico|decisivo|por pouco|critical|decisive/i.test(a.description ?? "") || /=\s*18\b/.test(a.result ?? "");
  if (isDamage) return { hex: "#f87171", tag: "damage" };
  if (isCrit) return { hex: "#fbbf24", tag: "crit" };
  if (roll.includes("d")) return { hex: "#60a5fa", tag: "test" };
  return { hex: "#a1a1aa", tag: "record" };
}

function RollSlip({ a, moment }: { a: NarrationAction; moment?: number }) {
  const char = a.character;
  const charName = char?.name || char?.username || "Someone";
  const charId = char?.id ?? "";
  const charUrl = charId ? `/character/${charId}${moment != null ? `?moment=${moment}` : ""}` : "";
  const tone = rollTone(a);
  const chips = modifierChips(a.modifier);

  return (
    <div className="mt-2.5 flex items-stretch gap-0">
      {/* dice tape (signature) */}
      <div className="w-1.5 shrink-0 rounded-l-md" style={{ background: `linear-gradient(180deg, ${tone.hex}, ${tone.hex}44)` }} />
      <div className="flex-1 min-w-0 bg-zinc-900/60 border border-zinc-700/40 border-l-0 rounded-r-lg px-3.5 py-2.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0 self-center" fill="none" stroke={tone.hex} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3l1.5 6.5L20 11l-6.5 1.5L12 19l-1.5-6.5L4 11l6.5-1.5L12 3z" />
          </svg>
          {charUrl ? (
            <Link href={charUrl} className="text-[13px] font-medium text-zinc-200 hover:text-blue-300 truncate">{charName}</Link>
          ) : (
            <span className="text-[13px] font-medium text-zinc-200">{charName}</span>
          )}
          {a.queue != null ? <span className="font-mono text-[10px] text-zinc-500">{a.queue}.</span> : null}
          <span className="font-mono text-[10px] tracking-widest uppercase px-1.5 py-px rounded border"
            style={{ borderColor: `${tone.hex}55`, color: tone.hex }}>{tone.tag}</span>
          <span className="text-[12px] text-zinc-400 truncate flex-1 min-w-0">{a.description}</span>
        </div>

        {/* dice -> result */}
        {a.dice_roll || a.result ? (
          <div className="flex items-center gap-2.5 mt-1.5">
            <span className="font-mono text-xs text-zinc-400">{a.dice_roll || "—"}</span>
            {a.dice_roll && a.result ? <span className="text-zinc-600">=</span> : null}
            <span className="font-mono text-base font-bold tabular-nums" style={{ color: a.result ? tone.hex : "#d4d4d8" }}>
              {a.result}
            </span>
          </div>
        ) : null}

        {chips.length ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {chips.map((c, i) => (
              <span key={i} className="inline-flex items-baseline gap-1 rounded bg-zinc-800/70 border border-zinc-700/50 px-1.5 py-0.5">
                <span className="font-mono text-[9px] tracking-widest uppercase text-zinc-500">{c.label}</span>
                <span className="font-mono text-[12px] font-semibold" style={{ color: c.hex }}>{c.val}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- beat (narration) ---------- */

function Beat({ n, sceneMoment, index }: { n: { narration: string; title?: string; moment?: number; location: Location | null; characters: { id: string; name: string }[]; npcs: { characterId: string; name: string; status: string }[]; actions: NarrationAction[] }; sceneMoment: number; index: number }) {
  const ms = `${sceneMoment}.${index + 1}`;
  return (
    <Panel>
      <div className="grid grid-cols-[52px_1fr] gap-4">
        <div className="text-right pt-1 select-none">
          <span className="font-mono text-[10px] text-zinc-500">M.{ms}</span>
        </div>
        <div className="min-w-0 relative">
          {/* spine thread */}
          <span aria-hidden className="absolute left-[-17px] top-2 bottom-[-8px] w-px bg-zinc-700/40 hidden sm:block" />
          {n.title ? <div className="font-mono text-[11px] tracking-widest uppercase text-blue-300/80 mb-1">{n.title}</div> : null}
          <p className="text-[15px] leading-relaxed text-zinc-300">{n.narration}</p>

          {n.location ? <div className="mt-2.5">{locationPin(n.location)}</div> : null}
          <CastChips chars={n.characters} npcs={n.npcs} moment={n.moment} />

          {n.actions?.length ? (
            <div className="mt-3 space-y-1.5">
              {[...n.actions]
                .sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0))
                .map((a) => (
                  <RollSlip key={a.id} a={a} moment={n.moment} />
                ))}
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

/* ---------- scene ---------- */

function SceneCard({ scene, showEdit }: { scene: Scene; showEdit: boolean }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-mono text-[11px] tracking-widest uppercase text-amber-500/90 border border-amber-700/40 rounded px-2 py-0.5">
          Scene {scene.moment != null ? scene.moment + 1 : "—"}
        </span>
        <h3 className="text-lg font-semibold text-zinc-100">{scene.title}</h3>
        {showEdit ? (
          <span className="ml-auto font-mono text-[10px] text-zinc-600 uppercase tracking-widest hidden sm:inline">open</span>
        ) : null}
      </div>
      <div className="pl-[52px]">
        {scene.narrations.length === 0 ? (
          <p className="text-sm text-zinc-600 italic font-mono">No entries in this scene.</p>
        ) : (
          <div className="space-y-5 border-l border-zinc-700/40 pl-[18px]">
            {scene.narrations.map((n, ni) => (
              <Beat key={n.id} n={n} sceneMoment={scene.moment ?? 0} index={ni} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- chronicle ---------- */

interface SceneTimelineProps {
  table: GameTable | null;
  scenes: Scene[];
  showEditButtons?: boolean;
}

export default function SceneTimeline({ table, scenes, showEditButtons = true }: SceneTimelineProps) {
  const chapters = new Map<number, Scene[]>();
  for (const scene of scenes) {
    const ch = scene.chapter || 1;
    if (!chapters.has(ch)) chapters.set(ch, []);
    chapters.get(ch)!.push(scene);
  }
  const chapterEntries = [...chapters.entries()];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* canopy */}
      <Panel>
        <h1 className="text-[clamp(30px,6vw,52px)] leading-[0.95] font-bold tracking-tight text-amber-100 mt-3">
          {table?.title || "The Chronicle"}
        </h1>
        {table?.intro ? (
          <p className="text-zinc-400 mt-4 max-w-2xl leading-relaxed border-l-2 border-zinc-700 pl-4">{table.intro}</p>
        ) : null}
        <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> {chapters.size} chapter{chapters.size !== 1 ? "s" : ""}
          <span className="text-zinc-700">·</span> {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
          <span className="text-zinc-700">·</span> {scenes.reduce((a, s) => a + s.narrations.length, 0)} log entry(ies)
        </div>
      </Panel>

      {scenes.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-10 h-10 text-zinc-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-zinc-500 text-sm">No scenes recorded yet — the chronicle starts blank.</p>
        </div>
      ) : (
        chapterEntries.map(([chapter, chapterScenes]) => (
          <Panel key={chapter} className="mt-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="min-w-0">
                <div className="font-mono text-[15px] tracking-[0.3em] uppercase text-zinc-500">Chapter</div>
              </div>
              <span className="select-none font-bold leading-none text-[24px] text-zinc-800 font-mono">{roman(chapter)}</span>
              <div className="flex-1 h-px bg-zinc-700/50" />
              <span className="font-mono text-[11px] text-zinc-500">{chapterScenes.length} scene{chapterScenes.length !== 1 ? "s" : ""}</span>
            </div>

            {chapterScenes.map((scene) => (
              <SceneCard key={scene.id} scene={scene} showEdit={showEditButtons} />
            ))}
          </Panel>
        ))
      )}
    </div>
  );
}
