import { api } from "@/lib/api";
import type {
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableSkills,
} from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import VisibilityPanel from "@/components/visibility/VisibilityPanel";

export const dynamic = "force-dynamic";

export default async function TableVisibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [chars, items, skills, advantages, disadvantages] = await Promise.all([
    api<GameTableCharacters>(`/game-table-characters/${id}`),
    api<GameTableItems>(`/game-table-items/${id}`),
    api<GameTableSkills>(`/game-table-skills/${id}`),
    api<GameTableAdvantages>(`/game-table-advantages/${id}`),
    api<GameTableDisadvantages>(`/game-table-disadvantages/${id}`),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" active="visibility" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Visibility</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Decide how much each observer character gets to see of the others.
          You see everything; players see only what the rules below allow.
        </p>
      </div>

      <VisibilityPanel
        characters={chars?.characters ?? []}
        items={items?.items ?? []}
        skills={skills?.skills ?? []}
        advantages={advantages?.advantages ?? []}
        disadvantages={disadvantages?.disadvantages ?? []}
      />
    </div>
  );
}