"use client";

/* ============================================================
   imagecache — module-level cache of decoded <img> elements for
   urls served from /uploads. Shared by every canvas renderer so a
   picture is fetched once per session, not per repaint.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";

const MISSING = Symbol("missing");
const cache = new Map<string, HTMLImageElement | symbol>();

/** Resolve a url to a loaded image element (null until loaded / on error). */
export function getCachedImage(url: string): HTMLImageElement | null {
  const hit = cache.get(url);
  return hit && hit !== MISSING && hit instanceof HTMLImageElement ? hit : null;
}

/** Load every url once; re-renders the consumer as the images arrive. */
export function useImageCache(urls: Array<string | null | undefined>): Map<string, HTMLImageElement | null> {
  const [version, setVersion] = useState(0);
  const key = urls.filter((u): u is string => !!u).join("\u0000");

  useEffect(() => {
    const list = key ? key.split("\u0000") : [];
    if (!list.length || typeof Image === "undefined") return;
    let cancelled = false;
    let pending = 0;
    for (const url of list) {
      if (cache.has(url)) continue;
      pending++;
      const img = new Image();
      img.crossOrigin = "anonymous";
      const settle = (ok: boolean) => {
        cache.set(url, ok ? img : MISSING);
        if (!cancelled && --pending === 0) setVersion((v) => v + 1);
      };
      img.onload = () => settle(true);
      img.onerror = () => settle(false);
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  return useMemo(() => {
    const list = key ? key.split("\u0000") : [];
    const out = new Map<string, HTMLImageElement | null>();
    for (const url of list) out.set(url, getCachedImage(url));
    return out;
    // `version` forces a rebuild once the fetches settle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);
}
