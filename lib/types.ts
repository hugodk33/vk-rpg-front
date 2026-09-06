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
  encumbrance?: string
  basic_speed?: number
  move?: number
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

export interface Location {
  id: string
  name: string
  region?: string
  subRegion?: string
  address?: string
  isIndoor?: boolean
  country?: string
  area?: string
  dimensions?: string
  description?: string
  other?: string
}

export interface Modifier {
  id: string
  name?: string
  description?: string
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
  damage_value?: string
  skill_value?: string
  item_quantity?: number
  item_weight?: number
}

export interface CharacterHistoryEvent extends Modifier {
  narration_moment?: number | null
  narration_title?: string | null
  narration_body?: string | null
  scene_title?: string | null
  chapter?: number | null
  action_queue?: string | number | null
  action_description?: string | null
  action_result?: string | null
  action_dice_roll?: string | null
}

export interface CharacterHistory {
  character: {
    id: string
    name?: string | null
    user?: { id?: string; username?: string | null } | null
  }
  table?: GameTable | null
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
  result?: string
  description?: string
  dice_roll?: string
  character: ActionCharacter | null
  modifier: Modifier | null
}

export interface NarrationCharacter {
  id: string
  name: string
  userId: string
  username: string
}

export interface NarrationNpc {
  id: string
  characterId: string
  name: string
  status: string
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

export interface GameTableNpcs {
  table: GameTable | null
  npcs: TableNpc[]
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
  value?: string | null
  status?: string | null
}

export interface CharacterViewer {
  table: GameTable | null
  character: TableCharacter
  peculiarities: Peculiarity[]
  moments: number[]
  selected_moment: number | null
}

export interface NpcViewer {
  npc: { id: string; status: string }
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
  name: string
  kind?: string
  category?: string
  weight_lb?: number
  cost?: number
  dimensions?: string
  description?: string
  quality?: string
  condition?: string
  weapon?: Weapon | null
  armor?: ArmorData | null
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
