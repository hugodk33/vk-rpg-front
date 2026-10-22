"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CharacterItem,
  CharacterViewer,
  TableCharacter,
  TradeOfferContext,
  TradeOfferItem,
  TradeSide,
} from "@/lib/types";
import { api } from "@/lib/api";
import {
  cancelTradeOffer,
  confirmTradeOffer,
  createTradeOffer,
  editTradeOffer,
  listTradeOffers,
  rejectTradeOffer,
  toItemInputs,
} from "@/lib/trade";
import { useTableLive } from "@/lib/useTableLive";
import { translate, useTranslation } from "@/lib/i18n";
import ItemIcon from "@/components/items/ItemIcon";

/* ============================================================
   Trade Panel — a mesa de negociação entre dois jogadores.

   A oferta tem DUAS mãos: `from` (o que o proponente dá) e `to`
   (o que o destinatário dá). A forma da mão é a operação:

     from=[espada], to=[]           transferência (presente)
     from=[espada], to=[moedas]     venda
     from=[moedas], to=[espada]     compra
     from=[espada], to=[capa]       troca

   Quem EDITA os termos concorda com o novo texto e desfaz a
   concordância do outro — quem mudou a proposta precisa da
   concordância expressa de quem vai aceitar. A troca só
   acontece com as DUAS confirmações.
   ============================================================ */

/** Um item do inventário com a quantidade somada (as linhas do equipamento). */
export interface OwnedItem {
  item_id: string;
  name: string;
  kind: string;
  quantity: number;
  item: CharacterItem;
}

/** Soma as linhas de equipamento por item — o mesmo cálculo do backend. */
export function aggregateItems(items: CharacterItem[] | null | undefined): OwnedItem[] {
  const map = new Map<string, OwnedItem>();
  for (const raw of items ?? []) {
    const id = raw.item_id ?? raw.id ?? "";
    if (!id) continue;
    const owned = raw.equipment_quantity ?? raw.quantity ?? 1;
    const found = map.get(id);
    if (found) {
      found.quantity += owned;
    } else {
      map.set(id, {
        item_id: id,
        name: raw.name || "",
        kind: raw.kind ?? "",
        quantity: owned,
        item: raw,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/* ---------- seletor de itens: busca + filtro + seleção múltipla ---------- */

interface ItemPickerProps {
  items: OwnedItem[];
  selection: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  loading?: boolean;
}

function ItemPicker({ items, selection, onChange, loading = false }: ItemPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");

  const kinds = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.kind) set.add(item.kind);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (kind && item.kind !== kind) return false;
      if (!needle) return true;
      return item.name.toLowerCase().includes(needle);
    });
  }, [items, kind, search]);

  const bump = (id: string, delta: number) => {
    const next = { ...selection };
    const value = Math.max(0, (next[id] ?? 0) + delta);
    if (value <= 0) delete next[id];
    else next[id] = value;
    onChange(next);
  };

  return (
    <div className="rounded-xl border border-zinc-700/40 bg-zinc-950/40 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/70 px-3 py-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("tr.search")}
          aria-label={t("tr.search")}
          className="min-w-[8rem] flex-1 rounded-md border border-zinc-700/60 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-blue-500/60"
        />
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(kind === k ? "" : k)}
            className={`rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-widest transition-colors ${
              kind === k
                ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                : "border-zinc-700/60 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800/60">
        {loading ? (
          <p className="px-3 py-4 text-xs text-zinc-600 italic">{t("tr.loading")}</p>
        ) : null}
        {!loading && filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-zinc-600 italic">{t("tr.noResults")}</p>
        ) : null}
        {filtered.map((item) => {
          const quantity = selection[item.item_id] ?? 0;
          return (
            <div key={item.item_id} className="flex items-center gap-2 px-3 py-2">
              <ItemIcon
                item={item.item}
                className="w-5 h-5 shrink-0 text-zinc-400"
                imgClassName="w-6 h-6 object-cover rounded"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-zinc-200">{item.name || t("cs.unnamed")}</p>
                <p className="text-[10px] text-zinc-500">
                  {t("tr.owned")}: {item.quantity}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={t("tr.less")}
                  disabled={quantity <= 0}
                  onClick={() => bump(item.item_id, -1)}
                  className="w-6 h-6 rounded-md border border-zinc-700/60 text-zinc-400 hover:border-red-500/50 hover:text-red-300 transition-colors disabled:opacity-30"
                >
                  −
                </button>
                <span className="w-5 text-center font-mono text-xs text-zinc-200">{quantity}</span>
                <button
                  type="button"
                  aria-label={t("tr.more")}
                  disabled={quantity >= item.quantity}
                  onClick={() => bump(item.item_id, 1)}
                  className="w-6 h-6 rounded-md border border-zinc-700/60 text-zinc-400 hover:border-blue-500/50 hover:text-blue-300 transition-colors disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- painel ---------- */

export interface TradePanelProps {
  /** O dono do personagem (o "actor" do backend). */
  actorId: string;
  /** O personagem que negocia. */
  characterId: string;
  characterName: string;
  tableId: string;
  /** Os personagens da mesa (para escolher com quem negociar). */
  roster: TableCharacter[];
  /** O inventário do próprio personagem. */
  myItems: CharacterItem[];
  /** Item que abre a oferta já na mão (vindo do inventário). */
  presetItemId?: string | null;
  /** Fecha a tela de negociação (volta para o inventário). */
  onClose?: () => void;
}

const EMPTY: Record<string, number> = {};

export default function TradePanel({
  actorId,
  characterId,
  characterName,
  roster,
  myItems,
  presetItemId,
  onClose,
  presence,
  tableId,
}: TradePanelProps & { presence?: { hasPresence: boolean; presentIds: Set<string>; consciousIds: Set<string> } }) {
  const { lang, t } = useTranslation();
  /* `t` é recriado a cada render — o `tr` com `lang` (string estável) é o
     que pode entrar na lista de dependências dos efeitos. */
  const tr = useCallback((key: string) => translate(lang, key), [lang]);

  const [offers, setOffers] = useState<TradeOfferContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const myOwned = useMemo(() => aggregateItems(myItems), [myItems]);
  const preset =
    presetItemId && myOwned.some((item) => item.item_id === presetItemId) ? presetItemId : null;

  /* ---- formulário de nova oferta ---- */
  const [formOpen, setFormOpen] = useState(() => Boolean(preset));
  const [recipientId, setRecipientId] = useState("");
  const [fromSel, setFromSel] = useState<Record<string, number>>(() =>
    preset ? { [preset]: 1 } : EMPTY
  );
  const [toSel, setToSel] = useState<Record<string, number>>(EMPTY);
  const [message, setMessage] = useState("");
  const [otherItems, setOtherItems] = useState<OwnedItem[]>([]);
  const [otherLoading, setOtherLoading] = useState(false);

  /* ---- edição de uma mão ---- */
  const [edit, setEdit] = useState<{ offer: TradeOfferContext; side: TradeSide } | null>(null);
  const [editSel, setEditSel] = useState<Record<string, number>>(EMPTY);
  const [editItems, setEditItems] = useState<OwnedItem[]>([]);

  const partners = useMemo(
    () =>
      roster.filter(
        (c) =>
          c.id !== characterId &&
          !c.isNpc &&
          c.is_active !== false &&
          !!c.user?.id &&
          (presence
            ? presence.hasPresence
              ? presence.presentIds.has(c.id) && presence.consciousIds.has(c.id)
              : true
            : true)
      ),
    [roster, characterId, presence]
  );

  const fetchOffers = useCallback(async () => {
    if (!actorId || !characterId) return;
    try {
      const list = await listTradeOffers(actorId, characterId);
      setOffers(list ?? []);
      setError(null);
    } catch (err) {
      setError(errorText(err, tr("tr.err.load")));
    }
  }, [actorId, characterId, tr]);

  useEffect(() => {
    void (async () => {
      await fetchOffers();
      setLoading(false);
    })();
  }, [fetchOffers]);

  /* Recarrega a lista depois de qualquer ação (fora de efeito). */
  const reload = useCallback(async () => {
    await fetchOffers();
  }, [fetchOffers]);

  /* O backend avisa a mesa quando uma oferta muda; recarrega a lista. */
  useTableLive(tableId, (type) => {
    if (type === "trade" || !type) void reload();
  });

  /* Carrega o inventário de OUTRO personagem (visibilidade do olhar). */
  const loadOtherInventory = useCallback(
    async (targetId: string): Promise<OwnedItem[]> => {
      if (!targetId) return [];
      if (targetId === characterId) return myOwned;
      try {
        const viewer = await api<CharacterViewer>(
          `/game-table-character/${encodeURIComponent(targetId)}?viewer=${encodeURIComponent(characterId)}`
        );
        return aggregateItems(viewer?.character?.items);
      } catch {
        return [];
      }
    },
    [characterId, myOwned]
  );

  /* O destinatário escolhido define de onde vem a outra mão. */
  useEffect(() => {
    if (!formOpen || !recipientId) return;
    let cancelled = false;
    void (async () => {
      const items = await loadOtherInventory(recipientId);
      if (cancelled) return;
      setOtherItems(items);
      setOtherLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [formOpen, recipientId, loadOtherInventory]);

  const pending = useMemo(() => offers.filter((o) => o.offer.status === "pending"), [offers]);
  const closed = useMemo(() => offers.filter((o) => o.offer.status !== "pending"), [offers]);

  /* ---- ações ---- */

  async function run(
    offerId: string,
    action: () => Promise<TradeOfferContext | null>,
    done?: (result: TradeOfferContext | null) => void
  ) {
    setBusyId(offerId);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      done?.(result);
      await reload();
    } catch (err) {
      setError(errorText(err, tr("tr.err.action")));
    } finally {
      setBusyId(null);
    }
  }

  async function submitOffer() {
    if (!recipientId) {
      setError(tr("tr.err.recipient"));
      return;
    }
    if (Object.keys(fromSel).length === 0) {
      setError(tr("tr.err.items"));
      return;
    }
    setBusyId("new");
    setError(null);
    setNotice(null);
    try {
      await createTradeOffer({
        actorId,
        proposerCharacterId: characterId,
        recipientCharacterId: recipientId,
        from: toItemInputs(fromSel),
        to: toItemInputs(toSel),
        message: message.trim() || null,
      });
      setFormOpen(false);
      setRecipientId("");
      setFromSel(EMPTY);
      setToSel(EMPTY);
      setMessage("");
      setNotice(tr("tr.sent"));
      await reload();
    } catch (err) {
      setError(errorText(err, tr("tr.err.send")));
    } finally {
      setBusyId(null);
    }
  }

  /** Abre a edição de uma mão da oferta. */
  async function openEdit(offer: TradeOfferContext, side: TradeSide) {
    setError(null);
    setNotice(null);
    setOtherLoading(true);
    const source =
      side === "from" ? offer.offer.proposer_character_id : offer.offer.recipient_character_id;
    const items = await loadOtherInventory(source);
    setOtherLoading(false);
    setEditItems(items);
    const current = offer.offer[side] ?? [];
    const selection: Record<string, number> = {};
    for (const line of current) selection[line.item_id] = line.quantity;
    setEditSel(selection);
    setEdit({ offer, side });
  }

  async function submitEdit() {
    if (!edit) return;
    const { offer, side } = edit;
    await run(offer.offer.id, async () => {
      await editTradeOffer({
        actorId,
        offerId: offer.offer.id,
        characterId,
        side,
        items: toItemInputs(editSel),
      });
      setEdit(null);
      return null;
    });
  }

  return (
    <div className="space-y-5">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-widest uppercase text-blue-300/90">
            {t("tr.eyebrow")}
          </p>
          <h2 className="text-lg font-bold text-zinc-100 mt-1">{t("tr.title")}</h2>
          <p className="text-sm text-zinc-400 mt-1 max-w-xl">{t("tr.desc")}</p>
        </div>
        <div className="flex items-center gap-2">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700/60 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-400 transition-colors hover:text-zinc-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              {t("tr.back")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setFormOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-400/10 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-blue-300 transition-colors hover:bg-blue-400/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            {t("tr.newOffer")}
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-2">
          {notice}
        </div>
      ) : null}

      {/* ---- nova oferta ---- */}
      {formOpen ? (
        <div className="space-y-4 border-t border-zinc-800 pt-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
              {t("tr.toRecipient")}
            </label>
            {partners.length === 0 ? (
              <p className="text-sm text-zinc-600 italic">{t("tr.noPartners")}</p>
            ) : (
              <select
                value={recipientId}
                onChange={(e) => {
                  setRecipientId(e.target.value);
                  setToSel(EMPTY);
                  setOtherItems([]);
                  setOtherLoading(!!e.target.value);
                }}
                className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500/60"
              >
                <option value="">{t("tr.chooseRecipient")}</option>
                {partners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.sheet?.name || c.name || c.user?.username || t("pl.res.unnamed")}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
              {t("tr.youGive")}
            </p>
            <ItemPicker items={myOwned} selection={fromSel} onChange={setFromSel} />
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
              {t("tr.youGet")}
            </p>
            <ItemPicker
              items={otherItems}
              selection={toSel}
              onChange={setToSel}
              loading={otherLoading}
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">
              {t("tr.message")}
            </label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("tr.messagePlaceholder")}
              className="w-full rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-blue-500/60"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyId === "new"}
              onClick={() => void submitOffer()}
              className="rounded-lg bg-blue-600/70 hover:bg-blue-600 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-white transition-colors disabled:opacity-50"
            >
              {t("tr.send")}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-zinc-700/60 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {t("tr.close")}
            </button>
          </div>
        </div>
      ) : null}

      {/* ---- edição de uma mão ---- */}
      {edit ? (
        <div className="space-y-4 border-t border-amber-500/30 pt-4">
          <div>
            <p className="font-mono text-[10px] tracking-widest uppercase text-amber-300/90">
              {t("tr.eyebrow")}
            </p>
            <h3 className="text-base font-bold text-zinc-100 mt-1">
              {edit.side === "from"
                ? t("tr.editFrom").replace("{name}", characterName)
                : t("tr.editTo")}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">{t("tr.editHint")}</p>
          </div>
          <ItemPicker
            items={editItems}
            selection={editSel}
            onChange={setEditSel}
            loading={otherLoading}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busyId === edit.offer.offer.id}
              onClick={() => void submitEdit()}
              className="rounded-lg bg-amber-600/70 hover:bg-amber-600 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-white transition-colors disabled:opacity-50"
            >
              {t("tr.save")}
            </button>
            <button
              type="button"
              onClick={() => setEdit(null)}
              className="rounded-lg border border-zinc-700/60 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.12em] text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {t("tr.close")}
            </button>
          </div>
        </div>
      ) : null}

      {/* ---- ofertas em aberto ---- */}
      <div className="space-y-3">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-zinc-500">
          {t("tr.openOffers")}
        </h3>
        {loading ? (
          <p className="text-sm text-zinc-600 italic">{t("tr.loading")}</p>
        ) : null}
        {!loading && pending.length === 0 ? (
          <p className="text-sm text-zinc-600 italic">{t("tr.empty")}</p>
        ) : null}
        {pending.map((entry) => (
          <OfferCard
            key={entry.offer.id}
            entry={entry}
            busy={busyId === entry.offer.id}
            onConfirm={() =>
              void run(entry.offer.id, async () => {
                const result = await confirmTradeOffer({
                  actorId,
                  offerId: entry.offer.id,
                  characterId,
                });
                if (result?.executed) setNotice(tr("tr.executed"));
                return result;
              })
            }
            onEdit={(side) => void openEdit(entry, side)}
            onReject={() =>
              void run(entry.offer.id, () =>
                rejectTradeOffer({
                  actorId,
                  offerId: entry.offer.id,
                  characterId,
                })
              )
            }
            onCancel={() =>
              void run(entry.offer.id, () =>
                cancelTradeOffer({
                  actorId,
                  offerId: entry.offer.id,
                  characterId,
                })
              )
            }
          />
        ))}
      </div>

      {/* ---- encerradas ---- */}
      {closed.length > 0 ? (
        <details className="rounded-xl border border-zinc-800/70 bg-zinc-900/30">
          <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] tracking-widest uppercase text-zinc-500 hover:text-zinc-300">
            {t("tr.closedOffers")}
          </summary>
          <div className="space-y-2 px-4 pb-4">
            {closed.map((entry) => (
              <OfferCard key={entry.offer.id} entry={entry} readOnly />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/* ---------- uma oferta ---------- */

interface OfferCardProps {
  entry: TradeOfferContext;
  busy?: boolean;
  readOnly?: boolean;
  onConfirm?: () => void;
  onEdit?: (side: TradeSide) => void;
  onReject?: () => void;
  onCancel?: () => void;
}

const STATUS_CLASS: Record<string, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-300",
  cancelled: "border-zinc-600/50 bg-zinc-700/30 text-zinc-400",
};

export function OfferCard({
  entry,
  busy = false,
  readOnly = false,
  onConfirm,
  onEdit,
  onReject,
  onCancel,
}: OfferCardProps) {
  const { t } = useTranslation();
  const offer = entry.offer;
  const proposerName = offer.proposer_name || t("pl.res.unnamed");
  const recipientName = offer.recipient_name || t("pl.res.unnamed");

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
            STATUS_CLASS[offer.status] ?? STATUS_CLASS.pending
          }`}
        >
          {t(`tr.status.${offer.status}`)}
        </span>
        <span className="text-sm text-zinc-200">
          {proposerName} <span className="text-zinc-500">&rarr;</span> {recipientName}
        </span>
        {offer.message ? (
          <span className="text-xs text-zinc-500 italic truncate max-w-xs">
            &quot;{offer.message}&quot;
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-800/70 rounded-lg overflow-hidden">
        <Hand
          title={t("tr.gives").replace("{name}", proposerName)}
          lines={offer.from}
          confirmed={offer.proposer_confirmed}
        />
        <Hand
          title={t("tr.gives").replace("{name}", recipientName)}
          lines={offer.to}
          confirmed={offer.recipient_confirmed}
        />
      </div>

      {!readOnly ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {entry.canConfirm ? (
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-lg bg-emerald-700/60 hover:bg-emerald-700 px-3 py-1.5 text-[11px] uppercase tracking-widest text-emerald-50 transition-colors disabled:opacity-50"
            >
              {t("tr.confirm")}
            </button>
          ) : null}
          {entry.canEditFrom ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onEdit?.("from")}
              className="rounded-lg border border-zinc-700/60 px-3 py-1.5 text-[11px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-50"
            >
              {t("tr.editFromShort")}
            </button>
          ) : null}
          {entry.canEditTo ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onEdit?.("to")}
              className="rounded-lg border border-zinc-700/60 px-3 py-1.5 text-[11px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-50"
            >
              {t("tr.editToShort")}
            </button>
          ) : null}
          {entry.canReject ? (
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-[11px] uppercase tracking-widest text-red-300 transition-colors hover:bg-red-500/10 disabled:opacity-50"
            >
              {t("tr.reject")}
            </button>
          ) : null}
          {entry.canCancel ? (
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-lg border border-zinc-700/60 px-3 py-1.5 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
            >
              {t("tr.cancel")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Hand({
  title,
  lines,
  confirmed,
}: {
  title: string;
  lines: TradeOfferItem[];
  confirmed: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="bg-zinc-900 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 truncate">{title}</p>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${
            confirmed
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-zinc-700/60 text-zinc-500"
          }`}
        >
          {confirmed ? t("tr.accepted") : t("tr.waiting")}
        </span>
      </div>
      {lines.length === 0 ? (
        <p className="text-xs text-zinc-600 italic">{t("tr.emptyHand")}</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-zinc-200 truncate">{line.item_name || line.item_id}</span>
              <span className="font-mono text-zinc-500 shrink-0">×{line.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
