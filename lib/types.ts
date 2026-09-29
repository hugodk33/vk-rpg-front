export interface Narrator {
  id: string
  userId: string
  name: string
  username: string
  email: string
  phone: string
  type: number
}

export interface PublicUser {
  id: string
  type?: number
  username?: string
  phone?: string
  email?: string
}

export interface Sheet {
  id: string
  name: string
  bio?: string
  backstory?: string
  points?: number
  hp?: number
  current_hp?: number
  st?: number
  dx?: number
  iq?: number
  ht?: number
  fatigue?: number
  fatigue_max?: number
  fatigue_threshold?: number
  fatigue_state?: "active" | "tired" | "exhausted"
  encumbrance?: string
  basic_speed?: number
  move?: number
  dodge?: number
  effective_st?: number
  effective_move?: number
  effective_dodge?: number
  base_hp?: number
  base_st?: number
  base_dx?: number
  base_iq?: number
  base_ht?: number
  base_fatigue?: number
  modifiers?: Modifier[]
}

export interface CharacterUser {
  id: string
  username?: string
  email?: string
  phone?: string
  type?: number
}

export interface CharacterAdvantage {
  id: string
  advantage_id?: string
  name: string
  character_id?: string
  cost_points?: number
  effect?: string
}

export interface CharacterDisadvantage {
  id: string
  disadvantage_id?: string
  name: string
  character_id?: string
  cost_points?: number
  effect?: string
}

export interface CharacterSkill {
  id: string
  skill_id?: string
  skill_name?: string
  name?: string
  character_id?: string
  value?: number
  cost_points?: number
  predefinition_type?: string
  predefinition_difficulty?: string
  effect?: string
}

export interface CharacterItem {
  id: string
  item_id?: string
  name: string
  character_id?: string
  quantity?: number
  weight?: number
  weight_lb?: number
  cost?: number
  dimensions?: string
  category?: string
  quality?: string
  condition?: string
  kind?: string
  description?: string
  weapon?: Weapon | null
  armor?: ArmorData | null
  equipment_id?: string
  equipment_status?: string
  equipment_location?: string
  equipment_quantity?: number
  equipment_rendered_st?: number | null
  /** Optional curated icon override (lucide name or image). */
  icon_key?: string | null
  /** Future: narrator image upload. When set, the image wins over the SVG. */
  image_url?: string | null
}

export interface CharacterArmor {
  id: string
  name?: string
  description?: string
  type?: string
  subtype?: string
  value?: string
  fit?: string
  weight?: number
  dr?: number
  locations?: string
}

export interface CharacterDamage {
  id: string
  name?: string
  description?: string
  type?: string
  subtype?: string
  value?: string
  range?: string
}

export type DamageSource =
  | "st_swing"
  | "st_thrust"
  | "rated_st_swing"
  | "rated_st_thrust"
  | "fixed";

export type DamageType =
  | "cut"
  | "cr"
  | "imp"
  | "pi"
  | "pi-"
  | "pi+"
  | "pi++"
  | "burn"
  | "tox"
  | "cor"
  | "fat";

export interface WeaponAttack {
  id?: string;
  weapon_id?: string;
  name?: string;
  usage?: string;
  damage_source: DamageSource;
  damage_dice?: string | null;
  damage_modifier?: number;
  damage_type: DamageType;
  armor_penetration?: number;
  accuracy?: number | null;
  range?: string;
  recoil?: number | null;
  shots?: number | null;
}

export interface Weapon {
  id?: string;
  item_id?: string;
  skill?: string | null;
  min_st?: number | null;
  rated_st?: number | null;
  handedness?: number;
  reach?: string;
  parry?: string | null;
  block?: string | null;
  fit?: string;
  attacks: WeaponAttack[];
}

export interface ArmorData {
  id?: string;
  item_id?: string;
  dr?: number | null;
  flex?: boolean;
  locations?: string;
  fit?: string;
}

export interface EquipmentRef {
  id?: string;
  item_id?: string;
  quantity?: number;
  status?: string;
  location?: string;
  rendered_st?: number | null;
}

export interface DamageEntry {
  damage: string;
  type: string;
  st: number;
  source?: DamageSource;
}

export interface Peculiarity {
  id: string
  character_id?: string
  name: string
  cost_points?: number
  effect?: string
  description?: string
  type?: string
}

export interface TableCharacter {
  id: string
  userId?: string
  name?: string
  isNpc?: boolean
  /** Se `false`, o personagem permanece na mesa mas está fora de jogo. */
  is_active?: boolean
  known?: boolean
  user?: CharacterUser
  sheet?: Sheet | null
  advantages?: CharacterAdvantage[]
  disadvantages?: CharacterDisadvantage[]
  armors?: CharacterArmor[]
  skills?: CharacterSkill[]
  items?: CharacterItem[]
  damages?: CharacterDamage[]
  modifiers?: Modifier[]
  active_effects?: Modifier[]
  peculiarities?: Peculiarity[]
}

export interface GameTable {
  id: string
  narratorId?: string
  narrator?: Narrator
  intro?: string
  title: string
  system?: string
  players?: Array<{
    userId?: string
    username?: string | null
    character?: TableCharacter | null
  }>
}

export interface LocationHexGrid {
  sizeM?: number | null
  width?: number | null
  height?: number | null
  centerQ?: number
  centerR?: number
  orientation?: "flat" | "pointy" | "square"
  rotationDeg?: number
}

export type HexTileKind = "open" | "grass" | "water" | "forest" | "stone" | "wall" | "door" | "rubble"

export interface HexTile {
  q: number
  r: number
  t: HexTileKind
}

export type DrawAssetKind = "door" | "chest" | "table" | "chair" | "bed" | "barrel" | "crate" | "bookcase" | "brazier" | "torch" | "altar" | "statue" | "tree" | "rock" | "well" | "rug" | "stairs" | "fountain"

export interface DrawShape {
  type: "path" | "rect" | "ellipse" | "line" | "asset"
  /**
   * "hexR" = normalized unit space: 1 unit = 1 hex radius, origin at the
   * center of hex (0,0). Legacy shapes without `unit` are authored in raw
   * pixels at R = 24 and are scaled at render time by R / 24.
   */
  unit?: "hexR"
  d?: string
  x?: number
  y?: number
  w?: number
  h?: number
  cx?: number
  cy?: number
  rx?: number
  ry?: number
  /** asset kind (for type "asset") */
  kind?: DrawAssetKind
  /** asset rotation in degrees (for type "asset") */
  rot?: number
  /** asset scale multiplier (for type "asset") */
  s?: number
  size: number
  color: string
}

export interface Location {
  id: string
  tableId?: string
  name: string
  parentId?: string | null
  kind?: string
  level?: number
  path?: string
  region?: string
  subRegion?: string
  address?: string
  isIndoor?: boolean
  country?: string
  area?: string
  dimensions?: string
  description?: string
  other?: string
  hex?: LocationHexGrid
  isBattlemap?: boolean
  shopName?: string | null
  floor?: number | null
  floorName?: string | null
  links?: LocationLink[]
  tiles?: HexTile[]
  drawing?: DrawShape[]
  ancestors?: Location[]
  children?: Location[]
}

export interface LocationConnection {
  id: string
  tableId?: string
  kind: string
  label?: string
  description?: string
  bidirectional?: boolean
  sort?: number
  floorFrom?: number
  floorTo?: number
  from?: { id?: string; q?: number; r?: number }
  to?: { id?: string; q?: number; r?: number }
}

export interface LocationLink {
  id: string
  kind: string
  label?: string
  description?: string
  bidirectional?: boolean
  sort?: number
  floorFrom?: number
  floorTo?: number
  here?: { q?: number; r?: number }
  partner?: Location
}

export interface Modifier {
  id: string
  name?: string
  description?: string
  effect?: string
  action_id?: string
  character_id?: string
  scene_id?: string
  narration_id?: string
  skill_id?: string
  location_id?: string
  cost_points?: number
  hp?: number
  st?: number
  dx?: number
  iq?: number
  ht?: number
  fatigue?: number
  encumbrance?: string
  mod_hp?: number
  mod_st?: number
  mod_dx?: number
  mod_iq?: number
  mod_ht?: number
  mod_fatigue?: number
  mod_encumbrance?: string
  damage_value?: string
  skill_value?: string
  armor_value?: string
  advantage_value?: string
  disadvantage_value?: string
  item_quantity?: number
  item_dimension?: string
  item_weight?: number
  item_range?: string
  item_status?: string
  apply_on_roll?: number
}

export interface GameTableModifiers {
  table: GameTable | null
  modifiers: Modifier[]
}

export interface CharacterHistoryEvent extends Modifier {
  kind?: "consequence" | "test"
  test_kind?: string | null
  test_skill?: string | null
  test_skill_name?: string | null
  narration_moment?: number | null
  narration_title?: string | null
  narration_body?: string | null
  scene_title?: string | null
  chapter?: number | null
  action_queue?: string | number | null
  action_description?: string | null
  action_result?: string | null
  action_dice_roll?: string | null
  state_before?: CharacterStatsSnapshot
  state_after?: CharacterStatsSnapshot
}

export interface CharacterStatsSnapshot {
  hp?: number
  st?: number
  dx?: number
  iq?: number
  ht?: number
  fatigue?: number
}

export type CharacterHistoryBaseline = CharacterStatsSnapshot

export interface CharacterHistory {
  character: {
    id: string
    name?: string | null
    user?: { id?: string; username?: string | null } | null
  }
  table?: GameTable | null
  baseline?: CharacterHistoryBaseline
  events: CharacterHistoryEvent[]
}

export interface ActionCharacter {
  id: string
  name: string
  userId: string
  username: string
}

export interface NarrationAction {
  id: string
  queue?: number
  moment?: number | null
  result?: string
  description?: string
  dice_roll?: string
  target?: string | null
  multitarget?: boolean
  /** planta baixa onde a action aconteceu */
  locationId?: string | null
  /** hex de destino (movimento na malha hexagonal) */
  q?: number | null
  r?: number | null
  facing?: number | null
  character: ActionCharacter | null
  modifier: Modifier | null
}

export interface NarrationCharacter {
  id: string
  name: string
  userId: string
  username: string
  conscious?: boolean
  /** posição inicial do token na planta baixa */
  q?: number | null
  r?: number | null
  facing?: number | null
}

export interface NarrationNpc {
  id: string
  characterId: string
  name: string
  status: string
  q?: number | null
  r?: number | null
  facing?: number | null
}

export interface Narration {
  id: string
  sceneId?: string
  title?: string
  narration: string
  moment?: number
  actions: NarrationAction[]
  characters: NarrationCharacter[]
  npcs: NarrationNpc[]
  location: Location | null
}

export interface Scene {
  id: string
  chapter?: number
  moment?: number
  title: string
  narrations: Narration[]
}

export interface GameTableScenes {
  table: GameTable | null
  scenes: Scene[]
}

export interface GameTableCharacters {
  table: GameTable | null
  characters: TableCharacter[]
}

export interface TableNpc {
  id: string
  character_id?: string
  location_id?: string
  name?: string
  status?: string
}

export interface GameTableItems {
  table: GameTable | null
  items: Item[]
}

export interface GameTableSkills {
  table: GameTable | null
  skills: SkillItem[]
}

export interface GameTableAdvantages {
  table: GameTable | null
  advantages: Advantage[]
}

export interface GameTableDisadvantages {
  table: GameTable | null
  disadvantages: Disadvantage[]
}

export interface GameTableLocations {
  table: GameTable | null
  locations: Location[]
  tree?: Location[]
  connections?: LocationConnection[]
  defaultLocationId?: string | null
}

export interface GameTableNpcs {
  table: GameTable | null
  npcs: TableNpc[]
}

/** Configurações de regra por mesa (game_table_settings). */
export interface TableSettings {
  table_id: string
  /** O turno encerra depois de um teste, ou depois de mover + virar-se. */
  turn_end_mode: "after_test" | "after_move"
  /** Itens: gastar pontos da ficha, ou o mestre concede. */
  item_mode: "points" | "gm"
  /** Teste de reação: com pontos, ou o mestre resolve. */
  reaction_mode: "points" | "gm"
  /** O mestre pode adicionar o item diretamente (independente de pontos). */
  gm_adds_item: number
  /**
   * @deprecated Substituído por `currencies` — uma mesa pode ter várias moedas.
   */
  money_item_id?: string | null
  /** Moedas da mesa. Cada uma é um item; `starting_amount` é o que o mestre dá. */
  currencies?: TableCurrency[]
  /** Loja inicial habilitada. */
  starting_shop: number
  /** Orçamento de pontos para a primeira ficha do jogador. */
  starting_points: number
}

/** Uma moeda da mesa: o item que a representa e quanto o mestre dá no início. */
export interface TableCurrency {
  item_id?: string
  /** Nome do item-moeda. No padrão do catálogo chega sem `item_id`: o item é criado. */
  name?: string | null
  starting_amount: number
}

/* ============================================================
   Catálogo de conteúdo (módulos/pacotes prontos de campanha)
   ============================================================ */

export interface ContentModuleRow {
  id: string
  slug: string
  name: string
  tech_level: string | null
  description: string | null
  accent: string | null
  sort: number
}

export interface ContentCategoryRow {
  id: string
  domain: string
  parent_id: string | null
  name: string
  display_name: string
  sort: number
}

export interface ContentCatalogCount {
  moduleId: string
  domain: string
  category: string
  subcategory: string | null
  count: number
}

export interface ContentReference {
  id: string
  moduleId: string
  domain: string
  category: string
  subcategory: string | null
  name: string
  description: string | null
  kind: string | null
}

export interface ContentRefSelection {
  domain: string
  ids: string[]
}

export interface ContentCatalog {
  modules: ContentModuleRow[]
  categories: ContentCategoryRow[]
  counts: ContentCatalogCount[]
  references: ContentReference[]
}

export interface QueueEntry {
  id: string
  character_id?: string | null
  action_id?: string | null
  queue?: string | number | null
  status?: string | null
  character_name?: string
  test_dice?: string | null
  test_count?: number | null
  test_mod?: number | null
  test_attr?: string | null
  test_kind?: "attr" | "skill" | string | null
  test_skill?: string | null
}

export interface VisibilityRule {
  id: string
  character_id?: string | null
  other_character_id?: string | null
  skill_id?: string | null
  advantage_id?: string | null
  disadvantage_id?: string | null
  attribute?: string | null
  additionals_attributes?: string | null
  item_id?: string | null
  location_id?: string | null
  value?: string | null
  status?: string | null
  scene_id?: string | null
  narration_id?: string | null
  moment?: number | null
  previous_status?: string | null
}

export interface CharacterViewer {
  table: GameTable | null
  character: TableCharacter
  peculiarities: Peculiarity[]
  moments: number[]
  selected_moment: number | null
}

export interface NpcViewer {
  npc: { id: string; status: string; location_id?: string | null }
  character: TableCharacter
  table: GameTable | null
  peculiarities: Peculiarity[]
}

export interface SkillItem {
  id: string
  table_id?: string
  name: string
  category?: string
  subcategory?: string
  type?: string
  predefinition_type?: string
  predefinition_difficulty?: string
  predefinition_value?: number
  description?: string
  effect?: string
  predefinition?: Array<{ skill: string | null; value: string | null; depends_on_skill_for_others_attributes: string | null }>
  dependencies?: Array<{ skill: string | null; value: string | null; type: string | null }>
}

export interface Item {
  id: string
  table_id?: string
  location_id?: string
  name: string
  kind?: string
  category?: string
  weight_lb?: number
  cost?: number
  /** Item-moeda em que o `cost` deste item está cotado. */
  currency_item_id?: string | null
  dimensions?: string
  description?: string
  quality?: string
  condition?: string
  weapon?: Weapon | null
  armor?: ArmorData | null
  /** Optional curated icon override (lucide name or image). */
  icon_key?: string | null
  /** Future: narrator image upload. When set, the image wins over the SVG. */
  image_url?: string | null
}

export interface Advantage {
  id: string
  table_id?: string
  name: string
  category?: string
  subcategory?: string
  cost_points?: number
  description?: string
}

export interface Disadvantage {
  id: string
  table_id?: string
  name: string
  category?: string
  subcategory?: string
  cost_points?: number
  effect?: string
  description?: string
}
