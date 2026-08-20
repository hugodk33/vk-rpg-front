import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { NpcViewer } from "@/lib/types";
import NpcForm from "@/components/forms/NpcForm";

export const dynamic = "force-dynamic";

export default async function EditNpcPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data: NpcViewer | undefined;
  try {
    data = await api<NpcViewer>(`/game-table-npc/${id}`);
  } catch {
    data = undefined;
  }
  if (!data) notFound();

  return <NpcForm initial={data} />;
}
