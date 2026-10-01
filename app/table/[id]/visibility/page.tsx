import { api } from "@/lib/api";
import { getLang, makeT } from "@/lib/i18n-server";
import { getNarratorSideView } from "@/lib/actor";
import type {
  GameTableAdvantages,
  GameTableCharacters,
  GameTableDisadvantages,
  GameTableItems,
  GameTableScenes,
  GameTableSkills,
  GameTableLocations,
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
  const t = makeT(await getLang());


  const { query: actorQs } = await getNarratorSideView(id);
  const [chars, items, skills, advantages, disadvantages, locations, scenes] =
    await Promise.all([
      api<GameTableCharacters>(`/game-table-characters/${id}`),
      api<GameTableItems>(`/game-table-items/${id}`),
      api<GameTableSkills>(`/game-table-skills/${id}`),
      api<GameTableAdvantages>(`/game-table-advantages/${id}`),
      api<GameTableDisadvantages>(`/game-table-disadvantages/${id}`),
      api<GameTableLocations>(`/game-table-locations/${id}${actorQs}`),
      api<GameTableScenes>(`/game-table-scenes/${id}`),
    ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" active="visibility" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.visibility")}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t("tp.visibility.subtitle")}</p>
      </div>

      <VisibilityPanel
        characters={chars?.characters ?? []}
        items={items?.items ?? []}
        locations={locations?.locations ?? []}
        skills={skills?.skills ?? []}
        advantages={advantages?.advantages ?? []}
        disadvantages={disadvantages?.disadvantages ?? []}
        scenes={scenes ?? null}
      />
    </div>
  );
}