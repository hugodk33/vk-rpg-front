"use client";

/* ============================================================
   ImageGalleryField — multi-image uploader shared by the item,
   character and location forms. Each entity can hold several
   images; every file is compressed in the browser (<=1.5 MB)
   before hitting POST /upload, and the order is preserved so the
   first image reads as the "cover".
   ============================================================ */

import { useState } from "react";
import { uploadImage } from "@/lib/api";
import { prepareUpload } from "@/lib/upload";
import { useTranslation } from "@/lib/i18n";
import { labelCls } from "./formStyles";

export interface ImageGalleryFieldProps {
  images: string[];
  onChange: (images: string[]) => void;
  /** Folder under uploads/ — "items", "characters" or "locations". */
  scope: string;
  label?: string;
  disabled?: boolean;
}

export default function ImageGalleryField({
  images,
  onChange,
  scope,
  label,
  disabled = false,
}: ImageGalleryFieldProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await prepareUpload(file, 1600);
        const url = await uploadImage(dataUrl, scope);
        uploaded.push(url);
      }
      onChange([...images, ...uploaded]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.error.upload"));
    } finally {
      setBusy(false);
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const a = next[index]!;
    next[index] = next[target]!;
    next[target] = a;
    onChange(next);
  }

  return (
    <div>
      <label className={labelCls}>{label ?? t("fr.gallery")}</label>

      {images.length ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {images.map((url, i) => (
            <div
              key={`${url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900"
            >
              <img src={url} alt="" className="h-full w-full object-cover" />

              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-green-600/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                  {t("fr.gallery")} 1
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-zinc-950/80 px-1 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={disabled || i === 0}
                    onClick={() => move(i, -1)}
                    title={t("fr.gallery.moveLeft")}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={disabled || i === images.length - 1}
                    onClick={() => move(i, 1)}
                    title={t("fr.gallery.moveRight")}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeAt(i)}
                  title={t("fr.gallery.remove")}
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-semibold text-red-300 hover:bg-red-900/60 disabled:opacity-30"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-zinc-600 italic">{t("fr.gallery.empty")}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label
          className={`cursor-pointer rounded-lg border border-green-600/50 bg-green-600/10 px-3 py-1.5 text-xs font-semibold text-green-300 transition-colors hover:bg-green-600/20 ${
            disabled || busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy ? t("fr.ch.uploading") : t("fr.gallery.add")}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              const files = e.target.files;
              e.target.value = "";
              if (files) void handleFiles(files);
            }}
          />
        </label>
        <span className="text-[11px] text-zinc-600">{t("fr.gallery.hint")}</span>
      </div>

      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
