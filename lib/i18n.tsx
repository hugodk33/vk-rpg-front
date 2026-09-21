"use client";

/* ============================================================
   i18n — idioma da interface (lado cliente).
   Padrão: inglês (en), igual ao restante do app. O idioma fica
   persistido em localStorage + cookie; o layout (server) lê o
   cookie e injeta o idioma inicial aqui (sem mismatch de
   hidratação). O clique no switch troca todas as páginas
   ouvintes na hora.
   HOOK: useTranslation() → { lang, setLang, t }.
   ============================================================ */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_LANG,
  LANGS,
  LANG_COOKIE,
  normalizeLang,
  translate,
  type Lang,
} from "./i18n-core";

export {
  DEFAULT_LANG,
  LANGS,
  STORAGE_KEY,
  interpolate,
  langFromCookieValue,
  normalizeLang,
  translate,
} from "./i18n-core";

const STORAGE_KEY = LANG_COOKIE;
export const EVENT_NAME = "vkrpg:lang";

export function readLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    return normalizeLang(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LANG;
  }
}

export function writeLang(lang: Lang): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* armazenamento indisponível — o idioma fica efêmero */
  }
  try {
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookie indisponível */
  }
}

/* ---------- contexto ------------------------------ */

interface I18nContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    const onLang = () => setLangState(readLang());
    window.addEventListener(EVENT_NAME, onLang);
    return () => window.removeEventListener(EVENT_NAME, onLang);
  }, []);

  const setLang = (next: Lang) => {
    writeLang(next);
    window.dispatchEvent(new Event(EVENT_NAME));
    setLangState(next);
  };

  const t = (key: string) => translate(lang, key);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  const [fallbackLang, setFallback] = useState<Lang>(() => readLang());

  useEffect(() => {
    if (ctx) return;
    const onLang = () => setFallback(readLang());
    window.addEventListener(EVENT_NAME, onLang);
    return () => window.removeEventListener(EVENT_NAME, onLang);
  }, [ctx]);

  const lang = ctx?.lang ?? fallbackLang;
  const setLang = ctx?.setLang ?? ((next: Lang) => {
    writeLang(next);
    window.dispatchEvent(new Event(EVENT_NAME));
    setFallback(next);
  });
  const t = (key: string) => translate(lang, key);

  return { lang, setLang, t };
}