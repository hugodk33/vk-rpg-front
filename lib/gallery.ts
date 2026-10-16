import { api } from "@/lib/api";

/* ============================================================
   Persistência da galeria a partir do visualizador em modal.

   Os PUTs de entidade inteira não servem aqui: o de personagem grava
   `user_id`/`table_id` direto do corpo (um PATCH parcial desvincularia o
   personagem da mesa) e o de item apaga arma/armadura/ataques quando o
   `kind` vem ausente. Estes endpoints dedicados gravam só as linhas de
   imagem — o resto da ficha intocado.
   ============================================================ */

export interface CharacterImagePatch {
  images?: string[];
  portraitUrl?: string | null;
  bodyUrl?: string | null;
}

export function saveCharacterImages(characterId: string, patch: CharacterImagePatch): Promise<void> {
  return api<{ success?: boolean }>(`/game-table-character/${characterId}/images`, {
    method: "PUT",
    body: JSON.stringify(patch),
  }).then(() => undefined);
}

export function saveLocationImages(locationId: string, images: string[]): Promise<void> {
  return api<{ success?: boolean }>(`/table-location/${locationId}/images`, {
    method: "PUT",
    body: JSON.stringify({ images }),
  }).then(() => undefined);
}
