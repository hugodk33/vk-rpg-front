"use client";

/* ============================================================
   LocationGallery — as fotos de um local (role='gallery') abertas num
   modal em vez de nova aba, com substituir/apagar/adirar no mesmo lugar.

   Só a galeria é gerenciada aqui: o banner é um slot próprio gravado no
   form de edição da location. PUT /table-location/:id/images regrava o
   array inteiro sem tocar nas demais colunas do local.
   ============================================================ */

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { saveLocationImages } from "@/lib/gallery";
import GalleryModal from "./GalleryModal";

export default function LocationGallery({
  locationId,
  name,
  images: initialImages,
  manage = true,
}: {
  locationId: string;
  name: string;
  images: string[];
  manage?: boolean;
}) {
  const { t } = useTranslation();
  const [images, setImages] = useState<string[]>(initialImages);
  const [active, setActive] = useState<number | null>(null);

  /* Igual à galeria do personagem: um `router.refresh()` traz a lista nova
     do servidor e o estado local precisa acompanhá-la. */
  const sourceKey = initialImages.join("|");
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey);
  if (prevSourceKey !== sourceKey) {
    setPrevSourceKey(sourceKey);
    setImages(initialImages);
  }

  const labelFor = (i: number) => `${t("fr.gallery")} ${i + 1}`;

  async function handleReplace(url: string) {
    if (active === null) return;
    const next = images.map((u, i) => (i === active ? url : u));
    await saveLocationImages(locationId, next);
    setImages(next);
  }

  async function handleDelete() {
    if (active === null) return;
    const next = images.filter((_, i) => i !== active);
    await saveLocationImages(locationId, next);
    setImages(next);
    setActive(next.length === 0 ? null : Math.min(active, next.length - 1));
  }

  async function handleAdd(urls: string[]) {
    const next = [...images, ...urls];
    await saveLocationImages(locationId, next);
    setImages(next);
    setActive(images.length);
  }

  if (!images.length && !manage) return null;

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {images.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setActive(i)}
            aria-label={labelFor(i)}
            className="block h-28 w-28 overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900 transition-colors hover:border-zinc-500"
          >
            <img src={url} alt={`${name} ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}

        {manage ? (
          <button
            type="button"
            onClick={() => setActive(0)}
            aria-label={t("fr.gallery.add")}
            className="flex h-28 w-28 items-center justify-center rounded-lg border border-dashed border-zinc-700/60 bg-zinc-900/40 text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
          >
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        ) : null}
      </div>

      <GalleryModal
        open={active !== null}
        onClose={() => setActive(null)}
        items={images.map((url, i) => ({ url, label: labelFor(i) }))}
        index={active ?? 0}
        onIndexChange={setActive}
        scope="locations"
        onReplace={manage ? handleReplace : undefined}
        onDelete={manage ? handleDelete : undefined}
        onAdd={manage ? handleAdd : undefined}
      />
    </>
  );
}
