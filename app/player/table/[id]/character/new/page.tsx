import { api } from "@/lib/api";
import type { TableSettings } from "@/lib/types";
import PlayerFirstSheet from "@/components/player/PlayerFirstSheet";

export const dynamic = "force-dynamic";

interface UserRow {
  id: string;
  username?: string;
  email?: string;
  type?: number;
}

export default async function PlayerFirstSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [settings, users, table] = await Promise.all([
    api<TableSettings>(`/game-table-settings/${id}`).catch(() => null),
    api<UserRow[]>(`/users`).catch(() => [] as UserRow[]),
    api<{ id?: string; title?: string }>(`/game-table/${id}`).catch(() => null),
  ]);

  return (
    <PlayerFirstSheet
      tableId={id}
      tableTitle={table?.title}
      initialSettings={settings}
      users={Array.isArray(users) ? users : []}
    />
  );
}