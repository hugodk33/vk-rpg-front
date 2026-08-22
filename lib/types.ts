export interface Narrator {
  id: string
  userId: string
  name: string
  username: string
  email: string
  phone: string
  type: number
}

export interface Sheet {
  id: string
  name: string
  bio?: string
  backstory?: string
  points?: number
  hp?: number
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
  category?: string
  quality?: string
  condition?: string
  dimensions?: string
  description?: string
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
  user?: CharacterUser
  sheet?: Sheet | null
  advantages?: CharacterAdvantage[]
  disadvantages?: CharacterDisadvantage[]
  armors?: CharacterArmor[]
  skills?: CharacterSkill[]
  items?: CharacterItem[]
  damages?: CharacterDamage[]
  modifiers?: Modifier[]
  peculiarities?: Peculiarity[]
}

export interface GameTable {
  id: string
  narratorId?: string
  narrator?: Narrator
  intro?: string
  title: string
  system?: string
  players?: Array<{ character: TableCharacter }>
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
  description?: string
  effect?: string
  predefinition?: Array<{ skill: string | null; value: string | null; depends_on_skill_for_others_attributes: string | null }>
  dependencies?: Array<{ skill: string | null; value: string | null; type: string | null }>
}

export interface Item {
  id: string
  table_id?: string
  name: string
  type?: number
  category?: string
  weight?: number
  dimensions?: string
  description?: string
  quality?: string
  condition?: string
  damage_id?: string
  damage_name?: string
  damage_description?: string
  damage_type?: string
  damage_subtype?: string
  damage_value?: string
  damage_range?: string
  armor_id?: string
  armor_name?: string
  armor_description?: string
  armor_type?: string
  armor_subtype?: string
  armor_value?: string
  armor_fit?: string
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
