import { api } from "./api";
import type { LocationShop } from "./types";

/* ============================================================
   Lojas por local — cliente HTTP.
   Uma loja é um local (table_locations) com `shop_name`; a
   prateleira é o item do catálogo ligado ao local. O backend não
   tem autenticação de verdade: quem chega no endpoint é o narrador.
   ============================================================ */

export interface ShopEntryRequest {
  /** O item do catálogo que entra na prateleira. */
  item_id: string;
  /** Preço praticado na loja (null/undefined = vale o custo do item). */
  price?: number | null;
  /** Quantidade em estoque (-1 = ilimitado, 0 = esgotado). */
  stock?: number | null;
  notes?: string | null;
}

/** O estoque da loja de um local. */
export async function findLocationShop(locationId: string): Promise<LocationShop> {
  return api<LocationShop>(`/game-table-shop/${encodeURIComponent(locationId)}`);
}

/**
 * ENTRADA DE ITEM: a peça do catálogo passa a morar na prateleira da
 * loja (o item continua no catálogo).
 */
export async function stockLocationShopItem(
  locationId: string,
  input: ShopEntryRequest
): Promise<LocationShop> {
  return api<LocationShop>(
    `/game-table-shop/${encodeURIComponent(locationId)}/items`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

/**
 * CÓPIA DE ITEM EXISTENTE: duplica a peça do catálogo para dentro da
 * loja. O original continua no catálogo; a cópia é a peça que a loja
 * vende.
 */
export async function copyItemIntoLocationShop(
  locationId: string,
  input: ShopEntryRequest
): Promise<LocationShop> {
  return api<LocationShop>(
    `/game-table-shop/${encodeURIComponent(locationId)}/items/copy`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

/** Preço, estoque e observações de uma prateleira. */
export async function editLocationShopItem(
  locationId: string,
  itemId: string,
  input: Omit<ShopEntryRequest, "item_id">
): Promise<LocationShop> {
  return api<LocationShop>(
    `/game-table-shop/${encodeURIComponent(locationId)}/items/${encodeURIComponent(itemId)}`,
    { method: "PUT", body: JSON.stringify(input) }
  );
}

/** Tira a peça da prateleira (o item volta para o catálogo solto). */
export async function removeLocationShopItem(
  locationId: string,
  itemId: string
): Promise<LocationShop> {
  return api<LocationShop>(
    `/game-table-shop/${encodeURIComponent(locationId)}/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" }
  );
}
