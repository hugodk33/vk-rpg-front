import { api } from "@/lib/api";
import type { GameTableItems, TableSettings } from "@/lib/types";
import TableTabs from "@/components/TableTabs";
import TableSettingsPanel from "@/components/settings/TableSettingsPanel";

export const dynamic = "force-dynamic";

export default async function TableSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [settings, items] = await Promise.all([
    api<TableSettings>(`/game-table-settings/${id}`).catch(() => null),
    api<GameTableItems>(`/game-table-items/${id}`).catch(() => ({
      table: null,
      items: [],
    })),
  ]);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <TableTabs tableId={id} role="narrator" active="settings" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          House rules for this table only — how turns close, how items and
          reactions are resolved, and whether a starting shop is in play.
        </p>
      </div>

      <TableSettingsPanel tableId={id} initialSettings={settings} items={items?.items ?? []} />
    </div>
  );
}