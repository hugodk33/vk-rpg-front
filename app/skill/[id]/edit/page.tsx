import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { GameTableSkills } from "@/lib/types";
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

  /* O detalhe (`/game-table-skill/:id`) devolve a skill solta, sem a mesa.
     Buscamos a lista da mesa porque ela traz `table.title`, usado no
     breadcrumb do shell. */
  let skill = undefined;
  let tableTitle: string | undefined;
  try {
    const data = await api<GameTableSkills>(`/game-table-skills/${table_id}`);
    skill = (data.skills ?? []).find((s) => s.id === id);
    tableTitle = data.table?.title;
  } catch {
    skill = undefined;
  }
  if (!skill) notFound();

  return <SkillForm tableId={table_id} tableTitle={tableTitle} initial={skill} />;
}