import { api } from "./api";
import type { GameTableCharacters } from "./types";

export interface SeatPick {
  userId?: string
  characterId?: string
}

/* Resolve "which player character represents me" for a table.
   The characters payload already flags NPCs, so a single call
   is enough. Preference order:
     1. an explicit characterId (the seat's own character),
     2. the seat user's character,
     3. the first non-NPC character (dev default). */
export async function getPlayerCharacterUrl(
  tableId: string,
  pick?: SeatPick
): Promise<string | undefined> {
  try {
    const data = await api<GameTableCharacters>(`/game-table-characters/${tableId}`);
    const candidates = (data?.characters ?? []).filter((c) => !c.isNpc);
    const byCharacter = pick?.characterId
      ? candidates.find((c) => c.id === pick.characterId)
      : undefined;
    const byUser = pick?.userId
      ? candidates.find((c) => c.user?.id === pick.userId || c.userId === pick.userId)
      : undefined;
    const player = byCharacter ?? byUser ?? candidates[0];
    const picked = player ? `/player/character/${player.id}` : undefined;
    return picked;
  } catch {
    return undefined;
  }
}