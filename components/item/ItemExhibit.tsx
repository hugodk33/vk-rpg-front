"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { Item, WeaponAttack } from "@/lib/types";
import { DAMAGE_TYPES, GURPS_DAMAGE_TABLE, resolveAttack } from "@/lib/damage";
import ItemIcon from "@/components/items/ItemIcon";
import { classify, GROUP_UI, conditionLedger, qualityStyle, HANDEDNESS } from "./itemIdentity";

/* ============================================================
   The Armory Exhibit
   Renders an item as a "maker's plate" exhibit card: a type
   crest, an engraved ledger, kind-specific spec registers and
   a wear-notch condition ledger. Shares its type identity and
   palette with the inventory list.

   Palette: mirrors the Character page — zinc neutrals on a
   zinc-900 base, with the semantic accents keyed to each class.
   ============================================================ */

function WearNotch({ active, color }: { active: boolean; color: string }) {
  return (
    <span
      aria-hidden="true"
      className="w-1.5 h-5 -skew-x-12 rounded-[1px] inline-block transition-colors duration-500"
      style={{ background: active ? color : "#3f3f46", boxShadow: active ? `0 0 6px ${color}55` : "inset 0 0 0 1px #52525b" }}
    />
  );
}

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
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("exhibit-reveal-in");
        });
      },
      { threshold: 0.12 }
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

function LedgerCell({ label, value, tint }: { label: string; value: React.ReactNode; tint?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{label}</div>
      <div className="font-mono text-[15px] text-zinc-200 truncate" style={{ color: tint || "#e4e4e7" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function AttackRow({ atk, st, ratedSt, tint }: { atk: WeaponAttack; st: number; ratedSt?: number | null; tint: string }) {
  const dmg = resolveAttack(atk, st, ratedSt);
  const type = DAMAGE_TYPES[atk.damage_type] || atk.damage_type;
  const bits: string[] = [];
  if (atk.range) bits.push(`range ${atk.range}`);
  if (atk.armor_penetration) bits.push(`AP ${atk.armor_penetration}`);
  if (atk.accuracy != null) bits.push(`acc ${atk.accuracy}`);
  if (atk.recoil != null) bits.push(`rc ${atk.recoil}`);
  if (atk.shots != null) bits.push(`shots ${atk.shots}`);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-zinc-700/60 py-2.5">
      <span className="font-mono text-sm text-zinc-200">{atk.name || "Strike"}</span>
      {atk.usage ? <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{atk.usage}</span> : null}
      <span className="font-mono text-[15px] font-semibold" style={{ color: tint }}>
        {dmg}
      </span>
      <span className="font-mono text-xs text-zinc-400">{type}</span>
      {bits.length ? <span className="font-mono text-[10px] text-zinc-500">{bits.join(" · ")}</span> : null}
    </div>
  );
}

export default function ItemExhibit({ item, tableId }: { item: Item; tableId?: string }) {
  const group = classify(item);
  const tint = GROUP_UI[group].hex;
  const isArmorish = group === "armor" || group === "shield";
  const isWeapon = !!item.weapon;

  const qs = qualityStyle(item.quality);
  const cs = conditionLedger(item.condition);

  const primary = item.weapon?.attacks?.[0];
  const isStSourced = !!primary && primary.damage_source !== "fixed";
  const windowStart = item.weapon?.min_st ?? 10;
  const stWindow = GURPS_DAMAGE_TABLE.filter((r) => r.st >= windowStart && r.st <= windowStart + 5);
  const displaySt = 10;

  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl overflow-hidden">
        {/* top: back + crest row */}
        <div className="exhibit-reveal flex flex-wrap items-center gap-4 px-6 pt-6 lg:px-8">
          {tableId ? (
            <Link
              href={`/table/${tableId}`}
              className="group inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-zinc-500 hover:text-amber-400 transition-colors"
            >
              <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">←</span>
              Back to table
            </Link>
          ) : null}
          <div className="ml-auto flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            <span className="hidden sm:inline">Inventory</span>
            <span className="hidden sm:inline text-zinc-700">/</span>
            <span>Item sheet</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[200px_1fr] gap-8 px-6 py-8 lg:px-8">
          {/* -------- MAKER'S PLATE (signature) -------- */}
          <aside className="exhibit-reveal order-1">
            <div className="sticky lg:top-28">
              <div className="flex flex-col items-center bg-zinc-800/40 rounded-lg border border-zinc-700/50 px-4 py-5 text-center">
                <div className="flex items-center gap-3 pb-4 w-full select-none">
                  <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${tint}66)` }} />
                  <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: tint }}>
                    {GROUP_UI[group].label}
                  </span>
                  <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${tint}66, transparent)` }} />
                </div>

                <div
                  className="w-[72px] h-[72px] grid place-items-center rounded-full border border-dashed mb-4"
                  style={{ borderColor: `${tint}66`, background: "radial-gradient(circle at 50% 40%, #27272a, #18181b)" }}
                >
                  <ItemIcon item={item} className="w-9 h-9" imgClassName="w-12 h-12 object-cover rounded-full" />
                </div>

                {/* quality stamp */}
                <div
                  className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded border mb-5"
                  style={{ borderColor: `${qs.color}88`, color: qs.color, transform: "rotate(-1.5deg)" }}
                >
                  <span className="font-mono text-[13px] leading-none">{qs.mark}</span>
                  <span className="font-mono text-[10px] tracking-[0.3em]">{qs.label}</span>
                </div>

                <div className="w-full space-y-4 text-left border-t border-zinc-700/50 pt-4">
                  <LedgerCell label="Weight" value={item.weight_lb != null ? `${item.weight_lb} lb` : "—"} tint={tint} />
                  <LedgerCell label="Cost" value={item.cost != null ? `$${item.cost}` : "—"} tint="#fbbf24" />
                  <LedgerCell label="Size" value={item.dimensions || "—"} />
                  {item.category ? (
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Class</div>
                      <div className="font-mono text-[13px] text-zinc-200 break-words">{item.category}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          {/* -------- MAIN SPECS -------- */}
          <div className="order-2 min-w-0 flex flex-col gap-5">
            {/* Name + description */}
            <Panel>
              <h1 className="text-[clamp(26px,5vw,40px)] leading-none font-bold tracking-tight text-amber-100">
                {item.name || "Item"}
              </h1>
              <div className="mt-3 border-t border-zinc-700/60 pt-3">
                {item.description ? (
                  <p className="text-[15px] leading-relaxed text-zinc-400 max-w-2xl">{item.description}</p>
                )                 : (
                  <p className="text-sm text-zinc-600 italic">No description on record.</p>
                )}
              </div>
            </Panel>

            {/* Weapon register */}
            {isWeapon && item.weapon ? (
              <Panel>
                <SectionTitle icon="✦" tint={tint} label="Attack register" />
                <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 p-4">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 items-baseline pb-3 border-b border-zinc-700/60 mb-1">
                    {item.weapon.skill ? <Spec label="Skill" value={item.weapon.skill} /> : null}
                    {item.weapon.min_st != null ? <Spec label="Min ST" value={item.weapon.min_st} tint={tint} /> : null}
                    {item.weapon.rated_st != null ? <Spec label="Rated ST" value={item.weapon.rated_st} tint={tint} /> : null}
                    {item.weapon.reach ? <Spec label="Reach" value={item.weapon.reach} /> : null}
                    {item.weapon.parry ? <Spec label="Parry" value={item.weapon.parry} /> : null}
                    {item.weapon.block ? <Spec label="Block" value={item.weapon.block} /> : null}
                    {item.weapon.handedness ? <Spec label="Grip" value={HANDEDNESS[item.weapon.handedness] || `ST ${item.weapon.handedness}`} /> : null}
                  </div>

                  {item.weapon.attacks?.length ? (
                    <div>
                      <div className="flex items-center justify-between pt-1 pb-1">
                        <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Damage (ST {displaySt})</span>
                        <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Weapon roll</span>
                      </div>
                      {item.weapon.attacks.map((atk) => (
                        <AttackRow key={atk.id || atk.name} atk={atk} st={displaySt} ratedSt={item.weapon?.rated_st} tint={tint} />
                      ))}

                      {isStSourced && stWindow.length ? (
                        <div className="mt-4 border-t border-zinc-700/60 pt-3">
                          <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-2">
                            {DAMAGE_TYPES[primary.damage_type] || primary.damage_type} · scales with strength
                          </div>
                          <div className="grid grid-cols-6 gap-1.5">
                            {stWindow.map((row) => (
                              <div key={row.st} className="text-center bg-zinc-900/60 border border-zinc-700/50 rounded px-1 py-1.5">
                                <div className="font-mono text-[10px] text-zinc-500">ST {row.st}</div>
                                <div className="font-mono text-[13px] font-semibold" style={{ color: tint }}>
                                  {resolveAttack(primary, row.st, item.weapon?.rated_st)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-zinc-500 italic pt-2">No attacks defined.</p>
                  )}
                </div>
              </Panel>
            ) : null}

            {/* Armor / shield protection plate */}
            {isArmorish && item.armor ? (
              <Panel>
                <SectionTitle icon="◈" tint="#22d3ee" label={group === "shield" ? "Shield protection" : "Protection plate"} />
                <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 p-4">
                  <div className="flex flex-wrap gap-x-8 gap-y-4">
                    <ProtectionStat tint="#22d3ee" label="Damage Resistance (DR)" value={item.armor.dr ?? "—"} />
                    <ProtectionStat tint="#34d399" size="sm" label="Flexible" value={item.armor.flex ? "Yes" : "No"} />
                    {item.armor.locations ? <ProtectionStat tint="#a78bfa" label="Locations" value={item.armor.locations} /> : null}
                    {item.armor.fit ? <ProtectionStat tint="#fbbf24" label="Fit" value={item.armor.fit} /> : null}
                  </div>
                </div>
              </Panel>
            ) : null}

            {/* Plain armor-ish without nested armor data */}
            {isArmorish && !item.armor ? (
              <Panel>
                <SectionTitle icon="◈" tint="#22d3ee" label="Protection" />
                <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 p-4">
                  <p className="font-mono text-xs text-zinc-500 italic">No protection details on record.</p>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>

        {/* -------- WEAR / CONDITION LEDGER (state) -------- */}
        {cs.notches >= 0 ? (
          <div className="exhibit-reveal px-6 pb-8 lg:px-8">
            <div className="bg-zinc-800/40 rounded-lg border border-zinc-700/50 p-4 flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">Condition</span>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <WearNotch key={i} active={i < cs.notches} color={cs.color} />
                  ))}
                </div>
                <span className="font-mono text-sm font-semibold" style={{ color: cs.color }}>
                  {cs.label}
                </span>
              </div>
              <p className="font-mono text-[10px] tracking-wider text-zinc-500 select-none max-w-[30ch] text-right">
                {cs.notches === 5
                  ? "Fresh from the forge. No battle marks."
                  : cs.notches >= 3
                  ? "Shows signs of use in the field."
                  : cs.notches >= 1
                  ? "Heavy wear. Would need a smith."
                  : "Unusable as it stands."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ icon, tint, label }: { icon: string; tint: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 border-b border-zinc-700/60 pb-1.5">
      <span aria-hidden className="font-mono text-base leading-none" style={{ color: tint }}>
        {icon}
      </span>
      <span className="font-mono text-[13px] font-bold uppercase tracking-wider text-zinc-300">{label}</span>
      <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${tint}55, transparent)` }} />
    </div>
  );
}

function Spec({ label, value, tint }: { label: string; value: string | number; tint?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{label}</span>
      <span className="font-mono text-sm text-zinc-200" style={tint ? { color: tint } : undefined}>{value}</span>
    </span>
  );
}

function ProtectionStat({ label, value, tint, size = "lg" }: { label: string; value: React.ReactNode; tint?: string; size?: "lg" | "sm" }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">{label}</div>
      <div
        className={size === "lg" ? "font-mono text-3xl font-semibold leading-tight" : "font-mono text-lg leading-tight"}
        style={{ color: tint || "#e4e4e7" }}
      >
        {value}
      </div>
    </div>
  );
}
