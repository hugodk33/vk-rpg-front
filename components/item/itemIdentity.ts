import type { Item } from "@/lib/types";
import { DAMAGE_TYPES, resolveAttack } from "@/lib/damage";

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
  sword: { label: "Espada", hex: "#f87171" },
  axe: { label: "Machado", hex: "#fbbf24" },
  club: { label: "Maça · Clava", hex: "#a78bfa" },
  knife: { label: "Faca · Adaga", hex: "#d4d4d8" },
  gun: { label: "Arma de fogo", hex: "#60a5fa" },
  bow: { label: "Arco", hex: "#34d399" },
  armor: { label: "Armadura", hex: "#22d3ee" },
  shield: { label: "Escudo", hex: "#60a5fa" },
  potion: { label: "Poção", hex: "#a78bfa" },
  equipment: { label: "Equipamento", hex: "#d4d4d8" },
  weapon: { label: "Arma", hex: "#fbbf24" },
};

export const QUALITY_STYLE: Record<string, { label: string; color: string; mark: string }> = {
  fine: { label: "FINA", color: "#fbbf24", mark: "†" },
  very_fine: { label: "MUITO FINA", color: "#fcd34d", mark: "††" },
  standard: { label: "PADRÃO", color: "#a1a1aa", mark: "·" },
  cheap: { label: "BARATA", color: "#71717a", mark: "·" },
  poor: { label: "POBRE", color: "#f87171", mark: "×" },
};

export const CONDITION_LEDGER: Record<string, { notches: number; label: string; color: string }> = {
  new: { notches: 5, label: "NOVA", color: "#34d399" },
  good: { notches: 4, label: "BOA", color: "#34d399" },
  average: { notches: 3, label: "REGULAR", color: "#fbbf24" },
  worn: { notches: 3, label: "GASTA", color: "#fbbf24" },
  damaged: { notches: 2, label: "DANIFICADA", color: "#f87171" },
  poor: { notches: 1, label: "POBRE", color: "#f87171" },
  broken: { notches: 0, label: "QUEBRADA", color: "#71717a" },
};

export const HANDEDNESS: Record<number, string> = { 1: "1 mão", 2: "2 mãos" };

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
export function itemParticulars(item: Item): Particular[] {
  const out: Particular[] = [];
  const w = item.weapon;
  const a = item.armor;

  if (w) {
    if (w.skill) out.push({ label: "Perícia", value: w.skill });
    const atk = w.attacks?.[0];
    if (atk) {
      const dmg = resolveAttack(atk, 10, w.rated_st);
      const type = DAMAGE_TYPES[atk.damage_type] || atk.damage_type;
      out.push({ label: "Dano", value: `${dmg} ${type}` });
    }
    if (w.min_st != null) out.push({ label: "FT mín", value: String(w.min_st) });
    if (w.reach) out.push({ label: "Alcance", value: w.reach });
    if (w.handedness) out.push({ label: "Mãos", value: HANDEDNESS[w.handedness] || String(w.handedness) });
    if (atk?.range && atk.range !== "C" && atk.range !== "Melee") out.push({ label: "Amp.", value: atk.range });
    if (atk?.shots != null) out.push({ label: "Tiros", value: String(atk.shots) });
  }

  if (a) {
    if (a.dr != null) out.push({ label: "DR", value: String(a.dr), tint: "#22d3ee" });
    if (a.locations) out.push({ label: "Locais", value: a.locations });
    if (a.fit) out.push({ label: "Ajuste", value: a.fit });
    if (a.flex) out.push({ label: "Flexível", value: "Sim" });
  }

  return out;
}

export function qualityStyle(quality?: string) {
  return (
    QUALITY_STYLE[quality || ""] || { label: quality || "—", color: "#a1a1aa", mark: "·" }
  );
}

export function conditionLedger(condition?: string) {
  return (
    CONDITION_LEDGER[condition || ""] || { notches: condition ? 3 : -1, label: condition || "—", color: "#fbbf24" }
  );
}
