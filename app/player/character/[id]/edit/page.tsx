import { notFound, redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { CharacterViewer, TableSettings } from "@/lib/types";
import { getSeatedUserId, getTableOwnerUserId } from "@/lib/actor";
import { canEditSheet } from "@/lib/points";
import CharacterForm from "@/components/forms/CharacterForm";

export const dynamic = "force-dynamic";

/* Edição da ficha pelo jogador — mesma forma do narrador, em modo player.
   Só abre quando o assento é o dono do PC (ou o narrador em preview) E a
   ficha está editável: pontos a distribuir ou edit_enabled do mestre. */
export default async function PlayerEditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: CharacterViewer | undefined;
  try {
    data = await api<CharacterViewer>(`/game-table-character/${id}`);
  } catch {
    data = undefined;
  }
  if (!data) notFound();

  const requesterId = await getSeatedUserId();
  const characterOwnerId = data.character?.user?.id || data.character?.userId || null;
  const tableId = data.table?.id ?? "";
  const tableOwnerId = tableId ? await getTableOwnerUserId(tableId) : null;
  const mayView =
    !!requesterId &&
    !!characterOwnerId &&
    (requesterId === characterOwnerId || requesterId === tableOwnerId);
  if (!mayView) redirect("/player");

  if (!canEditSheet(data)) redirect(`/player/character/${id}`);

  const settings = tableId
    ? await api<TableSettings>(`/game-table-settings/${tableId}`).catch(() => null)
    : null;

  return <CharacterForm initial={data} settings={settings} player />;
}
