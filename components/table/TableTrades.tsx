"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { TradeOfferContext } from "@/lib/types";
import { listTableTradeOffers } from "@/lib/trade";
import { OfferCard } from "@/components/player/TradePanel";
import { useTableLive } from "@/lib/useTableLive";
import { translate, useTranslation } from "@/lib/i18n";

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function TableTrades({ tableId, actorId }: { tableId: string; actorId: string }) {
  const { lang, t } = useTranslation();
  const tr = useCallback((key: string) => translate(lang, key), [lang]);

  const [offers, setOffers] = useState<TradeOfferContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!actorId) return;
    try {
      const list = await listTableTradeOffers(actorId, tableId);
      setOffers(list ?? []);
      setError(null);
    } catch (err) {
      setError(errorText(err, tr("tr.err.load")));
    }
  }, [actorId, tableId, tr]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      await load();
      if (!cancel) {
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [load]);

  useTableLive(tableId, (type) => {
    if (type === "trade" || !type) void load();
  });

  const pending = offers.filter((o) => o.offer.status === "pending");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">{t("tr.eyebrow")}</p>
          <h1 className="text-2xl font-bold text-zinc-100 mt-1">{t("tr.title")}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t("tr.watchDesc")}</p>
        </div>
        <Link
          href={`/table/${tableId}/items`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/60 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          {t("nav.items")}
        </Link>
      </div>

      {error ? <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</div> : null}

      {loading ? <p className="text-sm text-zinc-600 italic">{t("tr.loading")}</p> : null}
      {!loading && pending.length === 0 ? <p className="text-sm text-zinc-600 italic">{t("tr.watchEmpty")}</p> : null}

      <div className="space-y-2">
        {pending.map((entry) => (
          <OfferCard key={entry.offer.id} entry={entry} readOnly />
        ))}
      </div>

      {offers.length > pending.length ? (
        <details className="rounded-xl border border-zinc-800/70 bg-zinc-900/30">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] tracking-widest uppercase text-zinc-500 hover:text-zinc-300">
            {t("tr.closedOffers")}
          </summary>
          <div className="space-y-2 px-4 pb-4">
            {offers
              .filter((o) => o.offer.status !== "pending")
              .map((entry) => (
                <OfferCard key={entry.offer.id} entry={entry} readOnly />
              ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
