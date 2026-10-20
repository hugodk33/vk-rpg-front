import { api } from "@/lib/api";
import type { TableSettings } from "@/lib/types";
import CharacterForm from "@/components/forms/CharacterForm";

export const dynamic = "force-dynamic";

/* Primeira ficha do jogador: o mesmo CharacterForm do narrador em modo
   player — mesa fixa, sempre PC, moedas iniciais e orçamento da mesa. */
export default async function PlayerFirstSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [settings, table] = await Promise.all([
    api<TableSettings>(`/game-table-settings/${id}`).catch(() => null),
    api<{ id?: string; title?: string }>(`/game-table/${id}`).catch(() => null),
  ]);

  return <CharacterForm tableId={id} tableTitle={table?.title} settings={settings} player />;
}
