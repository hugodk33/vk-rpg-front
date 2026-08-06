import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { GameTable } from "@/lib/types";
import TableForm from "@/components/forms/TableForm";

export const dynamic = "force-dynamic";

export default async function EditTablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let table: GameTable | undefined;
  try {
    const tables = await api<GameTable[]>("/game-tables");
    table = tables.find((t) => t.id === id);
  } catch {
    table = undefined;
  }

  if (!table) notFound();

  return (
    <TableForm
      initial={{
        id: table.id,
        title: table.title,
        system: table.system ?? "",
        intro: table.intro ?? "",
      }}
      narratorOptions={[]}
    />
  );
}
