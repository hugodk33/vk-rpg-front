import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { CharacterViewer, TableSettings } from "@/lib/types";
import CharacterForm from "@/components/forms/CharacterForm";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: CharacterViewer | undefined;
  try {
    data = await api<CharacterViewer>(`/game-table-character/${id}`);
  } catch {
    data = undefined;
  }
  if (!data) notFound();

  const tableId = data.table?.id;
  const settings = tableId
    ? await api<TableSettings>(`/game-table-settings/${tableId}`).catch(() => null)
    : null;

  return <CharacterForm initial={data} settings={settings} />;
}
