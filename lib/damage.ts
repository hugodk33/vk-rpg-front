import type { DamageEntry } from "./types";

export function parseDamageEntries(value?: string | null): DamageEntry[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is DamageEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof e.damage === "string" &&
        typeof e.type === "string" &&
        typeof e.st === "number"
    );
  } catch {
    return [];
  }
}

export function damageEntriesToJson(entries: DamageEntry[]): string {
  return JSON.stringify(entries);
}

export const DAMAGE_TYPES: Record<string, string> = {
  gdp: "Golpe de Ponta",
  bal: "Balanço",
  cnc: "Corte Normal",
  ctc: "Corte Longo",
  mlg: "Malho / Golpe",
  pnt: "Pontaria",
};

export const GURPS_BASIC_DAMAGE: Array<{ st: number; thrust: string; swing: string }> = [
  { st: 4, thrust: "0", swing: "0" },
  { st: 5, thrust: "1D-5", swing: "1D-5" },
  { st: 6, thrust: "1D-4", swing: "1D-4" },
  { st: 7, thrust: "1D-3", swing: "1D-3" },
  { st: 8, thrust: "1D-3", swing: "1D-2" },
  { st: 9, thrust: "1D-2", swing: "1D-1" },
  { st: 10, thrust: "1D-2", swing: "1D" },
  { st: 11, thrust: "1D-1", swing: "1D+1" },
  { st: 12, thrust: "1D-1", swing: "1D+2" },
  { st: 13, thrust: "1D", swing: "2D-1" },
  { st: 14, thrust: "1D", swing: "2D" },
  { st: 15, thrust: "1D+1", swing: "2D+1" },
  { st: 16, thrust: "1D+1", swing: "2D+2" },
  { st: 17, thrust: "1D+2", swing: "3D-1" },
  { st: 18, thrust: "1D+2", swing: "3D" },
  { st: 19, thrust: "2D-1", swing: "3D+1" },
  { st: 20, thrust: "2D-1", swing: "3D+2" },
];

export function generateGurpsDamageEntries(
  types: string[],
  minSt?: number,
  maxSt?: number
): DamageEntry[] {
  const entries: DamageEntry[] = [];
  const table = GURPS_BASIC_DAMAGE.filter(
    (row) => (minSt == null || row.st >= minSt) && (maxSt == null || row.st <= maxSt)
  );
  for (const row of table) {
    for (const t of types) {
      const dmg = t === "gdp" ? row.thrust : t === "bal" ? row.swing : null;
      if (dmg != null) {
        entries.push({ damage: dmg, type: t, st: row.st });
      }
    }
  }
  return entries;
}
