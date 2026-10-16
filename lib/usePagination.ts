"use client";

/* ============================================================
   usePagination — paginação de página fechada ("fecha uma página
   e vai pra outra") feita 100% no cliente.

   As listas (catálogos e crônica) filtram/buscam no cliente, então
   paginar no servidor quebraria os chips e a busca. Aqui o array já
   filtrado é fatiado em páginas de `PAGE_SIZE`; trocar de filtro
   (mudança de `resetKey`) volta para a primeira página.
   ============================================================ */

import { useMemo, useState } from "react";

/** Itens/cenas por página. A partir daqui a lista vira paginada. */
export const PAGE_SIZE = 30;

export function usePagination<T>(items: T[], resetKey: unknown = "", pageSize: number = PAGE_SIZE) {
  /* Guardamos a página junto da chave que a originou. Se o filtro mudou,
     a página exibida é a 1 sem precisar de efeito (e sem cascata de renders). */
  const [state, setState] = useState<{ page: number; key: unknown }>({ page: 1, key: resetKey });
  const page = state.key === resetKey ? state.page : 1;
  if (state.key !== resetKey) {
    setState({ page: 1, key: resetKey });
  }

  const setPage = (next: number) => setState({ page: next, key: resetKey });

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);

  const slice = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  return {
    page: safePage,
    setPage,
    pageCount,
    total,
    pageSize,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(total, safePage * pageSize),
    slice,
  };
}
