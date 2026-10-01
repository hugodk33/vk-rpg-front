/**
 * Cookie names for the dev-only identity.
 *
 * These live in their own module with NO "use client" on purpose. A Server
 * Component importing a client module gets client-reference proxies for its
 * exports instead of the real values, so a name would come back `undefined`
 * on the server and every `cookies().get(...)` would miss.
 */
export const ACTOR_COOKIE = "vkrpg.actor";
export const SIDE_COOKIE = "vkrpg.side";
export const AS_CHARACTER_COOKIE = "vkrpg.asCharacter";

/** Which hat the browser is wearing: the narrator's, or a player's. */
export type Side = "gm" | "player";

/**
 * Narrator is the default on purpose. Inferring the side from the seat meant
 * that anyone who had ever opened the player console got silently demoted to
 * player and got bounced off the narrator routes.
 */
export const DEFAULT_SIDE: Side = "gm";

export function parseSide(raw: string | undefined | null): Side {
  return raw === "player" ? "player" : DEFAULT_SIDE;
}
