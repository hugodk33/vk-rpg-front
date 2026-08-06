import { api } from "./api";
import type { GameTableCharacters, GameTableNpcs, TableNpc } from "./types";

export async function getPlayerCharacterUrl(tableId: string): Promise<string | undefined> {
  try {
    const [chars, npcs] = await Promise.all([
      api<GameTableCharacters>(`/game-table-characters/${tableId}`),
      api<GameTableNpcs>(`/game-table-npcs/${tableId}`).catch(() => ({ table: null, npcs: [] })),
    ]);
    const npcIds = new Set((npcs?.npcs ?? []).map((n: TableNpc) => n.character_id));
    const player = (chars?.characters ?? []).find((c) => !npcIds.has(c.id));
    return player ? `/jogador/personagem/${player.id}` : undefined;
  } catch {
    return undefined;
  }
}
