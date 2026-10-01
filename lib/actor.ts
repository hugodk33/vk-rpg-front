import { cookies } from "next/headers";
import { api } from "@/lib/api";
import {
  ACTOR_COOKIE,
  AS_CHARACTER_COOKIE,
  SIDE_COOKIE,
  parseSide,
  type Side,
} from "@/lib/actorCookie";
import type { GameTable, GameTableCharacters, TableCharacter } from "@/lib/types";

/* ============================================================
   Who the server thinks you are.

   The backend derives the viewer from `?actor=<userId>`: the owner and
   approved guest narrators get the unfiltered catalog, a player gets only
   what their character knows. A Server Component can't read localStorage,
   so the browser mirrors its dev-only identity into cookies.

   Two separate pieces of state, both cookies:

     side  = "gm" | "player"  — which hat (see lib/side.ts)
     actor = <userId>          — whose user id the backend sees

   `side` is what stops the old bug where a saved player seat demoted you to
   player on every narrator route and bounced you to the player console.

   Still dev-only identity (no auth), but it keeps "who is asking" in ONE
   place so a screen can never quietly fetch the narrator catalog.
   ============================================================ */

export type { Side };

/** The seated user id from the actor cookie, or null when nobody is seated. */
export async function getSeatedUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTOR_COOKIE)?.value ?? null;
}

/** The table's narrator (owner) user id — the person allowed to see everything. */
export async function getTableOwnerUserId(tableId: string): Promise<string | null> {
  const table = await api<GameTable>(`/game-table/${tableId}`).catch(() => null);
  return table?.narrator?.userId ?? null;
}

/** Which hat the browser is wearing. Narrator unless it was set to player. */
export async function getSide(): Promise<Side> {
  const store = await cookies();
  return parseSide(store.get(SIDE_COOKIE)?.value);
}

/** The character the narrator is previewing, if any. */
export async function getPreviewCharacterId(): Promise<string | null> {
  const store = await cookies();
  return store.get(AS_CHARACTER_COOKIE)?.value ?? null;
}

async function findTableCharacter(tableId: string, characterId: string): Promise<TableCharacter | null> {
  const data = await api<GameTableCharacters>(`/game-table-characters/${tableId}`).catch(() => null);
  return (data?.characters ?? []).find((c) => c.id === characterId) ?? null;
}

/**
 * O endpoint de personagens da mesa devolve o dono aninhado em `user.id` e
 * não um `userId` no topo. Aceitamos as duas formas porque `lib/types.ts`
 * declara as duas e outros endpoints já achatam o campo.
 */
function characterUserId(character: TableCharacter | null): string | null {
  return character?.userId ?? character?.user?.id ?? null;
}

/**
 * Who the backend should see as us on this table's narrator-side reads.
 *
 * Narrator hat → the owner, unfiltered. Player hat → the chosen PC's owner,
 * so the backend filters by that PC's knowledge. We also pass `asCharacter`
 * along, which is what makes the narrator able to preview their OWN PC: the
 * user id alone would still earn the narrator's unfiltered view.
 */
export async function getActorParams(
  tableId: string
): Promise<{ actor: string | null; asCharacter?: string }> {
  const ownerId = await getTableOwnerUserId(tableId);
  if (!ownerId) return { actor: null };

  if ((await getSide()) === "gm") return { actor: ownerId };

  const preview = await getPreviewCharacterId();
  if (!preview) return { actor: ownerId };
  const character = await findTableCharacter(tableId, preview);
  const actorUserId = characterUserId(character);
  if (!actorUserId) return { actor: ownerId };
  return { actor: actorUserId, asCharacter: preview };
}

/**
 * `?actor=...&asCharacter=...` for a narrator-side read of this table.
 *
 * The character to jump to when a player is on the player hat, so narrator
 * routes can hand them over to the player console. Null when the narrator
 * hat is on and nothing should redirect.
 */
export async function getNarratorSideView(
  tableId: string
): Promise<{ query: string; actor: string | null; playerCharacterId: string | null }> {
  const [params, side, preview] = await Promise.all([
    getActorParams(tableId),
    getSide(),
    getPreviewCharacterId(),
  ]);

  const query = params.actor
    ? `?actor=${encodeURIComponent(params.actor)}${
        params.asCharacter ? `&asCharacter=${encodeURIComponent(params.asCharacter)}` : ""
      }`
    : "";

  const playerCharacterId = side === "player" ? preview : null;
  return { query, actor: params.actor, playerCharacterId };
}

/**
 * Which table a location belongs to, so the narrator side can be resolved
 * before reading the location itself. Returns null for unknown locations.
 */
export async function getLocationTableId(locationId: string): Promise<string | null> {
  const res = await api<{ tableId?: string }>(`/table-location/${locationId}/table`).catch(
    () => null as { tableId?: string } | null
  );
  return res?.tableId ?? null;
}
