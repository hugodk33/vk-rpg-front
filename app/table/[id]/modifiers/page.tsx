import { api } from "@/lib/api";
import { getLang, makeT } from "@/lib/i18n-server";
import { getNarratorSideView } from "@/lib/actor";
import type {
  GameTableCharacters,
  GameTableLocations,
  GameTableModifiers,
  GameTableScenes,
} from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import ModifiersPanel from "@/components/modifiers/ModifiersPanel";

export const dynamic = "force-dynamic";

export default async function TableModifiersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const t = makeT(await getLang());
  const initialTab = tab === "new" ? ("form" as const) : ("list" as const);




  const { query: actorQs } = await getNarratorSideView(id);

  const [mods, chars, scenes, locations] = await Promise.all([
    api<GameTableModifiers>(`/game-table-modifiers/${id}`).catch(() => ({
      table: null,
      modifiers: [],
    })),
    api<GameTableCharacters>(`/game-table-characters/${id}`).catch(() => ({
      table: null,
      characters: [],
    })),
    api<GameTableScenes>(`/game-table-scenes/${id}`).catch(() => ({
      table: null,
      scenes: [],
    })),
    api<GameTableLocations>(`/game-table-locations/${id}${actorQs}`).catch(() => ({
      table: null,
      locations: [],
    })),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" active="modifiers" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.modifiers")}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t("tp.modifiers.subtitle")}</p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 mb-6 text-xs text-zinc-400 space-y-1.5">
        <p>
          <span className="font-mono uppercase tracking-widest text-green-500/80 text-[10px]">{t("tp.modifiers.fatigueRule")}</span>
        </p>
        <p>
          {t("tp.mod.f.barOf")} <span className="text-zinc-200">FP</span> {t("tp.mod.f.tracks")}{" "}
          <span className="text-zinc-200">{t("tp.mod.f.fatigue")}</span>: {t("tp.mod.f.starts")}{" "}
          <span className="text-zinc-200">0</span> ({t("tp.mod.f.rested")}) {t("tp.mod.f.fills")}{" "}
          <span className="text-zinc-200">HT</span>. {t("tp.mod.f.lessThan")}{" "}
          <span className="text-amber-300">{t("tp.mod.f.thirdMax")}</span>{" "}
          {t("tp.mod.f.leftCharIs")} <span className="text-amber-300">{t("tp.mod.f.tired")}</span>{" "}
          {t("tp.mod.f.half")} <span className="text-rose-300">{t("tp.mod.f.exhausted")}</span>
          {t("tp.mod.f.extra")}
        </p>
      </div>

<ModifiersPanel
        tableId={id}
        initialModifiers={mods?.modifiers ?? []}
        characters={chars?.characters ?? []}
        scenes={scenes ?? null}
        locations={locations?.locations ?? []}
        initialTab={initialTab}
      />
    </div>
  );
}