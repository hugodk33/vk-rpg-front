/* =====================================================================
   GURPS 4e rules for skills — processed FRONT-END ONLY.
   Each skill rolls 3d6 against a target ("test against"). The base
   target is the skill's controlling Attribute; difficulty shifts it.
   The success table (3d6 <= target) is derived here, with exact %.

   Controlling-attribute mapping by type (GURPS 4e standard):
     Physical -> DX (Dexterity)
     Mental   -> IQ (Intelligence)
     Social   -> Will
   Note: the data here are STANDARD (default) level estimates — the
   backend does not expose spent character points.
   ===================================================================== */

export interface TypeDef {
  key: string;
  label: string;
  attribute: string;
  attributeShort: string;
  hex: string;
  sigil: string; // svg path (heroicons style, 24 viewBox)
}

export const SKILL_TYPES: Record<string, TypeDef> = {
  Physical: {
    key: "Physical",
    label: "Física",
    attribute: "Destreza",
    attributeShort: "DX",
    hex: "#f59e0b",
    sigil: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  },
  Mental: {
    key: "Mental",
    label: "Mental",
    attribute: "Inteligência",
    attributeShort: "IQ",
    hex: "#a78bfa",
    sigil: "M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  Social: {
    key: "Social",
    label: "Social",
    attribute: "Vontade",
    attributeShort: "Vontade",
    hex: "#2dd4bf",
    sigil: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c.621 0 1.125.504 1.125 1.125s-.504 1.125-1.125 1.125S8.625 11.379 8.625 10.758 9.129 9.75 9.75 9.75zm4.5 0c.621 0 1.125.504 1.125 1.125s-.504 1.125-1.125 1.125-1.125-.504-1.125-1.125.504-1.125 1.125-1.125z",
  },
};

/* Difficulty -> shift over the attribute (GURPS 4e standard for
   DEFAULT/basic training level) and pips. */
export const DIFFICULTY_DEFS: Record<string, { label: string; offset: number; pips: number; hex: string }> = {
  Easy: { label: "Fácil", offset: 0, pips: 1, hex: "#34d399" },
  Average: { label: "Média", offset: -1, pips: 2, hex: "#fbbf24" },
  Medium: { label: "Média", offset: -1, pips: 2, hex: "#fbbf24" },
  Hard: { label: "Difícil", offset: -2, pips: 3, hex: "#fb7185" },
  "Very Hard": { label: "Muito difícil", offset: -3, pips: 4, hex: "#f87171" },
};

/* Exact 3d6 distribution (216 outcomes): target -> # outcomes <= target. */
export const D6_DISTRIBUTION: Array<[number, number]> = [
  [3, 1], [4, 4], [5, 10], [6, 20], [7, 35], [8, 56], [9, 81], [10, 108],
  [11, 135], [12, 160], [13, 181], [14, 196], [15, 206], [16, 212], [17, 215], [18, 216],
];

export function successProbability(target: number): number {
  const clamped = Math.max(3, Math.min(18, target));
  const entry = D6_DISTRIBUTION.find(([t]) => t === clamped);
  const last = D6_DISTRIBUTION[D6_DISTRIBUTION.length - 1];
  const cum = entry ? entry[1] : (clamped > 18 ? last[1] : 0);
  return Math.round((cum / 216) * 1000) / 10;
}

export function attributeRange(): number[] {
  return [8, 9, 10, 11, 12, 13, 14, 15, 16];
}

export function rollTarget(attribute: number, offset: number): number {
  return attribute + offset;
}

/* Readable note of the result (GURPS 4e 'degree of success' descriptor). */
export function resultNote(target: number): string {
  if (target < 5) return "Quase impossível";
  if (target < 7) return "No limite";
  if (target < 10) return "Instável";
  if (target < 13) return "Confiável";
  if (target < 16) return "Sólido";
  return "Dominado";
}

export function targetHex(probPct: number, defaultHex: string): string {
  if (probPct >= 90) return "#34d399";
  if (probPct >= 70) return defaultHex;
  if (probPct >= 45) return "#fb923c";
  return "#f87171";
}
