"use client";

/* ============================================================
   Join — entrada numa mesa com pré-aprovação.

   A landing page /join/[tableId] se identifica por URL e guarda a
   identidade escolhida num namespace PRÓPRIO (vkrpg.join.<tableId>),
   sem tocar em vkrpg.seat / vkrpg.side. Assim visitar um convite não
   senta ninguém em assento nenhum nem troca a perspectiva.
   ============================================================ */

import { api } from "@/lib/api";
import {
  JoinRole,
  type JoinRoleValue,
  type JoinRequestsResponse,
  type JoinStatusResponse,
  type TableJoinCandidate,
  type TableJoinRequest,
  type TableMembersResponse,
} from "@/lib/joinTypes";

export interface JoinIdentity {
  userId?: string;
  role?: JoinRoleValue;
}

const keyFor = (tableId: string) => `vkrpg.join.${tableId}`;

export function readJoinIdentity(tableId: string): JoinIdentity {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(keyFor(tableId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as JoinIdentity;
    return {
      userId: parsed?.userId || undefined,
      role:
        parsed?.role === JoinRole.Player || parsed?.role === JoinRole.CoNarrator
          ? parsed.role
          : undefined,
    };
  } catch {
    return {};
  }
}

export function writeJoinIdentity(tableId: string, identity: JoinIdentity): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(keyFor(tableId), JSON.stringify(identity));
  } catch {
    /* armazenamento indisponível — a identidade fica efêmera */
  }
}

export function clearJoinIdentity(tableId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(keyFor(tableId));
  } catch {
    /* nada a limpar */
  }
}

/** Cria/reabre a solicitação pendente do usuário. */
export function submitJoinRequest(
  tableId: string,
  input: { userId: string; role: JoinRoleValue; message?: string | null }
): Promise<TableJoinRequest> {
  return api<TableJoinRequest>(`/game-table/${encodeURIComponent(tableId)}/join`, {
    method: "POST",
    body: JSON.stringify({
      user_id: input.userId,
      role: input.role,
      message: input.message ?? null,
    }),
  });
}

export function getJoinStatus(tableId: string, userId?: string): Promise<JoinStatusResponse> {
  const query = userId ? `?user=${encodeURIComponent(userId)}&actor=${encodeURIComponent(userId)}` : "";
  return api<JoinStatusResponse>(`/game-table/${encodeURIComponent(tableId)}/join${query}`);
}

export function fetchJoinCandidates(
  tableId: string,
  role: JoinRoleValue
): Promise<TableJoinCandidate[]> {
  return api<TableJoinCandidate[]>(
    `/game-table/${encodeURIComponent(tableId)}/join/candidates?role=${encodeURIComponent(role)}`
  );
}

export function cancelJoinRequest(tableId: string, userId: string): Promise<{ removed: boolean }> {
  return api<{ removed: boolean }>(
    `/game-table/${encodeURIComponent(tableId)}/join/${encodeURIComponent(userId)}`,
    { method: "DELETE" }
  );
}

export function fetchJoinRequests(tableId: string, actorId: string): Promise<JoinRequestsResponse> {
  return api<JoinRequestsResponse>(
    `/game-table/${encodeURIComponent(tableId)}/join-requests?actor=${encodeURIComponent(actorId)}`
  );
}

export function resolveJoinRequest(
  tableId: string,
  userId: string,
  actorId: string,
  action: "approve" | "reject"
): Promise<TableJoinRequest | null> {
  return api<TableJoinRequest | null>(
    `/game-table/${encodeURIComponent(tableId)}/join-requests/${encodeURIComponent(userId)}`,
    {
      method: "POST",
      body: JSON.stringify({ actor: actorId, action }),
    }
  );
}

/* ============================================================
   Elenco da mesa — gestão pelo dono e saída do jogador
   ============================================================ */

export function fetchTableMembers(
  tableId: string,
  actorId: string
): Promise<TableMembersResponse> {
  return api<TableMembersResponse>(
    `/game-table/${encodeURIComponent(tableId)}/members?actor=${encodeURIComponent(actorId)}`
  );
}

export function setMemberMuted(
  tableId: string,
  userId: string,
  actorId: string,
  muted: boolean
): Promise<{ muted: boolean }> {
  return api<{ muted: boolean }>(
    `/game-table/${encodeURIComponent(tableId)}/members/${encodeURIComponent(userId)}/mute`,
    { method: "PUT", body: JSON.stringify({ actor: actorId, muted }) }
  );
}

export function removeTableMember(
  tableId: string,
  userId: string,
  actorId: string
): Promise<{ removed: boolean }> {
  return api<{ removed: boolean }>(
    `/game-table/${encodeURIComponent(tableId)}/members/${encodeURIComponent(userId)}?actor=${encodeURIComponent(actorId)}`,
    { method: "DELETE" }
  );
}

/** O próprio jogador sai da mesa (auto-remoção, desativa a ficha). */
export function leaveTable(tableId: string, userId: string): Promise<{ left: boolean }> {
  return api<{ left: boolean }>(`/game-table/${encodeURIComponent(tableId)}/leave`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}
