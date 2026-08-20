import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Advantage, GameTableAdvantages } from "@/lib/types";
import AdvantageForm from "@/components/forms/AdvantageForm";

export const dynamic = "force-dynamic";

export default async function EditAdvantagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table_id?: string }>;
}) {
  const { id } = await params;
  const { table_id } = await searchParams;

  if (!table_id) notFound();

  let advantage: Advantage | undefined;
  try {
    const data = await api<GameTableAdvantages>(`/game-table-advantages/${table_id}`);
    advantage = (data.advantages ?? []).find((a) => a.id === id);
  } catch {
    advantage = undefined;
  }
  if (!advantage) notFound();

  return <AdvantageForm tableId={table_id} initial={advantage} />;
}
