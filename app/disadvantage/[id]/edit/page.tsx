import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Disadvantage, GameTableDisadvantages } from "@/lib/types";
import DisadvantageForm from "@/components/forms/DisadvantageForm";

export const dynamic = "force-dynamic";

export default async function EditDisadvantagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table_id?: string }>;
}) {
  const { id } = await params;
  const { table_id } = await searchParams;

  if (!table_id) notFound();

  let disadvantage: Disadvantage | undefined;
  try {
    const data = await api<GameTableDisadvantages>(`/game-table-disadvantages/${table_id}`);
    disadvantage = (data.disadvantages ?? []).find((d) => d.id === id);
  } catch {
    disadvantage = undefined;
  }
  if (!disadvantage) notFound();

  return <DisadvantageForm tableId={table_id} initial={disadvantage} />;
}
