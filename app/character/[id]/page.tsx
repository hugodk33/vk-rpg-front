import Link from "next/link";
import { api } from "@/lib/api";
import type { CharacterViewer } from "@/lib/types";
import CharacterTabs, { type SheetTab } from "@/components/character/CharacterTabs";
import CharacterSheet from "@/components/character/CharacterSheet";
import GearPanel from "@/components/character/GearPanel";
import CharacterJourneyView from "@/components/character/CharacterJourneyView";

export const dynamic = "force-dynamic";

export default async function CharacterViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ moment?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { moment, tab } = await searchParams;
  const qs = moment ? `?moment=${moment}` : "";
  const data = await api<CharacterViewer>(`/game-table-character/${id}${qs}`);
  const basePath = `/character/${id}`;
  const tableId = data.table?.id;

  const activeTab: SheetTab =
    tab === "inventory" || tab === "journey" ? tab : "sheet";
  const momentNum = moment ? Number(moment) : null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          &larr; Back to table
        </Link>
      ) : null}
      <CharacterTabs basePath={basePath} active={activeTab} moment={momentNum} />
      {activeTab === "inventory" ? (
        <GearPanel data={data} historic={!!moment} />
      ) : activeTab === "journey" ? (
        <CharacterJourneyView
          characterId={data.character.id}
          basePath={basePath}
          moments={data.moments ?? []}
          selectedMoment={data.selected_moment ?? null}
          tab={activeTab}
        />
      ) : (
        <CharacterSheet data={data} basePath={basePath} />
      )}
    </div>
  );
}
