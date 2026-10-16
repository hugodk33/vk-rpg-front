"use client";

/* ============================================================
   SceneImage — a única imagem de uma cena, exibida na crônica.
   Leitura para todos; com `canEdit` (narrador) mostra controles de
   escolher/trocar/remover. O upload reaproveita o mesmo fluxo das
   demais telas: prepareUpload → uploadImage(scope "scenes").
   ============================================================ */

import { useRef, useState } from "react";
import { prepareUpload } from "@/lib/upload";
import { uploadImage } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";

export default function SceneImage({
  url,
  canEdit,
  onChange,
}: {
  url: string | null;
  canEdit: boolean;
  onChange: (url: string | null) => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function pick(file: File | null | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      const dataUrl = await prepareUpload(file, 1600);
      const uploaded = await uploadImage(dataUrl, "scenes");
      await onChange(uploaded);
    } catch {
      /* erro de upload: mantém a imagem atual */
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await onChange(null);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  /* Nada para mostrar e não pode editar: some por completo. */
  if (!url && !canEdit) return null;

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        pick(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (!url) {
    return (
      <div className="mb-5">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700/60 bg-zinc-900/30 py-4 text-xs font-medium uppercase tracking-widest text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {busy ? t("vs.tl.imageUploading") : t("vs.tl.addImage")}
        </button>
        {fileInput}
      </div>
    );
  }

  return (
    <div className="mb-5">
      <figure className="group relative overflow-hidden rounded-lg border border-zinc-700/40 bg-zinc-900/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={t("vs.tl.sceneImageAlt")} className="max-h-[420px] w-full object-cover" />
        {canEdit ? (
          <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-zinc-600/60 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200 backdrop-blur transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? t("vs.tl.imageUploading") : t("vs.tl.replaceImage")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded-md border border-red-500/40 bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-red-300 backdrop-blur transition-colors hover:bg-red-950/60 disabled:opacity-50"
            >
              {t("vs.tl.removeImage")}
            </button>
          </div>
        ) : null}
      </figure>
      {fileInput}
    </div>
  );
}
