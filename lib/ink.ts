/* ============================================================
   Tinta — o sistema visual das fichas.
   Compartilhado pelas trilhas do narrador e do player para que
   as duas se leiam como a mesma coisa: fundo de tinta, texto em
   pergaminho, títulos em brasa, réguas de latão, rótulos de musgo.
   ============================================================ */

export const INK = {
  /** fundo da página */
  ink: "#0E110D",
  /** painel sobre o fundo */
  panel: "#182018",
  /** texto principal */
  parchment: "#EDE6CE",
  /** acento: títulos de seção, números, foco */
  ember: "#E07B3A",
  /** bordas e réguas */
  brass: "#A9A177",
  /** rótulos e texto de apoio */
  moss: "#7E876A",
} as const;

/** Fundo da página: tinta com um halo de tom de pedra no alto. */
export const INK_PAGE =
  `radial-gradient(1100px 500px at 20% -10%, #18201866, transparent 60%), ${INK.ink}`;

/** Rótulo utilitário: versalete monoespaçado, como nos rótulos do manuscrito. */
export const INK_LABEL = "font-mono uppercase tracking-[0.14em] text-[11px]";

/** Painel padrão das fichas. */
export const INK_PANEL = "rounded-xl border border-[#A9A177]/25 bg-[#182018]/70 p-5";

/** Campo de texto: só a régua, como tinta em pergaminho. */
export const INK_FIELD =
  "w-full bg-transparent border-b border-[#A9A177]/40 text-base text-[#EDE6CE] py-2.5 focus:outline-none focus:border-[#E07B3A] transition-colors";

export const INK_FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E07B3A]/70";

/** Selo pequeno de regra (usado nas tags do player e nas fichas). */
export const INK_CHIP =
  "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border border-[#A9A177]/30 text-[#A9A177]";

/** Botão de confirmação verde do narrador / azul do player. */
export function inkButton(tone: "narrator" | "player"): string {
  return tone === "narrator"
    ? "text-sm font-semibold px-6 py-2.5 rounded-lg text-white bg-green-800 hover:bg-green-700 shadow-lg shadow-green-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-green-700/70"
    : "text-sm font-semibold px-6 py-2.5 rounded-lg text-blue-950 bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70";
}
