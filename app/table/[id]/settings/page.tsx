import { api } from "@/lib/api";
import { getLang, makeT } from "@/lib/i18n-server";
import type { GameTable, GameTableItems, TableSettings } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import TableSettingsPanel from "@/components/settings/TableSettingsPanel";
import GuestNarratorsPanel from "@/components/settings/GuestNarratorsPanel";

export const dynamic = "force-dynamic";

export default async function TableSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = makeT(await getLang());

  const [settings, items, table] = await Promise.all([
    api<TableSettings>(`/game-table-settings/${id}`).catch(() => null),
    api<GameTableItems>(`/game-table-items/${id}`).catch(() => ({
      table: null,
      items: [],
    })),
    api<GameTable>(`/game-table/${id}`).catch(() => null),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" active="settings" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.settings")}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t("tp.settings.subtitle")}</p>
      </div>

      <TableSettingsPanel tableId={id} initialSettings={settings} items={items?.items ?? []} />

      {table?.narrator?.userId ? (
        <div className="mt-4">
          <GuestNarratorsPanel tableId={id} actorId={table.narrator.userId} />
        </div>
      ) : null}
    </div>
  );
}