import { redirect } from "next/navigation";
import { loadPlayerConsole } from "@/lib/player";
import PlayerConsole from "@/components/player/PlayerConsole";

export const dynamic = "force-dynamic";

export default async function PlayerCharacterSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadPlayerConsole(id);

if (!data.character || !data.mayView) {
      redirect("/player");
    }
  const basePath = `/player/character/${id}`;

  return (
    <PlayerConsole
      {...data}
      basePath={basePath}
      initialTab="turn"
    />
  );
}
