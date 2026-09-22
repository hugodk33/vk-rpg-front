"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { SkillItem } from "@/lib/types";
import {
  SKILL_TYPES,
  DIFFICULTY_DEFS,
  attributeRange,
  rollTarget,
  successProbability,
  resultNote,
  targetHex,
} from "./skillRules";

/* ============================================================
   The Skill Compendium
   Renders a skill as a GURPS compendium sheet: a type sigil, the
   difficulty chain (pips) and the 3d6 SUCCESS TABLE — a target
   rolled against the controlling attribute, shifted by difficulty,
   with exact % and a mastery note, all computed on the front.
   Requirements and defaults became a dependency ledger.
   ============================================================ */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("exhibit-reveal-in");
      return;
    }
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const inInitialViewport = rect.bottom > 0 && rect.top < vh;
    if (inInitialViewport) {
      el.classList.add("exhibit-reveal-in");
      return;
    }
    el.classList.add("exhibit-reveal-ready");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("exhibit-reveal-in")),
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Panel({ children }: { children: React.ReactNode }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className="exhibit-reveal">{children}</div>;
}

function Pips({ count, hex }: { count: number; hex: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${count} de 4`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="inline-block w-2 h-2 rotate-45"
          style={{ background: i < count ? hex : "#3f3f46", boxShadow: i < count ? `0 0 6px ${hex}55` : "inset 0 0 0 1px #52525b" }}
        />
      ))}
    </div>
  );
}

function DependencyRow({
  kind,
  kindLabel,
  skill,
  value,
  note,
  hex,
}: {
  kind: "requires" | "defaults";
  kindLabel: string;
  skill: string | null;
  value: string | null;
  note?: string | null;
  hex: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-700/40 rounded-lg px-4 py-2.5">
      <span
        className="font-mono text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border"
        style={{ borderColor: `${hex}55`, color: hex }}
      >
        {kindLabel}
      </span>
      <Link href={`/skill/${skill ?? ""}`} className="text-sm text-zinc-300 hover:text-amber-400 transition-colors truncate">
        {skill || "Perícia"}
      </Link>
      {value ? <span className="font-mono text-xs text-zinc-500 ml-auto shrink-0">{value}</span> : null}
      {note ? <span className="font-mono text-[10px] text-zinc-600 shrink-0 hidden sm:inline">{note}</span> : null}
      <span aria-hidden className="font-mono text-[10px] text-zinc-600 shrink-0">{kind === "requires" ? "← requer" : "→ padrão"}</span>
    </div>
  );
}

export default function SkillExhibit({ skill, tableId }: { skill: SkillItem; tableId?: string }) {
  const typeKey = skill.predefinition_type ?? "";
  const type = SKILL_TYPES[typeKey];
  const diffKey = skill.predefinition_difficulty ?? "";
  const diff = DIFFICULTY_DEFS[diffKey];
  const accent = type?.hex ?? "#d4d4d8";
  const diffHex = diff?.hex ?? "#a1a1aa";

  const attrRange = attributeRange();
  const rows = diff
    ? attrRange.map((a) => {
        const target = rollTarget(a, diff.offset);
        const prob = successProbability(target);
        return { attr: a, target, prob, note: resultNote(target), hex: targetHex(prob, accent) };
      })
    : [];

  const requires = (skill.dependencies ?? []).filter((d) => d.skill);
  const defaults = (skill.predefinition ?? []).filter((d) => d.skill);

  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden">
        {/* top strip */}
        <div className="exhibit-reveal flex items-center justify-between px-6 pt-6 lg:px-8">
          {tableId ? (
            <Link
              href={`/table/${tableId}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 hover:text-amber-400 transition-colors"
            >
              <span aria-hidden>←</span> Voltar à mesa
            </Link>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <span className="hidden sm:inline">Tabela de perícias</span>
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span>Ficha do compêndio</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[220px_1fr] gap-8 px-6 py-8 lg:px-8">
          {/* -------- SIGILO + TYPE (signature) -------- */}
          <aside className="exhibit-reveal order-1">
            <div className="sticky lg:top-28">
              <div className="flex flex-col items-center bg-zinc-800/40 rounded-lg border border-zinc-700/50 px-4 py-5 text-center">
                <span className="font-mono text-[10px] tracking-widest uppercase mb-4" style={{ color: accent }}>
                  {type?.label ?? (typeKey || "Perícia")}
                </span>
                <div
                  className="w-16 h-16 grid place-items-center rounded-full border border-dashed mb-4"
                  style={{ borderColor: `${accent}66`, background: "radial-gradient(circle at 50% 40%, #27272a, #18181b)" }}
                >
                  {type ? (
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={type.sigil} />
                    </svg>
                  ) : (
                    <span className="text-zinc-500 text-xl">?</span>
                  )}
                </div>

                <p className="font-mono text-[10px] text-zinc-500 leading-relaxed mb-5">
                  Teste contra <span style={{ color: accent }}>{type?.attributeShort ?? "—"}</span>
                  {type ? <> · {type.attribute}</> : null}
                </p>

                {/* difficulty chain */}
                <div className="w-full border-t border-zinc-700/50 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Dificuldade</span>
                    {diff ? <Pips count={diff.pips} hex={diffHex} /> : <span className="text-zinc-600 text-xs">—</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Nível padrão</span>
                    <span className="font-mono text-sm font-semibold" style={{ color: diffHex }}>
                      {metricRange(diff)}
                    </span>
                  </div>
                  {skill.predefinition_value != null ? (
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Valor</span>
                      <span className="font-mono text-sm text-zinc-200">{skill.predefinition_value}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          {/* -------- CONTENT -------- */}
          <div className="order-2 min-w-0 flex flex-col gap-5">
            <Panel>
              <h1 className="text-[clamp(26px,5vw,40px)] leading-none font-bold tracking-tight text-amber-100">
                {skill.name || "Perícia"}
              </h1>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {skill.category ? (
                  <span className="text-xs text-zinc-500">
                    {skill.category}
                    {skill.subcategory ? ` / ${skill.subcategory}` : ""}
                  </span>
                ) : null}
                {diff ? (
                  <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded border" style={{ borderColor: `${diffHex}66`, color: diffHex }}>
                    {diff.label}
                  </span>
                ) : null}
              </div>
              {skill.description ? (
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-400 max-w-2xl border-t border-zinc-700/60 pt-4">
                  {skill.description}
                </p>
              ) : null}
            </Panel>

            {/* -------- 3d6 SUCCESS TABLE (signature) -------- */}
            <Panel>
              <SectionTitle icon="◈" tint={accent} label="Tabela de sucesso · teste de 3d6" />
              <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 gap-y-2 px-4 py-2.5 border-b border-zinc-700/60 font-mono text-[10px] tracking-widest uppercase text-zinc-500">
                  <span>{type?.attributeShort ?? "Atributo"}</span>
                  <span>Alvo</span>
                  <span className="hidden sm:block">Sucesso</span>
                  <span className="hidden sm:block">Domínio</span>
                </div>
                {rows.map((r) => (
                  <div
                    key={r.attr}
                    className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-x-6 gap-y-1 px-4 py-2 border-b border-zinc-700/30 last:border-0"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-sm text-zinc-600 w-6">{r.attr}</span>
                      <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${r.hex}44, transparent)` }} />
                    </span>
                    <span className="font-mono text-base font-semibold tabular-nums" style={{ color: r.hex }}>
                      {r.target}
                    </span>
                    <span className="hidden sm:flex items-center gap-2">
                      <span className="w-24 h-1.5 rounded-full bg-zinc-900/70 overflow-hidden">
                        <span className="block h-full" style={{ width: `${r.prob}%`, background: r.hex }} />
                      </span>
                      <span className="font-mono text-xs tabular-nums text-zinc-300 w-12">{r.prob}%</span>
                    </span>
                    <span className="hidden sm:block font-mono text-[10px] text-zinc-500">{r.note}</span>
                  </div>
                ))}
                {!diff ? (
                  <p className="font-mono text-xs text-zinc-500 italic px-4 py-4">Nenhuma dificuldade registrada.</p>
                ) : null}
              </div>
            </Panel>

            {skill.effect ? (
              <Panel>
                <SectionTitle icon="✦" tint={accent} label="Efeito" />
                <p className="text-[15px] leading-relaxed text-zinc-400">{skill.effect}</p>
              </Panel>
            ) : null}

            {/* -------- REQUIRES / DEFAULTS (dependency ledger) -------- */}
            {(requires.length > 0 || defaults.length > 0) ? (
              <Panel>
                <SectionTitle icon="⌁" tint={accent} label="Rede de perícias" />
                <div className="grid lg:grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-2">Requer</div>
                    <div className="space-y-2">
                      {requires.length
                        ? requires.map((d, i) => (
                            <DependencyRow key={i} kind="requires" kindLabel="Req" skill={d.skill} value={d.value} note={null} hex="#fb7185" />
                          ))
                        : <p className="font-mono text-xs text-zinc-600 italic">Sem pré-requisitos.</p>}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-2">Oferece padrão</div>
                    <div className="space-y-2">
                      {defaults.length
                        ? defaults.map((d, i) => (
                            <DependencyRow
                              key={i}
                              kind="defaults"
                              kindLabel="Pad"
                              skill={d.skill}
                              value={d.value}
                              note={d.depends_on_skill_for_others_attributes}
                              hex={accent}
                            />
                          ))
                        : <p className="font-mono text-xs text-zinc-600 italic">Nenhum padrão definido.</p>}
                    </div>
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function metricRange(diff?: { offset: number; label: string }): string {
  if (!diff) return "—";
  const low = 8 + diff.offset;
  const high = 16 + diff.offset;
  return `${low}–${high}`;
}

function SectionTitle({ icon, tint, label }: { icon: string; tint: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 pb-1.5 border-b border-zinc-700/60">
      <span aria-hidden className="font-mono text-base leading-none" style={{ color: tint }}>{icon}</span>
      <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">{label}</span>
      <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${tint}55, transparent)` }} />
    </div>
  );
}
