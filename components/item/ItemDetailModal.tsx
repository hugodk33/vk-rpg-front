"use client";

/* ============================================================
   ItemDetailModal — abre o item individual (ItemExhibit) num
   diálogo sobre o inventário do personagem.

   O inventário já lista os itens da mochila; abrir a página cheia
   tirava o leitor do contexto da ficha. Aqui o mesmo Exhibit é
   buscado sob demanda e mostrado num modal, com um atalho para a
   página completa em /item/:id. Overlay fixo + trava de scroll do
   body, como o ModifiersModal.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Item } from "@/lib/types";
import { useTranslation } from "@/lib/i18n";
import ItemExhibit from "@/components/item/ItemExhibit";

export default function ItemDetailModal({
  itemId,
  onClose,
}: {
  itemId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [item, setItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api<Item>(`/game-table-item/${itemId}`);
        if (active) setItem(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : t("cs.gear.errLoad"));
      }
    })();
    return () => {
      active = false;
    };
  }, [itemId, t]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    /* O Exhibit rola; a página atrás não. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/80 p-4 sm:p-8">
      <button
        type="button"
        aria-label={t("mdl.close")}
        onClick={close}
        className="fixed inset-0 -z-10 cursor-default focus:outline-none"
        tabIndex={-1}
      />

      <div role="dialog" aria-modal="true" aria-label={item?.name ?? t("cs.gear.view")} className="relative w-full max-w-5xl">
        <div className="flex items-center justify-between gap-3 pb-3">
          <Link
            href={`/item/${itemId}`}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-amber-400"
          >
            {t("cs.gear.fullPage")}
            <span aria-hidden>→</span>
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label={t("mdl.close")}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600/60"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/10 px-6 py-8 text-center text-sm text-red-400">
            {error}
          </div>
        ) : !item ? (
          <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/90 px-6 py-16 text-center text-sm text-zinc-500">
            {t("cs.gear.loading")}
          </div>
        ) : (
          <ItemExhibit item={item} />
        )}
      </div>
    </div>
  );
}
