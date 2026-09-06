import type { VisibilityRule } from "./types";

/* ============================================================
   Visibility — "what the player knows"
   Each player character owns a set of visibility rules
   (`character_id` = the observing character). When that player
   opens a sheet, rules with `status` "hidden" censor the target
   entity (item / skill / advantage / disadvantage / attribute);
   rules with a non-hidden status reveal it, optionally with an
   obfuscated `value` shown instead of the real one.
   ============================================================ */

export interface VisibilityMap {
  hiddenItems: Set<string>;
  hiddenSkills: Set<string>;
  hiddenAdvantages: Set<string>;
  hiddenDisadvantages: Set<string>;
  hiddenAttributes: Set<string>;
  values: Map<string, string>;
}

export function buildVisibilityMap(rules: VisibilityRule[] | null | undefined): VisibilityMap {
  const map: VisibilityMap = {
    hiddenItems: new Set(),
    hiddenSkills: new Set(),
    hiddenAdvantages: new Set(),
    hiddenDisadvantages: new Set(),
    hiddenAttributes: new Set(),
    values: new Map(),
  };
  for (const r of rules ?? []) {
    const hidden = !(r.status === "known" || r.status === "specialist");
    if (r.item_id) {
      map.values.set(`item:${r.item_id}`, r.value ?? "");
      if (hidden) map.hiddenItems.add(r.item_id);
    }
    if (r.skill_id) {
      map.values.set(`skill:${r.skill_id}`, r.value ?? "");
      if (hidden) map.hiddenSkills.add(r.skill_id);
    }
    if (r.advantage_id) {
      map.values.set(`advantage:${r.advantage_id}`, r.value ?? "");
      if (hidden) map.hiddenAdvantages.add(r.advantage_id);
    }
    if (r.disadvantage_id) {
      map.values.set(`disadvantage:${r.disadvantage_id}`, r.value ?? "");
      if (hidden) map.hiddenDisadvantages.add(r.disadvantage_id);
    }
    if (r.attribute) {
      const key = r.attribute.toLowerCase();
      map.values.set(`attr:${key}`, r.value ?? "");
      if (hidden) map.hiddenAttributes.add(key);
      if (r.additionals_attributes) {
        for (const a of r.additionals_attributes.split(",")) {
          const k = a.trim().toLowerCase();
          if (k) {
            map.values.set(`attr:${k}`, r.value ?? "");
            if (hidden) map.hiddenAttributes.add(k);
          }
        }
      }
    }
  }
  return map;
}

export function isItemHidden(map: VisibilityMap, itemId?: string | null): boolean {
  return !!itemId && map.hiddenItems.has(itemId);
}

export function isSkillHidden(map: VisibilityMap, skillId?: string | null): boolean {
  return !!skillId && map.hiddenSkills.has(skillId);
}

export function isAdvantageHidden(map: VisibilityMap, advantageId?: string | null): boolean {
  return !!advantageId && map.hiddenAdvantages.has(advantageId);
}

export function isDisadvantageHidden(map: VisibilityMap, disadvantageId?: string | null): boolean {
  return !!disadvantageId && map.hiddenDisadvantages.has(disadvantageId);
}

export function isAttributeHidden(map: VisibilityMap, attr?: string | null): boolean {
  return !!attr && map.hiddenAttributes.has(attr.toLowerCase());
}
