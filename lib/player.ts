import type {
  CharacterViewer,
  GameTable,
  GameTableCharacters,
  GameTableScenes,
  NarrationAction,
  QueueEntry,
  TableCharacter,
  VisibilityRule,
} from "./types";
import { api } from "./api";
import { getSessionState } from "./session";

/* ============================================================
   Player console data loader (server-side).
   Resolves a character's table, roster, scenes, queue, session
   state, and the character's OWN visibility rules (what the
   player knows). Shared by the sheet and session routes.
   ============================================================ */

export interface PlayerConsoleData {
  tableId: string;
  character: TableCharacter | null;
  viewer: CharacterViewer | null;
  roster: TableCharacter[];
  table: GameTable | null;
  scenes: GameTableScenes["scenes"];
  actions: NarrationAction[];
  queue: QueueEntry[];
  chapter: number;
  part: string;
  latestTitle: string;
  latestNarration: string;
  visibility: VisibilityRule[] | null;
}

export async function loadPlayerConsole(characterId: string): Promise<PlayerConsoleData> {
  const viewer = await api<CharacterViewer>(`/game-table-character/${characterId}`).catch(
    () => null as CharacterViewer | null
  );
  const tableId = viewer?.table?.id ?? "";

  const [scenesData, queue, charsData] = await Promise.all([
    tableId
      ? api<GameTableScenes>(`/game-table-scenes/${tableId}`).catch(() => ({ table: null, scenes: [] }))
      : Promise.resolve({ table: null, scenes: [] }) as Promise<GameTableScenes>,
    tableId
      ? api<QueueEntry[]>(`/game-table-queue/${tableId}`).catch(() => [])
      : Promise.resolve([]) as Promise<QueueEntry[]>,
    tableId
      ? api<GameTableCharacters>(`/game-table-characters/${tableId}?viewer=${encodeURIComponent(characterId)}`).catch(() => ({ table: null, characters: [] }))
      : Promise.resolve({ table: null, characters: [] }) as Promise<GameTableCharacters>,
  ]);

  const state = getSessionState(scenesData.scenes);

  return {
    tableId,
    character: viewer?.character ?? null,
    viewer,
    roster: charsData?.characters ?? [],
    table: scenesData.table ?? viewer?.table ?? null,
    scenes: scenesData.scenes ?? [],
    actions: state.actions,
    queue,
    chapter: state.chapter,
    part: state.part,
    latestTitle: state.latestTitle,
    latestNarration: state.latestNarration,
    visibility: null,
  };
}
