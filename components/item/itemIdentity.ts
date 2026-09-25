import type { Item } from "@/lib/types";
import { DAMAGE_TYPES, resolveAttack } from "@/lib/damage";
import { translate, type Lang } from "@/lib/i18n-core";

/* ============================================================
   Shared "item identity" for the Armory Exhibit and the item
   inventory lists. Centralizes how an item is classified into a
   visual type (crest glyph + label + tint) so a type looks and
   behaves the same across the whole app.

   Palette mirrors the Character page: zinc neutrals + semantic
   accents keyed to each item class.
   ============================================================ */

export type RGroup =
  | "sword"
  | "axe"
  | "club"
  | "knife"
  | "gun"
  | "bow"
  | "armor"
  | "shield"
  | "potion"
  | "equipment"
  | "weapon";

export const GROUP_UI: Record<RGroup, { label: string; hex: string }> = {
  sword: { label: "it.grp.sword", hex: "#f87171" },
  axe: { label: "it.grp.axe", hex: "#fbbf24" },
  club: { label: "it.grp.club", hex: "#a78bfa" },
  knife: { label: "it.grp.knife", hex: "#d4d4d8" },
  gun: { label: "it.grp.gun", hex: "#60a5fa" },
  bow: { label: "it.grp.bow", hex: "#34d399" },
  armor: { label: "it.grp.armor", hex: "#22d3ee" },
  shield: { label: "it.grp.shield", hex: "#60a5fa" },
  potion: { label: "it.grp.potion", hex: "#a78bfa" },
  equipment: { label: "it.grp.equipment", hex: "#d4d4d8" },
  weapon: { label: "it.grp.weapon", hex: "#fbbf24" },
};

export const QUALITY_STYLE: Record<string, { label: string; color: string; mark: string }> = {
  fine: { label: "it.q.fine", color: "#fbbf24", mark: "†" },
  very_fine: { label: "it.q.very_fine", color: "#fcd34d", mark: "††" },
  standard: { label: "it.q.standard", color: "#a1a1aa", mark: "·" },
  cheap: { label: "it.q.cheap", color: "#71717a", mark: "·" },
  poor: { label: "it.q.poor", color: "#f87171", mark: "×" },
};

export const CONDITION_LEDGER: Record<string, { notches: number; label: string; color: string }> = {
  new: { notches: 5, label: "it.cond.new", color: "#34d399" },
  good: { notches: 4, label: "it.cond.good", color: "#34d399" },
  average: { notches: 3, label: "it.cond.average", color: "#fbbf24" },
  worn: { notches: 3, label: "it.cond.worn", color: "#fbbf24" },
  damaged: { notches: 2, label: "it.cond.damaged", color: "#f87171" },
  poor: { notches: 1, label: "it.cond.poor", color: "#f87171" },
  broken: { notches: 0, label: "it.cond.broken", color: "#71717a" },
};

export const HANDEDNESS: Record<number, string> = { 1: "it.hands.1", 2: "it.hands.2" };

export function classify(item: Item): RGroup {
  const k = (item.kind || "").toLowerCase();
  const cat = (item.category || "").toLowerCase();
  const skill = (item.weapon?.skill || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  const hasSkill = (s: string) => skill.includes(s) || name.includes(s) || cat.includes(s);

  if (k === "shield") return "shield";
  if (k === "armor") return "armor";
  if (k === "equipment") {
    if (hasSkill("poção") || hasSkill("potion") || cat === "alchemy") return "potion";
    return "equipment";
  }
  if (hasSkill("pistol") || hasSkill("rifle") || hasSkill("shotgun") || hasSkill("gun") || hasSkill("metralhadora")) return "gun";
  if (hasSkill("bow") || hasSkill("arco") || hasSkill("crossbow") || hasSkill("besta")) return "bow";
  if (hasSkill("sword") || hasSkill("espada") || hasSkill("blade") || hasSkill("rapier") || hasSkill("sabre")) return "sword";
  if (hasSkill("axe") || hasSkill("machado") || hasSkill("halberd") || hasSkill("alabarda")) return "axe";
  if (hasSkill("club") || hasSkill("mace") || hasSkill("maça") || hasSkill("hammer") || hasSkill("martelo") || hasSkill("staff") || hasSkill("cajado")) return "club";
  if (hasSkill("knife") || hasSkill("faca") || hasSkill("dagger") || hasSkill("adaga")) return "knife";
  if (k === "weapon") return "weapon";
  return "equipment";
}

export interface Particular {
  label: string;
  value: string;
  tint?: string;
}

/* Key combat / usage quirk per item, surfaced in the inventory list. */
export function itemParticulars(item: Item, lang: Lang): Particular[] {
  const out: Particular[] = [];
  const L = (key: string) => translate(lang, key);
  const w = item.weapon;
  const a = item.armor;

  if (w) {
    if (w.skill) out.push({ label: L("it.p.skill"), value: w.skill });
    const atk = w.attacks?.[0];
    if (atk) {
      const dmg = resolveAttack(atk, 10, w.rated_st);
      const type = L(DAMAGE_TYPES[atk.damage_type] ?? atk.damage_type);
      out.push({ label: L("it.p.damage"), value: `${dmg} ${type}` });
    }
    if (w.min_st != null) out.push({ label: L("it.p.minSt"), value: String(w.min_st) });
    if (w.reach) out.push({ label: L("it.p.reach"), value: w.reach });
    if (w.handedness)
      out.push({ label: L("it.p.hands"), value: L(HANDEDNESS[w.handedness] ?? String(w.handedness)) });
    if (atk?.range && atk.range !== "C" && atk.range !== "Melee") out.push({ label: L("it.p.range"), value: atk.range });
    if (atk?.shots != null) out.push({ label: L("it.p.shots"), value: String(atk.shots) });
  }

  if (a) {
    if (a.dr != null) out.push({ label: L("it.p.dr"), value: String(a.dr), tint: "#22d3ee" });
    if (a.locations) out.push({ label: L("it.p.loc"), value: a.locations });
    if (a.fit) out.push({ label: L("it.p.fit"), value: a.fit });
    if (a.flex) out.push({ label: L("it.p.flex"), value: L("it.p.yes") });
  }

  return out;
}

export function qualityStyle(quality: string | undefined, lang: Lang) {
  const q = QUALITY_STYLE[quality || ""];
  return q ? { ...q, label: translate(lang, q.label) } : { label: quality || "—", color: "#a1a1aa", mark: "·" };
}

export function conditionLedger(condition: string | undefined, lang: Lang) {
  const c = CONDITION_LEDGER[condition || ""];
  return c
    ? { ...c, label: translate(lang, c.label) }
    : { notches: condition ? 3 : -1, label: condition || "—", color: "#fbbf24" };
}

export function groupLabel(group: RGroup, lang: Lang): string {
  return translate(lang, GROUP_UI[group].label);
}
