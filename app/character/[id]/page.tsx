import Link from "next/link";
import { api } from "@/lib/api";
import type { CharacterViewer } from "@/lib/types";
import CharacterTabs, { type SheetTab } from "@/components/character/CharacterTabs";
import CharacterSheet from "@/components/character/CharacterSheet";
import GearPanel from "@/components/character/GearPanel";
import CharacterJourneyView from "@/components/character/CharacterJourneyView";
import CharacterVisibilityDrawer from "@/components/visibility/CharacterVisibilityDrawer";
import { getLang, makeT } from "@/lib/i18n-server";

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
  const t = makeT(await getLang());
  const qs = moment ? `?moment=${moment}` : "";
  const data = await api<CharacterViewer>(`/game-table-character/${id}${qs}`);
  const basePath = `/character/${id}`;
  const tableId = data.table?.id;

  const activeTab: SheetTab =
    tab === "inventory" || tab === "journey" ? tab : "sheet";
  const momentNum = moment ? Number(moment) : null;

  return (
    <div className="max-w-5xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          {t("itm.back")}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-green-300/90">{t("pg.ch.eyebrow")}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 mt-1">
            {data.character.sheet?.name || data.character.name || t("nav.character")}
          </h1>
          {data.table?.title ? (
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">{data.table.title}</p>
          ) : null}
        </div>
        {data.character.user?.username ? (
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 border border-zinc-700/50 rounded-md px-2 py-1">
            {data.character.user.username}
          </span>
        ) : null}
      </div>

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
        <>
          <CharacterSheet data={data} basePath={basePath} showName={false} />
          <CharacterVisibilityDrawer tableId={tableId} targetId={data.character.id} />
        </>
      )}
    </div>
  );
}
