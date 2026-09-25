"use client";

import { useEffect, useRef } from "react";

/* ============================================================
   useTableLive — assina o canal SSE de uma mesa e chama um
   callback quando a crônica muda (narração, ação, fila, cena,
   efeito). O callback vai num ref para nunca trocar o EventSource
   por causa de re-renders.
   ============================================================ */

export function useTableLive(tableId: string | null | undefined, onEvent?: (type?: string) => void) {
  const cbRef = useRef(onEvent);

  const tableKey = tableId ?? "";

  useEffect(() => {
    cbRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!tableKey) return;
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      es = new EventSource(`/api/realtime/events/${encodeURIComponent(tableKey)}`);
      es.addEventListener("change", (e) => {
        if (closed) return;
        let type: string | undefined;
        try {
          const data = JSON.parse((e as MessageEvent).data) as { type?: string };
          type = data?.type ?? "change";
        } catch {
          type = "change";
        }
        cbRef.current?.(type);
      });
    };
    connect();

    return () => {
      closed = true;
      es?.close();
    };
  }, [tableKey]);
}