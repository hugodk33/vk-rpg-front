import type { CharacterSkill, Sheet } from "@/lib/types";

/* ============================================================
   Skill resolution (GURPS 4e adapted)
   The engine derives a skill level from:
     · governing attribute  (Physical -> DX, Mental -> IQ,
                             with a small override table for
                             HT-based skills like Sing/Running)
     · difficulty           (Easy/Average/Hard/Very Hard)
     · points invested      (game_table_character_skills.cost_points)
   Uses the effective attribute after active effects, so a
   buff/debuff on the sheet shows up in the roll target.
   ============================================================ */

const HT_BASED = new Set(["sing", "running"]);

const DIFFICULTY_TABLES: Record<string, Array<{ offset: number; cost: number }>> = {
  easy: [
    { offset: 0, cost: 1 }, { offset: 1, cost: 2 }, { offset: 2, cost: 4 },
    { offset: 3, cost: 8 }, { offset: 4, cost: 12 }, { offset: 5, cost: 16 },
    { offset: 6, cost: 20 }, { offset: 7, cost: 24 }, { offset: 8, cost: 28 },
  ],
  average: [
    { offset: -1, cost: 1 }, { offset: 0, cost: 2 }, { offset: 1, cost: 4 },
    { offset: 2, cost: 8 }, { offset: 3, cost: 12 }, { offset: 4, cost: 16 },
    { offset: 5, cost: 20 }, { offset: 6, cost: 24 }, { offset: 7, cost: 28 },
  ],
  hard: [
    { offset: -2, cost: 1 }, { offset: -1, cost: 2 }, { offset: 0, cost: 4 },
    { offset: 1, cost: 8 }, { offset: 2, cost: 12 }, { offset: 3, cost: 16 },
    { offset: 4, cost: 20 }, { offset: 5, cost: 24 }, { offset: 6, cost: 28 },
  ],
  "very hard": [
    { offset: -3, cost: 1 }, { offset: -2, cost: 2 }, { offset: -1, cost: 4 },
    { offset: 0, cost: 8 }, { offset: 1, cost: 12 }, { offset: 2, cost: 16 },
    { offset: 3, cost: 20 }, { offset: 4, cost: 24 }, { offset: 5, cost: 28 },
  ],
};

function difficultyKey(value?: string | null): string {
  const v = (value ?? "").toLowerCase().trim();
  if (v === "medium") return "average";
  return v || "average";
}

export function skillGoverningAttribute(
  skill: Pick<CharacterSkill, "predefinition_type" | "skill_name" | "name">,
  sheet?: Sheet | null
): number | null {
  const type = (skill.predefinition_type ?? "").toLowerCase();
  const name = (skill.skill_name || skill.name || "").toLowerCase();
  if (type.includes("physical")) {
    const key = HT_BASED.has(name) ? "ht" : "dx";
    return sheet?.[key] ?? null;
  }
  if (type.includes("mental")) {
    return sheet?.iq ?? null;
  }
  return null;
}

export function skillLevel(
  skill: Pick<CharacterSkill, "predefinition_type" | "predefinition_difficulty" | "cost_points" | "skill_name" | "name">,
  sheet?: Sheet | null
): number | null {
  const base = skillGoverningAttribute(skill, sheet);
  if (base == null) return null;
  const table = DIFFICULTY_TABLES[difficultyKey(skill.predefinition_difficulty)];
  const points = Math.max(0, skill.cost_points ?? 0);
  let offset = table.length > 0 ? table[0].offset : 0;
  for (const step of table) {
    if (points >= step.cost) offset = step.offset;
    else break;
  }
  return base + offset;
}

export function skillLabel(
  skill: Pick<CharacterSkill, "predefinition_type" | "predefinition_difficulty" | "cost_points" | "skill_name" | "name">,
  sheet?: Sheet | null
): string {
  const name = skill.skill_name || skill.name || "Skill";
  const level = skillLevel(skill, sheet);
  return level != null ? `${name} ${level}` : name;
}