"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RowActions({
  editHref,
  onDelete,
  deleteLabel = "Excluir",
}: {
  editHref: string;
  onDelete: () => Promise<unknown>;
  deleteLabel?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!window.confirm("Excluir? Esta ação não pode ser desfeita.")) return;
    setBusy(true);
    try {
      await onDelete();
      router.refresh();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Falha ao excluir.");
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      <Link
        href={editHref}
        onClick={(e) => e.stopPropagation()}
        className="text-[11px] text-zinc-400 hover:text-amber-300 px-2 py-1 rounded border border-zinc-700/60 hover:border-amber-500/50 transition-colors"
      >
        Editar
      </Link>
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-[11px] text-red-400/90 hover:text-red-300 px-2 py-1 rounded border border-zinc-700/60 hover:border-red-500/50 transition-colors disabled:opacity-50"
      >
        {busy ? "..." : deleteLabel}
      </button>
    </span>
  );
}