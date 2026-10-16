"use client";

/* ============================================================
   Pagination — navegação de página fechada para as listas.
   Mostra ‹ Anterior · números (com reticências) · Próxima › e, abaixo,
   o intervalo visível ("Mostrando 31–60 de 165"). Some sozinho quando
   só existe uma página.
   ============================================================ */

import { interpolate, useTranslation } from "@/lib/i18n";

export type PaginationAccent = "blue" | "rose" | "emerald" | "green" | "violet" | "teal";

const ACTIVE: Record<PaginationAccent, string> = {
  blue: "bg-blue-600 border-blue-500 text-white",
  rose: "bg-rose-600 border-rose-500 text-white",
  emerald: "bg-emerald-600 border-emerald-500 text-white",
  green: "bg-green-700 border-green-600 text-white",
  violet: "bg-violet-600 border-violet-500 text-white",
  teal: "bg-teal-600 border-teal-500 text-white",
};

/** Janela de números: primeira, última, atual ±1, com reticências. */
function pageWindow(page: number, pageCount: number): (number | "ellipsis")[] {
  const wanted = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPageChange,
  accent = "green",
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (next: number) => void;
  accent?: PaginationAccent;
}) {
  const { t } = useTranslation();
  if (pageCount <= 1) return null;

  const navBtn =
    "flex h-8 min-w-8 items-center justify-center rounded-md border border-zinc-700/50 bg-zinc-800/40 px-2 font-mono text-[11px] text-zinc-400 transition-colors hover:text-zinc-100 hover:border-zinc-600/60 disabled:opacity-35 disabled:hover:border-zinc-700/50 disabled:hover:text-zinc-400";

  return (
    <div className="flex flex-col items-center gap-2 mt-6" role="navigation" aria-label={t("tp.page.label")}>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button type="button" className={navBtn} onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label={t("tp.page.prev")}>
          ‹ {t("tp.page.prev")}
        </button>

        {pageWindow(page, pageCount).map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e${i}`} className="px-1 font-mono text-[11px] text-zinc-600" aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 font-mono text-[11px] transition-colors ${
                p === page ? ACTIVE[accent] : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600/60"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button type="button" className={navBtn} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label={t("tp.page.next")}>
          {t("tp.page.next")} ›
        </button>
      </div>

      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        {interpolate(t("tp.page.range"), { from, to, total })}
      </span>
    </div>
  );
}
