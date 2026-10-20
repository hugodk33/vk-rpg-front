"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";

/* O mestre libera/bloqueia a edição da ficha de um PC. Enquanto liberado,
   o jogador pode abrir o form em modo player (mesmo sem pontos a gastar). */
export default function EditFlagToggle({ characterId, enabled }: { characterId: string; enabled: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await api<{ success?: boolean }>("/game-table-character", {
        method: "PUT",
        body: JSON.stringify({ id: characterId, edit_enabled: !enabled }),
      });
      router.refresh();
    } catch {
      /* estado fica como está */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={enabled}
      title={enabled ? t("tp.characters.lockEdit") : t("tp.characters.releaseEdit")}
      className={`relative z-10 inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
        enabled
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          : "border-zinc-600/50 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500/60"
      }`}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {enabled ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        )}
      </svg>
      {enabled ? t("tp.characters.lockEdit") : t("tp.characters.releaseEdit")}
    </button>
  );
}
