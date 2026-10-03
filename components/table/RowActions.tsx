"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import CopyToTableButton from "./CopyToTableButton";

export default function RowActions({
  editHref,
  onDelete,
  deleteLabel = "ra.delete",
  copyHref,
  tableId,
}: {
  editHref: string;
  onDelete: () => Promise<unknown>;
  deleteLabel?: string;
  copyHref?: string;
  tableId?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!window.confirm(t("ra.confirm"))) return;
    setBusy(true);
    try {
      await onDelete();
      router.refresh();
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : t("ra.fail"));
      setBusy(false);
    }
  }

  /* `relative z-10`: o titulo da linha e um <Link> "esticado"
     (after:inset-0) que cobre o card inteiro, entao os botoes precisam
     ficar por cima dele ou nao recebem o clique. */
  return (
    <span className="relative z-10 flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      <Link
        href={editHref}
        onClick={(e) => e.stopPropagation()}
        className="text-[11px] text-zinc-400 hover:text-amber-300 px-2 py-1 rounded border border-zinc-700/60 hover:border-amber-500/50 transition-colors"
      >
        {t("ra.edit")}
      </Link>
      {copyHref ? <CopyToTableButton copyHref={copyHref} tableId={tableId} /> : null}
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-[11px] text-red-400/90 hover:text-red-300 px-2 py-1 rounded border border-zinc-700/60 hover:border-red-500/50 transition-colors disabled:opacity-50"
      >
        {busy ? "..." : t(deleteLabel)}
      </button>
    </span>
  );
}