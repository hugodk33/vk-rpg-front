import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { SkillItem } from "@/lib/types";
import SkillForm from "@/components/forms/SkillForm";

export const dynamic = "force-dynamic";

export default async function EditSkillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ table_id?: string }>;
}) {
  const { id } = await params;
  const { table_id } = await searchParams;

  if (!table_id) notFound();

  let skill: SkillItem | undefined;
  try {
    skill = await api<SkillItem>(`/game-table-skill/${id}`);
  } catch {
    skill = undefined;
  }
  if (!skill) notFound();

  return <SkillForm tableId={table_id} initial={skill} />;
}