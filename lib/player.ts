import type {
  Advantage,
  CharacterViewer,
  Disadvantage,
  GameTable,
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableLocations,
  GameTableNpcs,
  GameTableScenes,
  GameTableSkills,
  Item,
  Location,
  NarrationAction,
  QueueEntry,
  SkillItem,
  TableCharacter,
  TableNpc,
  VisibilityRule,
} from "./types";
import { api } from "./api";
import { getSessionState } from "./session";

/* ============================================================
   Player console data loader (server-side).
   Resolves a character's table, roster, scenes, queue, session
   state, the character's OWN visibility rules (what the player
   knows), and the table's shared resources (items, skills,
   advantages, disadvantages, locations) shaped through the
   player's eyes — every endpoint echoes its table reference.
   Shared by the sheet and session routes.
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
  latestNarrationId: string;
  visibility: VisibilityRule[] | null;
  items: Item[];
  skills: SkillItem[];
  advantages: Advantage[];
  disadvantages: Disadvantage[];
  locations: Location[];
  /** the viewer-shaped location TREE (server-filtered) for the atlas. */
  locationTree: Location[];
  /** the location the narrator pinned as the default route (rota padrão). */
  defaultLocationId: string | null;
  npcs: TableNpc[];
}

export async function loadPlayerConsole(characterId: string): Promise<PlayerConsoleData> {
  const viewer = await api<CharacterViewer>(`/game-table-character/${characterId}`).catch(
    () => null as CharacterViewer | null
  );
  const tableId = viewer?.table?.id ?? "";

  const [scenesData, queue, charsData, itemsData, skillsData, advData, disData, locData, npcsData, visibilityData] =
    await Promise.all([
      tableId
        ? api<GameTableScenes>(`/game-table-scenes/${tableId}`).catch(() => ({ table: null, scenes: [] }))
        : Promise.resolve({ table: null, scenes: [] }) as Promise<GameTableScenes>,
      tableId
        ? api<QueueEntry[]>(`/game-table-queue/${tableId}`).catch(() => [])
        : Promise.resolve([]) as Promise<QueueEntry[]>,
      tableId
        ? api<GameTableCharacters>(`/game-table-characters/${tableId}?viewer=${encodeURIComponent(characterId)}`).catch(() => ({ table: null, characters: [] }))
        : Promise.resolve({ table: null, characters: [] }) as Promise<GameTableCharacters>,
      tableId
        ? api<GameTableItems>(`/game-table-items/${tableId}?viewer=${encodeURIComponent(characterId)}`).catch(() => ({ table: null, items: [] }))
        : Promise.resolve({ table: null, items: [] }) as Promise<GameTableItems>,
      tableId
        ? api<GameTableSkills>(`/game-table-skills/${tableId}?viewer=${encodeURIComponent(characterId)}`).catch(() => ({ table: null, skills: [] }))
        : Promise.resolve({ table: null, skills: [] }) as Promise<GameTableSkills>,
      tableId
        ? api<GameTableAdvantages>(`/game-table-advantages/${tableId}?viewer=${encodeURIComponent(characterId)}`).catch(() => ({ table: null, advantages: [] }))
        : Promise.resolve({ table: null, advantages: [] }) as Promise<GameTableAdvantages>,
      tableId
        ? api<GameTableDisadvantages>(`/game-table-disadvantages/${tableId}?viewer=${encodeURIComponent(characterId)}`).catch(() => ({ table: null, disadvantages: [] }))
        : Promise.resolve({ table: null, disadvantages: [] }) as Promise<GameTableDisadvantages>,
      tableId
        ? api<GameTableLocations>(`/game-table-locations/${tableId}?viewer=${encodeURIComponent(characterId)}`).catch(() => ({ table: null, locations: [], tree: [], defaultLocationId: null }))
        : Promise.resolve({ table: null, locations: [], tree: [], defaultLocationId: null }) as Promise<GameTableLocations>,
      tableId
        ? api<GameTableNpcs>(`/game-table-npcs/${tableId}`).catch(() => ({ table: null, npcs: [] }))
        : Promise.resolve({ table: null, npcs: [] }) as Promise<GameTableNpcs>,
      characterId
        ? api<VisibilityRule[]>(`/game-table-visibility/${encodeURIComponent(characterId)}`).catch(() => [])
        : Promise.resolve([]) as Promise<VisibilityRule[]>,
    ]);

  const state = getSessionState(scenesData.scenes);

  return {
    tableId,
    character: viewer?.character ?? null,
    viewer,
    roster: (charsData?.characters ?? []).filter((c) => c.is_active !== false),
    table: scenesData.table ?? viewer?.table ?? null,
    scenes: scenesData.scenes ?? [],
    actions: state.actions,
    queue,
    chapter: state.chapter,
    part: state.part,
    latestTitle: state.latestTitle,
    latestNarration: state.latestNarration,
    latestNarrationId: state.latestNarrationId,
    visibility: Array.isArray(visibilityData) ? visibilityData : null,
    items: itemsData?.items ?? [],
    skills: skillsData?.skills ?? [],
    advantages: advData?.advantages ?? [],
    disadvantages: disData?.disadvantages ?? [],
    locations: locData?.locations ?? [],
    locationTree: locData?.tree ?? [],
    defaultLocationId: locData?.defaultLocationId ?? null,
    npcs: npcsData?.npcs ?? [],
  };
}
