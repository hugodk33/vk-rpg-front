"use client";

import { LANGS, useTranslation } from "@/lib/i18n";

/* ============================================================
   LanguageSwitch — EN / BR.
   A escolha fica persistida (vkrpg.lang) e o clique dispara
   `vkrpg:lang` para todas as páginas ouvintes trocarem de idioma.
   ============================================================ */

export default function LanguageSwitch() {
  const { lang, setLang } = useTranslation();

  return (
    <div
      role="group"
      aria-label="Idioma"
      className="inline-flex items-center rounded-full border border-zinc-700/60 bg-zinc-900/80 p-0.5"
    >
      {LANGS.map((l) => {
        const active = lang === l.id;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => setLang(l.id)}
            aria-pressed={active}
            title={l.id === "en" ? "English" : "Português (Brasil)"}
            className={`font-mono text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 ${
              active
                ? l.id === "en"
                  ? "bg-blue-500/20 text-blue-300"
                  : "bg-green-500/20 text-green-300"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}