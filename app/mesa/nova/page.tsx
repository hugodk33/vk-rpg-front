import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import TableForm from "@/components/forms/TableForm";

export const dynamic = "force-dynamic";

export default async function NewTablePage() {
  let tables: GameTable[] = [];
  try {
    tables = await api<GameTable[]>("/game-tables");
  } catch {
    tables = [];
  }

  const narratorOptions = Array.from(
    new Map(
      tables
        .filter((t) => t.narrator?.id)
        .map((t) => [t.narrator!.id, { id: t.narrator!.id, name: t.narrator!.username || t.narrator!.name }])
    ).values()
  );
  const defaultNarratorId = narratorOptions[0]?.id;

  return (
    <TableForm
      narratorOptions={narratorOptions}
      defaultNarratorId={defaultNarratorId}
    />
  );
}
