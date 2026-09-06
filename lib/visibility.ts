import type { TableCharacter, VisibilityRule } from "./types";

/* ============================================================
   Client-side visibility helpers.
   Mirrors VKRPG/src/domain/services/CharacterVisibility.ts:
     any rule = the OBSERVING character knows the TARGET entity;
     status 'known' | 'specialist' => entity is shown (the server
       masks 'known' values — masked name, unidentified items —
       and only 'specialist' reveals real values);
     status 'unknown' (legacy 'hidden') => hidden, `value` is the
       alias/placeholder shown in place of the real value;
     absent rule => hidden (default).
   ============================================================ */

export type VisStatus = "known" | "specialist" | "unknown";

export function revealed(r: VisibilityRule | null | undefined): boolean {
  if (!r) return false;
  const s = r.status;
  return s === "known" || s === "specialist";
}

export interface VisibilityMap {
  values: Map<string, string>;
  attrs: Map<string, VisibilityRule>;
  items: Map<string, VisibilityRule>;
  skills: Map<string, VisibilityRule>;
  advantages: Map<string, VisibilityRule>;
  disadvantages: Map<string, VisibilityRule>;
}

export function buildVisibilityMap(
  visibility: VisibilityRule[] | null | undefined
): VisibilityMap {
  const map: VisibilityMap = {
    values: new Map(),
    attrs: new Map(),
    items: new Map(),
    skills: new Map(),
    advantages: new Map(),
    disadvantages: new Map(),
  };
  for (const r of visibility ?? []) {
    if (!r) continue;
    if (r.attribute) {
      const names = [
        String(r.attribute).toLowerCase(),
        ...String(r.additionals_attributes ?? "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ];
      for (const n of names) {
        map.attrs.set(n, r);
        map.values.set(`attr:${n}`, r.value || "???");
      }
    }
    if (r.item_id) map.items.set(String(r.item_id), r);
    if (r.skill_id) map.skills.set(String(r.skill_id), r);
    if (r.advantage_id) map.advantages.set(String(r.advantage_id), r);
    if (r.disadvantage_id) map.disadvantages.set(String(r.disadvantage_id), r);
  }
  return map;
}

export function isItemHidden(vis: VisibilityMap, id?: string | null): boolean {
  return id ? !revealed(vis.items.get(String(id))) : true;
}

export function isSkillHidden(vis: VisibilityMap, id?: string | null): boolean {
  return id ? !revealed(vis.skills.get(String(id))) : true;
}

export function isAdvantageHidden(vis: VisibilityMap, id?: string | null): boolean {
  return id ? !revealed(vis.advantages.get(String(id))) : true;
}

export function isDisadvantageHidden(vis: VisibilityMap, id?: string | null): boolean {
  return id ? !revealed(vis.disadvantages.get(String(id))) : true;
}

export function isAttributeHidden(vis: VisibilityMap, a?: string | null): boolean {
  if (!a) return true;
  const r = vis.attrs.get(String(a).toLowerCase());
  return !revealed(r);
}

/* ============================================================
   NPC list shaping (player "table > NPC" lists).
   ============================================================ */

/** Rules scoped to the given target NPC (global target = any). */
export function scopeRules(
  rules: VisibilityRule[] | null | undefined,
  targetId: string
): VisibilityRule[] {
  return (rules ?? []).filter((r) => {
    const t = r.other_character_id;
    return !t || t === targetId;
  });
}

function attrNames(r: VisibilityRule): string[] {
  return String(r.attribute ?? "").length
    ? [
        String(r.attribute).toLowerCase(),
        ...String(r.additionals_attributes ?? "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ]
    : [];
}

function attrRule(rules: VisibilityRule[], name: string): VisibilityRule | null {
  for (const r of rules ?? []) {
    if (attrNames(r).includes(name.toLowerCase())) return r;
  }
  return null;
}

export interface ShapedNpc {
  known: boolean;
  id: string;
  name: string;
  realName: string | null;
  bio: string | null;
  backstory: string | null;
  st: number | null;
  dx: number | null;
  iq: number | null;
  ht: number | null;
}

/** Shape one NPC as the given observer sees it. */
export function shapeNpcForViewer(
  ch: TableCharacter,
  rules: VisibilityRule[]
): ShapedNpc {
  const scope = scopeRules(rules, ch.id);
  const known = scope.length > 0;

  const realName = ch.sheet?.name || ch.name || null;
  const nameRule = attrRule(scope, "name");
  const name = nameRule
    ? nameRule.status === "specialist"
      ? realName || "???"
      : nameRule.value || "???"
    : "???";

  const text = (key: "bio" | "backstory"): string | null => {
    const r = attrRule(scope, key);
    const raw = ch.sheet?.[key] ?? null;
    if (r && revealed(r)) return raw;
    if (r) return r.value || null;
    return null;
  };

  const num = (key: "st" | "dx" | "iq" | "ht"): number | null => {
    const r = attrRule(scope, key);
    const raw = ch.sheet?.[key] ?? null;
    if (!r) return null;
    if (revealed(r)) return raw ?? null;
    const v = Number(r.value);
    return r.value ? (Number.isNaN(v) ? null : v) : null;
  };

  return {
    known,
    id: ch.id,
    name,
    realName,
    bio: text("bio"),
    backstory: text("backstory"),
    st: num("st"),
    dx: num("dx"),
    iq: num("iq"),
    ht: num("ht"),
  };
}