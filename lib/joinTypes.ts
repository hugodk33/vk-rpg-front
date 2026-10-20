// lib/joinTypes.ts

/**
 * Espelha `VKRPG/src/domain/types/TableJoin.ts`.
 *
 * O papel e o estado são contratados com o banco (game_table_join_requests),
 * então não podem mudar. A identificação é dev-only (sem auth): a URL diz quem
 * é a pessoa e o backend confere se o tipo do usuário bate com o papel.
 */
import { UserType } from "@/lib/userTypes";

export const JoinRole = {
  Player: "player",
  CoNarrator: "co_narrator",
} as const;

export type JoinRoleValue = (typeof JoinRole)[keyof typeof JoinRole];

export const JoinStatus = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;

export type JoinStatusValue = (typeof JoinStatus)[keyof typeof JoinStatus];

export const isJoinRole = (value: unknown): value is JoinRoleValue =>
  value === JoinRole.Player || value === JoinRole.CoNarrator;

/** Mesma regra do backend: só Jogador entra como jogador; narradores como co-narrador. */
export const roleAllowedForUserType = (
  role: JoinRoleValue,
  type: number | null | undefined
): boolean => {
  if (role === JoinRole.Player) return type === UserType.Player;
  return type === UserType.GuestNarrator || type === UserType.Narrator;
};

export interface TableJoinRequest {
  id: string;
  table_id: string;
  user_id: string;
  role: JoinRoleValue;
  status: JoinStatusValue;
  message: string | null;
  created_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    type: number;
  } | null;
}

export interface TableJoinCandidate {
  id: string;
  username: string;
  email: string;
  type: number;
}

export interface JoinStatusResponse {
  tableId: string;
  ownerId: string;
  canManage: boolean;
  isPlayer: boolean;
  hasGrant: boolean;
  request: TableJoinRequest | null;
}

/** Um personagem que já está na mesa — só o suficiente para o convite. */
export interface TablePreviewMember {
  id: string;
  name: string;
  portraitUrl: string | null;
}

/**
 * Amostra da mesa para a landing de convite. É deliberadamente enxuta: pitch,
 * sistema, escala (nº de jogadores/NPCs) e o elenco. Nada de narrativas, mapas
 * ou itens — quem entra descobre isso dentro da mesa. Tudo serializável para
 * atravessar a fronteira server → client.
 */
export interface TablePreview {
  system: string | null;
  intro: string | null;
  players: number;
  npcs: number;
  party: TablePreviewMember[];
}

export interface JoinRequestsResponse {
  tableId: string;
  ownerId: string;
  canManage: boolean;
  requests: TableJoinRequest[];
}

/** Papel de alguém vinculado à mesa (espelha `TableMemberRole` do backend). */
export const TableMemberRole = {
  Owner: "owner",
  CoNarrator: "co_narrator",
  Player: "player",
} as const;

export type TableMemberRoleValue = (typeof TableMemberRole)[keyof typeof TableMemberRole];

/**
 * Uma pessoa vinculada à mesa, para o painel "Elenco da mesa". `isMuted` só
 * vale para jogadores; `character*` descreve a ficha do jogador na mesa.
 */
export interface TableMember {
  userId: string;
  username: string;
  email: string;
  type: number;
  role: TableMemberRoleValue;
  isMuted: boolean;
  characterId: string | null;
  characterName: string | null;
  characterActive: boolean;
}

export interface TableMembersResponse {
  tableId: string;
  ownerId: string;
  canManage: boolean;
  members: TableMember[];
}
