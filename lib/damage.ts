import type { DamageEntry, DamageSource, WeaponAttack } from "./types";

/* =====================================================================
   Engine de dano GURPS 4e.
   REGRA: enquanto o backend só armazena PARÂMETROS (damage_source,
   damage_modifier, damage_dice, damage_type), o dano final é DERIVADO
   aqui a partir do ST do personagem (tabela THR/SW).
   ===================================================================== */

export const DAMAGE_SOURCE_LABELS: Record<string, string> = {
  st_swing: "Balanço (ST)",
  st_thrust: "Empuxo (ST)",
  rated_st_swing: "Balanço (ST poderosa)",
  rated_st_thrust: "Empuxo (ST poderosa)",
  fixed: "Fixado",
};

export const DAMAGE_TYPES: Record<string, string> = {
  cut: "Corte",
  cr: "Esmagamento",
  imp: "Perfuração",
  pi: "Flecha",
  "pi-": "Flecha pequena",
  "pi+": "Flecha grande",
  "pi++": "Flecha enorme",
  burn: "Queimadura",
  tox: "Veneno",
  cor: "Corrosão",
  fat: "Fadiga",
};

/* Tabela ST -> THR/SW (GURPS 4e Basic Set). Fonte: seed gurps_damage_table. */
const ST_DAMAGE: Array<[number, string, string]> = [
  [1, "1d-6", "1d-5"], [2, "1d-6", "1d-5"], [3, "1d-5", "1d-4"], [4, "1d-5", "1d-4"],
  [5, "1d-4", "1d-4"], [6, "1d-4", "1d-4"], [7, "1d-3", "1d-4"], [8, "1d-3", "1d-2"],
  [9, "1d-2", "1d-1"], [10, "1d-2", "1d"], [11, "1d-1", "1d+1"], [12, "1d-1", "1d+2"],
  [13, "1d", "2d-1"], [14, "1d", "2d"], [15, "1d+1", "2d+1"], [16, "1d+1", "2d+2"],
  [17, "1d+2", "3d-1"], [18, "1d+2", "3d"], [19, "2d-1", "3d+1"], [20, "2d-1", "3d+2"],
  [21, "2d", "4d-1"], [22, "2d", "4d"], [23, "2d+1", "4d+1"], [24, "2d+1", "4d+2"],
  [25, "2d+2", "5d-1"], [26, "2d+2", "5d"], [27, "3d-1", "5d+1"], [28, "3d-1", "5d+2"],
  [29, "3d", "6d-1"], [30, "3d", "6d"], [31, "3d+1", "6d+1"], [32, "3d+1", "6d+2"],
  [33, "3d+2", "7d-1"], [34, "3d+2", "7d"], [35, "4d-1", "7d+1"], [36, "4d-1", "7d+2"],
  [37, "4d", "8d-1"], [38, "4d", "8d"], [39, "4d+1", "8d+1"], [40, "4d+1", "8d+2"],
  [41, "4d+2", "9d"], [42, "4d+2", "9d"], [43, "5d-1", "9d+2"], [44, "5d-1", "9d+2"],
  [45, "5d", "10d"], [46, "5d", "10d"], [47, "5d+1", "10d+1"], [48, "5d+1", "10d+2"],
  [49, "5d+2", "11d-1"], [50, "5d+2", "11d-1"],
];

export const GURPS_DAMAGE_TABLE = ST_DAMAGE.map(([st, thrust, swing]) => ({ st, thrust, swing }));

export function lookupStDamage(st: number): { thrust: string; swing: string } {
  const clamped = Math.max(1, Math.min(50, Math.floor(st)));
  const row = ST_DAMAGE.find(([s]) => s === clamped);
  const fallback = ST_DAMAGE[clamped - 1] ?? ST_DAMAGE[ST_DAMAGE.length - 1];
  return row ? { thrust: row[1], swing: row[2] } : { thrust: fallback[1], swing: fallback[2] };
}

export interface ParsedDice {
  numDie: number;
  mod: number;
}

export function parseDice(value?: string | null): ParsedDice {
  if (!value) return { numDie: 0, mod: 0 };
  const m = value.match(/^(\d*)d(?:\*?)([+-]\d+)?$/i) || value.match(/^([+-]?\d+)$/);
  if (value.toLowerCase() === "0") return { numDie: 0, mod: 0 };
  if (m && m[2] !== undefined && /^(\d+)d/i.test(value)) {
    return { numDie: Number(m[1]) || 1, mod: Number(m[2]) || 0 };
  }
  if (m && /^(\d+)d/i.test(value)) {
    return { numDie: Number(m[1]) || 1, mod: 0 };
  }
  const plain = value.match(/^([+-]?\d+)$/);
  if (plain) return { numDie: 0, mod: Number(plain[1]) };
  return { numDie: 0, mod: 0 };
}

export function formatDice(p: ParsedDice): string {
  if (p.numDie === 0) return String(p.mod);
  const base = `${p.numDie}d`;
  if (p.mod > 0) return `${base}+${p.mod}`;
  if (p.mod < 0) return `${base}${p.mod}`;
  return base;
}

/* Soma um delta (modificador) a uma string de dano tipo "1d+1". */
export function addToDice(diceStr: string, delta: number): string {
  if (!delta) return diceStr;
  const p = parseDice(diceStr);
  p.mod += delta;
  return formatDice(p);
}

/* Dado base de ST/rated conforme a fonte de dano. */
export function baseDamageFor(st: number, source: DamageSource, ratedSt?: number | null): string {
  const effectiveSt = source.startsWith("rated_st_") ? (ratedSt ?? st) : st;
  const { thrust, swing } = lookupStDamage(effectiveSt);
  return source === "st_thrust" || source === "rated_st_thrust" ? thrust : swing;
}

/* Resolve o dano final de um ataque para um dado ST. Sempre DERIVADO. */
export function resolveAttack(attack: WeaponAttack, st: number, ratedSt?: number | null): string {
  if (attack.damage_source === "fixed") {
    const base = attack.damage_dice || "0";
    return addToDice(base, attack.damage_modifier ?? 0);
  }
  const base = baseDamageFor(st, attack.damage_source, ratedSt);
  return addToDice(base, attack.damage_modifier ?? 0);
}

/* Gera uma lista de entradas (st -> dano resolvido) para exibição em tabela. */
export function attackRangeEntries(
  attack: WeaponAttack,
  minSt?: number,
  maxSt?: number,
  ratedSt?: number | null
): DamageEntry[] {
  const entries: DamageEntry[] = [];
  for (const row of GURPS_DAMAGE_TABLE) {
    if (minSt != null && row.st < minSt) continue;
    if (maxSt != null && row.st > maxSt) continue;
    entries.push({
      st: row.st,
      type: attack.damage_type,
      damage: resolveAttack(attack, row.st, ratedSt),
      source: attack.damage_source,
    });
  }
  return entries;
}
