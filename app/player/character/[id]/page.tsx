import { loadPlayerConsole } from "@/lib/player";
import PlayerConsole from "@/components/player/PlayerConsole";

export const dynamic = "force-dynamic";

const PLAYER_TABS = new Set(["turn", "journey", "chronicle", "table", "sheet"]);

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
  const basePath = `/player/character/${id}`;

  return (
    <PlayerConsole
      {...data}
      basePath={basePath}
      initialTab={tab && PLAYER_TABS.has(tab) ? (tab as "turn" | "journey" | "chronicle" | "table" | "sheet") : "sheet"}
    />
  );
}
