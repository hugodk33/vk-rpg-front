"use client";

/* ============================================================
   GalleryModal — visualizador de galeria em modal.

   Substitui o `<a href target="_blank">` que jogava a figura crua numa
   nova aba: a imagem abre aqui, com navegação por setas/thumbs, e a
   mesma tela concentra as ações de substituir, apagar e adicionar —
   sem tirar o leitor do contexto da ficha ou do local.

   O upload acontece aqui (compressão <=1,5 MB + POST /upload); a
   persistência fica com o componente pai, que recebe a nova url via
   `onReplace`/`onAdd`. Sem esses callbacks o modal é só leitura.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadImage } from "@/lib/api";
import { prepareUpload } from "@/lib/upload";
import { useTranslation } from "@/lib/i18n";

export interface GalleryModalItem {
  url: string;
  /** Rótulo exibido sob a imagem (ex.: "Retrato"). */
  label?: string;
}

export interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  items: GalleryModalItem[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Pasta em uploads/ — "characters" ou "locations". */
  scope: string;
  onReplace?: (url: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onAdd?: (urls: string[]) => Promise<void> | void;
}

export default function GalleryModal({
  open,
  onClose,
  items,
  index,
  onIndexChange,
  scope,
  onReplace,
  onDelete,
  onAdd,
}: GalleryModalProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const replaceRef = useRef<HTMLInputElement | null>(null);
  const addRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(() => onClose(), [onClose]);
  const total = items.length;
  const active = items[Math.min(index, Math.max(total - 1, 0))];

  /* Limpa o erro a cada abertura sem setState dentro de um efeito. */
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setError(null);
  }

  const step = useCallback(
    (dir: -1 | 1) => {
      if (total < 2) return;
      onIndexChange((index + dir + total) % total);
    },
    [index, onIndexChange, total]
  );

  /* Foco e trava de scroll só na abertura: a navegação entre imagens não
     deve roubar o foco do botão de fechar. */
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Teclado: setas navegam, Esc fecha. Re-registra a cada troca de imagem
     para ler o índice atual, sem tocar no foco. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, step]);

  async function uploadFiles(files: FileList | null, mode: "replace" | "add") {
    if (!files || !files.length) return;
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await prepareUpload(file, 1600);
        urls.push(await uploadImage(dataUrl, scope));
      }
      if (mode === "replace") {
        const first = urls[0];
        if (first && onReplace) await onReplace(first);
      } else if (onAdd) {
        await onAdd(urls);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.error.upload"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.error.upload"));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-4">
      <button
        type="button"
        aria-label={t("mdl.close")}
        onClick={close}
        className="fixed inset-0 -z-10 cursor-default focus:outline-none"
        tabIndex={-1}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={active?.label || t("fr.gallery")}
        className="relative flex max-h-full w-full max-w-5xl flex-col gap-3"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-mono text-[11px] uppercase tracking-widest text-zinc-400">
            {active?.label || t("fr.gallery")}
            {total > 1 ? (
              <span className="ml-2 text-zinc-600">
                {index + 1} / {total}
              </span>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            {active ? (
              <a
                href={active.url}
                target="_blank"
                rel="noreferrer"
                title={t("fr.gallery.openTab")}
                className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ) : null}
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
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {total > 1 ? (
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t("fr.gallery.prev")}
              disabled={busy}
              className="absolute left-0 z-10 rounded-full bg-zinc-900/80 p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : null}

          {active ? (
            <img
              src={active.url}
              alt={active.label || t("fr.gallery")}
              className="max-h-[70vh] max-w-full rounded-lg border border-zinc-700/60 object-contain"
            />
          ) : (
            <p className="rounded-2xl border border-zinc-700/50 bg-zinc-900/90 px-6 py-16 text-center text-sm text-zinc-500">
              {t("fr.gallery.empty")}
            </p>
          )}

          {total > 1 ? (
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t("fr.gallery.next")}
              disabled={busy}
              className="absolute right-0 z-10 rounded-full bg-zinc-900/80 p-2 text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>

        {total > 1 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {items.map((item, i) => (
              <button
                key={`${item.url}-${i}`}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={item.label || `${t("fr.gallery")} ${i + 1}`}
                aria-current={i === index}
                className={`h-14 w-14 overflow-hidden rounded-md border-2 transition-colors ${
                  i === index ? "border-amber-500" : "border-zinc-700/60 opacity-60 hover:opacity-100"
                }`}
              >
                <img src={item.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        {onReplace || onDelete || onAdd ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onReplace ? (
              <label
                className={`cursor-pointer rounded-lg border border-amber-600/50 bg-amber-600/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-600/20 ${
                  busy || !active ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {busy ? t("fr.ch.uploading") : t("fr.gallery.replace")}
                <input
                  ref={replaceRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy || !active}
                  onChange={(e) => {
                    const files = e.target.files;
                    e.target.value = "";
                    void uploadFiles(files, "replace");
                  }}
                />
              </label>
            ) : null}

            {onDelete ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy || !active}
                className="rounded-lg border border-red-600/50 bg-red-600/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-600/20 disabled:pointer-events-none disabled:opacity-50"
              >
                {t("fr.gallery.delete")}
              </button>
            ) : null}

            {onAdd ? (
              <label
                className={`cursor-pointer rounded-lg border border-green-600/50 bg-green-600/10 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-600/20 ${
                  busy ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {t("fr.gallery.addMore")}
                <input
                  ref={addRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const files = e.target.files;
                    e.target.value = "";
                    void uploadFiles(files, "add");
                  }}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}
