import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { SkillItem } from "@/lib/types";
import SkillExhibit from "@/components/skill/SkillExhibit";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let skill: SkillItem | undefined;
  try {
    skill = await api<SkillItem>(`/game-table-skill/${id}`);
  } catch {
    skill = undefined;
  }
  if (!skill) notFound();

  const tableId = skill.table_id;

  return <SkillExhibit skill={skill} tableId={tableId} />;
}
