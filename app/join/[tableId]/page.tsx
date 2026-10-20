import { api } from "@/lib/api";
import type { GameTable, TableCharacter } from "@/lib/types";
import { isJoinRole, type JoinRoleValue, type TablePreview } from "@/lib/joinTypes";
import JoinLanding from "@/components/join/JoinLanding";

export const dynamic = "force-dynamic";

/* ============================================================
   Landing page de convite por mesa (/join/[tableId]).

   O link diz a mesa, o papel e (opcionalmente) o convidado. Quem
   abre escolhe a identidade e envia o pedido; o narrador dono
   aprova no painel de configurações da mesa.
   ============================================================ */

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ role?: string; user?: string }>;
}) {
  const { tableId } = await params;
  const sp = await searchParams;

  const [table, characters, npcs] = await Promise.all([
    api<GameTable>(`/game-table/${tableId}`).catch(() => null),
    api<{ characters: TableCharacter[] }>(`/game-table-characters/${tableId}`).catch(() => null),
    api<{ npcs: unknown[] }>(`/game-table-npcs/${tableId}`).catch(() => null),
  ]);
  const role: JoinRoleValue | null = isJoinRole(sp.role) ? sp.role : null;

  /* Amostra pública da mesa. Só o elenco (personagens de jogador), a escala e o
     pitch — o resto fica para quando a pessoa entrar. Ausente = painel oculto. */
  const party = (characters?.characters ?? [])
    .filter((c) => c.isNpc !== true)
    .slice(0, 6)
    .map((c) => ({ id: c.id, name: c.name ?? "", portraitUrl: c.portraitUrl ?? null }));

  const preview: TablePreview | null = table?.id
    ? {
        system: table.system?.trim() || null,
        intro: table.intro?.trim() || null,
        players: table.players?.length ?? 0,
        npcs: npcs?.npcs?.length ?? 0,
        party,
      }
    : null;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <JoinLanding
        tableId={tableId}
        tableTitle={table?.title ?? null}
        ownerName={table?.narrator?.name || table?.narrator?.username || null}
        initialRole={role}
        initialUserId={sp.user ?? null}
        tableExists={Boolean(table?.id)}
        preview={preview}
      />
    </div>
  );
}
