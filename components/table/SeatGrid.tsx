"use client";

/* ============================================================
   SeatGrid — a grade de assentos (jogadores ou NPCs) do painel
   do narrador, paginada no cliente.

   A grade é montada no servidor (cada assento exige ler a ficha
   e os efeitos), mas a PAGINAÇÃO é de navegação local: o array
   já chega inteiro aqui e o hook fatia a página atual. O
   componente <Pagination> some sozinho quando cabe tudo numa
   página só.
   ============================================================ */

import SeatCard, { type SeatData } from "@/components/table/SeatCard";
import Pagination, { type PaginationAccent } from "@/components/table/Pagination";
import { usePagination } from "@/lib/usePagination";
import type { Hue } from "@/lib/hue";

export default function SeatGrid({
  seats,
  hue,
  pageSize = 12,
  accent = "green",
  resetKey = "seats",
}: {
  seats: SeatData[];
  hue?: Hue;
  pageSize?: number;
  accent?: PaginationAccent;
  resetKey?: string;
}) {
  const pager = usePagination(seats, resetKey, pageSize);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {pager.slice.map((s) => (
          <SeatCard key={s.id || s.name} s={s} hue={hue} />
        ))}
      </div>
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        from={pager.from}
        to={pager.to}
        total={pager.total}
        onPageChange={pager.setPage}
        accent={accent}
      />
    </>
  );
}
