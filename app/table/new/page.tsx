import { api } from "@/lib/api";
import type { ContentCatalog, GameTable } from "@/lib/types";
import TableWizard from "@/components/table/TableWizard";

export const dynamic = "force-dynamic";

export default async function NewTablePage() {
  let tables: GameTable[] = [];
  let catalog: ContentCatalog | null = null;
  try {
    const [tablesRes, catalogRes] = await Promise.all([
      api<GameTable[]>("/game-tables").catch(() => [] as GameTable[]),
      api<ContentCatalog>("/content-modules").catch(() => null),
    ]);
    tables = tablesRes;
    catalog = catalogRes;
  } catch {
    tables = [];
    catalog = null;
  }

  const narratorOptions = Array.from(
    new Map(
      tables
        .filter((t) => t.narrator?.id)
        .map((t) => [t.narrator!.id, { id: t.narrator!.id, name: t.narrator!.username || t.narrator!.name }])
    ).values()
  );
  const defaultNarratorId = narratorOptions[0]?.id;

  return <TableWizard narratorOptions={narratorOptions} defaultNarratorId={defaultNarratorId} catalog={catalog} />;
}