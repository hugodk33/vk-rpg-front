import { redirect } from "next/navigation";
import { loadPlayerConsole } from "@/lib/player";
import PlayerConsole, { type PlayerTab } from "@/components/player/PlayerConsole";

export const dynamic = "force-dynamic";

const PLAYER_TABS = new Set<string>([
  "turn", "journey", "chronicle", "map", "characters", "items", "skills", "advantages", "disadvantages", "locations", "gear", "sheet",
]);

export default async function PlayerCharacterViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const data = await loadPlayerConsole(id);

  if (!data.character) {
    redirect("/player");
  }
  const basePath = `/player/character/${id}`;

  return (
    <PlayerConsole
      {...data}
      basePath={basePath}
      initialTab={tab && PLAYER_TABS.has(tab) ? (tab as PlayerTab) : "sheet"}
    />
  );
}
