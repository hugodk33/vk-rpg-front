import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { CharacterViewer } from "@/lib/types";
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

  return <CharacterForm initial={data} />;
}
