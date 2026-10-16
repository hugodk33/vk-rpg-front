"use client";

/* ============================================================
   useCatalog — busca a lista COMPLETA de um endpoint de catálogo.

   As telas filtram/buscam e agora paginam no cliente (usePagination),
   então precisam do array inteiro para que os chips, as contagens e o
   número de páginas fiquem corretos. Sem `?limit=`, os endpoints devolvem
   o array completo (comportamento legado).
   ============================================================ */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useCatalog<T>(url: string): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    let alive = true;
    api<T>(url)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive) setData(null);
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return data;
}
