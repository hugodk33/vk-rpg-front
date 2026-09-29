// lib/userTypes.ts

/**
 * Espelha `VKRPG/src/domain/types/UserType.ts`. Os valores são contratados com o
 * banco (`users.type`), então não podem mudar.
 *
 * `2` (admin) já era assumido aqui e pelo resto do frontend, mas nunca existiu
 * no banco — ocupá-lo não quebra dado nenhum.
 */
export const UserType = {
  Narrator: 0,
  Player: 1,
  Admin: 2,
  GuestNarrator: 3,
} as const

export type UserTypeValue = (typeof UserType)[keyof typeof UserType]

export const isTableOwnerType = (type: number | null | undefined): boolean =>
  type === UserType.Narrator || type === UserType.Admin

export const isGuestNarratorType = (type: number | null | undefined): boolean =>
  type === UserType.GuestNarrator

export const USER_TYPE_LABEL_KEY: Record<UserTypeValue, string> = {
  [UserType.Narrator]: "user.typeNarrator",
  [UserType.Player]: "user.typePlayer",
  [UserType.Admin]: "user.typeAdmin",
  [UserType.GuestNarrator]: "user.typeGuestNarrator",
}

/** Recursos de mesa que um narrador convidado pode receber. */
export const TableResource = {
  Scenes: "scenes",
  Locations: "locations",
  Characters: "characters",
  Items: "items",
  Skills: "skills",
  Advantages: "advantages",
  Disadvantages: "disadvantages",
  Visibility: "visibility",
  Modifiers: "modifiers",
  Settings: "settings",
} as const

export type TableResourceKey = (typeof TableResource)[keyof typeof TableResource]

export const TABLE_RESOURCES: readonly TableResourceKey[] = Object.values(TableResource)

export const RESOURCE_LABEL_KEY: Record<TableResourceKey, string> = {
  [TableResource.Scenes]: "ga.res.scenes",
  [TableResource.Locations]: "ga.res.locations",
  [TableResource.Characters]: "ga.res.characters",
  [TableResource.Items]: "ga.res.items",
  [TableResource.Skills]: "ga.res.skills",
  [TableResource.Advantages]: "ga.res.advantages",
  [TableResource.Disadvantages]: "ga.res.disadvantages",
  [TableResource.Visibility]: "ga.res.visibility",
  [TableResource.Modifiers]: "ga.res.modifiers",
  [TableResource.Settings]: "ga.res.settings",
}

export type AccessLevel = "read" | "write"

export type PermissionMap = Partial<Record<TableResourceKey, AccessLevel>>

export interface TableAccessGrant {
  id: string
  table_id: string
  user_id: string
  permissions: PermissionMap
  granted_by: string | null
  created_at: string | null
  user: {
    id: string
    name: string
    username: string
    email: string
    type: number
  } | null
}

export interface TableAccessResponse {
  tableId: string
  ownerId: string | null
  canManage: boolean
  availableResources: readonly string[]
  grants: TableAccessGrant[]
  candidates: { id: string; username: string; email: string }[]
}

export const isTableResourceKey = (value: unknown): value is TableResourceKey =>
  typeof value === "string" && (TABLE_RESOURCES as readonly string[]).includes(value)

/** Lê um mapa vindo da API sem confiar no formato. */
export const sanitizePermissions = (raw: unknown): PermissionMap => {
  const out: PermissionMap = {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isTableResourceKey(key)) continue
    if (value !== "read" && value !== "write") continue
    out[key] = value
  }
  return out
}
