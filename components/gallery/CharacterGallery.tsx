"use client";

/* ============================================================
   CharacterGallery — grade de imagens do personagem (retrato, corpo
   inteiro e galeria) abrindo num modal em vez de nova aba.

   Cada slot é persistido pelo seu próprio caminho: retrato e corpo são
   slots unitários (role='portrait'/'body'), a galeria é um array
   reescrito por inteiro. Todos os três passam por
   PUT /game-table-character/:id/images, que só toca as linhas de imagem.
   ============================================================ */

import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { saveCharacterImages } from "@/lib/gallery";
import GalleryModal from "./GalleryModal";

type Slot = { url: string; role: "portrait" | "body" | "gallery"; galleryIndex: number };

export default function CharacterGallery({
  characterId,
  name,
  portraitUrl: initialPortrait,
  bodyUrl: initialBody,
  images: initialImages,
  manage = true,
}: {
  characterId: string;
  name: string;
  portraitUrl?: string | null;
  bodyUrl?: string | null;
  images: string[];
  manage?: boolean;
}) {
  const { t } = useTranslation();
  const [portrait, setPortrait] = useState(initialPortrait ?? "");
  const [body, setBody] = useState(initialBody ?? "");
  const [images, setImages] = useState<string[]>(initialImages);
  const [active, setActive] = useState<number | null>(null);

  /* O console do jogador e as páginas do narrador re-renderizam com dados
     novos a cada `router.refresh()`. Sem isto o estado local ficaria preso
     na versão em que a tela montou e ignoraria a edição do outro lado. */
  const sourceKey = `${initialPortrait ?? ""}|${initialBody ?? ""}|${initialImages.join("|")}`;
  const [prevSourceKey, setPrevSourceKey] = useState(sourceKey);
  if (prevSourceKey !== sourceKey) {
    setPrevSourceKey(sourceKey);
    setPortrait(initialPortrait ?? "");
    setBody(initialBody ?? "");
    setImages(initialImages);
  }

  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    if (portrait) out.push({ url: portrait, role: "portrait", galleryIndex: -1 });
    if (body) out.push({ url: body, role: "body", galleryIndex: -1 });
    images.forEach((url, i) => out.push({ url, role: "gallery", galleryIndex: i }));
    return out;
  }, [portrait, body, images]);

  const labelFor = (slot: Slot) =>
    slot.role === "portrait"
      ? t("fr.ch.portrait")
      : slot.role === "body"
        ? t("fr.ch.bodyFull")
        : `${t("fr.gallery")} ${slot.galleryIndex + 1}`;

  const items = slots.map((slot) => ({ url: slot.url, label: labelFor(slot) }));
  const current = active === null ? null : slots[active];

  async function handleReplace(url: string) {
    if (!current) return;
    if (current.role === "portrait") {
      await saveCharacterImages(characterId, { portraitUrl: url });
      setPortrait(url);
      return;
    }
    if (current.role === "body") {
      await saveCharacterImages(characterId, { bodyUrl: url });
      setBody(url);
      return;
    }
    const next = images.map((u, i) => (i === current.galleryIndex ? url : u));
    await saveCharacterImages(characterId, { images: next });
    setImages(next);
  }

  async function handleDelete() {
    if (!current || active === null) return;
    const nextPortrait = current.role === "portrait" ? "" : portrait;
    const nextBody = current.role === "body" ? "" : body;
    const nextImages =
      current.role === "gallery"
        ? images.filter((_, i) => i !== current.galleryIndex)
        : images;

    await saveCharacterImages(characterId, {
      ...(current.role === "portrait" ? { portraitUrl: null } : {}),
      ...(current.role === "body" ? { bodyUrl: null } : {}),
      ...(current.role === "gallery" ? { images: nextImages } : {}),
    });

    setPortrait(nextPortrait);
    setBody(nextBody);
    setImages(nextImages);
    const remaining =
      (nextPortrait ? 1 : 0) + (nextBody ? 1 : 0) + nextImages.length;
    setActive(remaining === 0 ? null : Math.min(active, remaining - 1));
  }

  async function handleAdd(urls: string[]) {
    const next = [...images, ...urls];
    await saveCharacterImages(characterId, { images: next });
    setImages(next);
    setActive(slots.length);
  }

  if (!slots.length && !manage) return null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {slots.map((slot, i) => (
          <button
            key={`${slot.url}-${i}`}
            type="button"
            onClick={() => setActive(i)}
            aria-label={labelFor(slot)}
            className={`block overflow-hidden rounded-lg border border-zinc-700/60 bg-zinc-900 transition-colors hover:border-zinc-500 ${
              slot.role === "body" ? "aspect-[3/4]" : "aspect-square"
            }`}
          >
            <img
              src={slot.url}
              alt={`${name} ${i + 1}`}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          </button>
        ))}

        {manage ? (
          <button
            type="button"
            onClick={() => setActive(0)}
            aria-label={t("fr.gallery.add")}
            className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-zinc-700/60 bg-zinc-900/40 text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300"
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
        items={items}
        index={active ?? 0}
        onIndexChange={setActive}
        scope="characters"
        onReplace={manage ? handleReplace : undefined}
        onDelete={manage ? handleDelete : undefined}
        onAdd={manage ? handleAdd : undefined}
      />
    </>
  );
}
