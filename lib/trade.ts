import { api } from "./api";
import type {
  TradeItemInput,
  TradeOfferContext,
  TradeSide,
} from "./types";

/* ============================================================
   Troca entre jogadores — cliente HTTP.
   O backend não tem autenticação de verdade: o `actor` (o dono do
   personagem) viaja na query das leituras e no body das escritas.
   ============================================================ */

export type { TradeItemInput, TradeOfferContext, TradeSide };

function query(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => !!value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export interface CreateTradeOfferRequest {
  actorId: string;
  proposerCharacterId: string;
  recipientCharacterId: string;
  from: TradeItemInput[];
  to: TradeItemInput[];
  message?: string | null;
}

export interface EditTradeOfferRequest {
  actorId: string;
  offerId: string;
  characterId: string;
  side: TradeSide;
  items: TradeItemInput[];
}

export interface OfferActionRequest {
  actorId: string;
  offerId: string;
  characterId: string;
}

/** As ofertas em que o personagem participa (pendentes e encerradas). */
export async function listTradeOffers(
  actorId: string,
  characterId: string
): Promise<TradeOfferContext[]> {
  return api<TradeOfferContext[]>(
    `/game-table-trade/character/${encodeURIComponent(characterId)}${query({ actor: actorId })}`
  );
}

/** As ofertas em aberto da MESA — só o narrador da mesa vê. */
export async function listTableTradeOffers(
  actorId: string,
  tableId: string
): Promise<TradeOfferContext[]> {
  return api<TradeOfferContext[]>(
    `/game-table-trade/table/${encodeURIComponent(tableId)}${query({ actor: actorId })}`
  );
}

/** O jogador propõe a troca. */
export async function createTradeOffer(
  input: CreateTradeOfferRequest
): Promise<TradeOfferContext> {
  return api<TradeOfferContext>("/game-table-trade", {
    method: "POST",
    body: JSON.stringify({
      actor: input.actorId,
      proposer_character_id: input.proposerCharacterId,
      recipient_character_id: input.recipientCharacterId,
      from: input.from,
      to: input.to,
      message: input.message ?? null,
    }),
  });
}

/** Edita uma das mãos da oferta (o proponente edita as duas). */
export async function editTradeOffer(
  input: EditTradeOfferRequest
): Promise<TradeOfferContext> {
  return api<TradeOfferContext>(
    `/game-table-trade/offer/${encodeURIComponent(input.offerId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        actor: input.actorId,
        character_id: input.characterId,
        side: input.side,
        items: input.items,
      }),
    }
  );
}

/** Confirma o lado do ator; com as duas confirmações a troca fecha. */
export async function confirmTradeOffer(
  input: OfferActionRequest
): Promise<TradeOfferContext> {
  return api<TradeOfferContext>(
    `/game-table-trade/offer/${encodeURIComponent(input.offerId)}/confirm`,
    {
      method: "POST",
      body: JSON.stringify({
        actor: input.actorId,
        character_id: input.characterId,
      }),
    }
  );
}

/** O destinatário recusa a oferta. */
export async function rejectTradeOffer(
  input: OfferActionRequest
): Promise<TradeOfferContext> {
  return api<TradeOfferContext>(
    `/game-table-trade/offer/${encodeURIComponent(input.offerId)}/reject`,
    {
      method: "POST",
      body: JSON.stringify({
        actor: input.actorId,
        character_id: input.characterId,
      }),
    }
  );
}

/** O proponente (ou o narrador) retira a oferta. */
export async function cancelTradeOffer(
  input: OfferActionRequest
): Promise<TradeOfferContext> {
  return api<TradeOfferContext>(
    `/game-table-trade/offer/${encodeURIComponent(input.offerId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({
        actor: input.actorId,
        character_id: input.characterId,
      }),
    }
  );
}

/** Converte a seleção da UI (item_id -> quantidade) na lista da API. */
export function toItemInputs(selection: Record<string, number>): TradeItemInput[] {
  return Object.entries(selection)
    .filter(([, quantity]) => quantity > 0)
    .map(([item_id, quantity]) => ({ item_id, quantity }));
}
