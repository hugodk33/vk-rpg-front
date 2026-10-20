import type { CharacterViewer } from "./types";

/* ============================================================
   Pontos de criação/XP — mesma conta do CharacterForm.

   O jogador pode abrir a ficha para edição quando ainda tem
   pontos a distribuir (XP recém-concedido ou criação em
   andamento) OU quando o mestre liberou a edição por
   personagem (edit_enabled).
   ============================================================ */

const ATTR_COSTS: Record<"st" | "dx" | "iq" | "ht", number> = { st: 10, dx: 20, iq: 20, ht: 10 };

/** Quanto da ficha foi gasto (atributos + vantagens + perícias − desvantagens − manias). */
export function spentPoints(viewer: CharacterViewer): number {
  const sheet = viewer.character.sheet;
  const st = sheet?.base_st ?? sheet?.st ?? 10;
  const dx = sheet?.base_dx ?? sheet?.dx ?? 10;
  const iq = sheet?.base_iq ?? sheet?.iq ?? 10;
  const ht = sheet?.base_ht ?? sheet?.ht ?? 10;
  const attrCost =
    (st - 10) * ATTR_COSTS.st +
    (dx - 10) * ATTR_COSTS.dx +
    (iq - 10) * ATTR_COSTS.iq +
    (ht - 10) * ATTR_COSTS.ht;
  const advCost = (viewer.character.advantages ?? []).reduce((s, a) => s + (a.cost_points ?? 0), 0);
  const disCost = (viewer.character.disadvantages ?? []).reduce((s, d) => s + (d.cost_points ?? 0), 0);
  const skCost = (viewer.character.skills ?? []).reduce((s, sk) => s + (sk.cost_points ?? 0), 0);
  const quirkCost = (viewer.peculiarities ?? []).length;
  return attrCost + advCost - disCost + skCost - quirkCost;
}

/** Pontos ainda não distribuídos. 0 = sem sistema de pontos na mesa. */
export function unspentPoints(viewer: CharacterViewer): number {
  const points = viewer.character.sheet?.points ?? 0;
  if (points <= 0) return 0;
  return Math.max(0, points - spentPoints(viewer));
}

/** O jogador pode editar a ficha: tem pontos pendentes ou o mestre liberou. */
export function canEditSheet(viewer: CharacterViewer | null): boolean {
  if (!viewer) return false;
  if (viewer.character.edit_enabled) return true;
  return unspentPoints(viewer) > 0;
}
