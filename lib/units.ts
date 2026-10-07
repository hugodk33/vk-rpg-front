/* O banco guarda peso em libras (`weight_lb`), que e a unidade usada pelas
   regras (limite de carga = ST*ST/5 lb). A interface exibe em quilogramas. */

export const KG_PER_LB = 0.45359237;

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

/** Peso formatado em kg, com 1 casa decimal (inteiros sem ".0"). */
export function formatKg(lb: number | null | undefined, digits = 1): string {
  if (lb == null) return "";
  const kg = lbToKg(lb);
  const rounded = Number(kg.toFixed(digits));
  return `${rounded} kg`;
}
