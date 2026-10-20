/* ============================================================
   Tokens visuais das telas de Narrador.
   Tudo aqui segue a trilha verde de /narrator e de /table/[id]/*
   (ver TableTabs e as listagens), para que criar/editar um
   recurso tenha a mesma moldura das listagens da mesa.
   ============================================================ */

export const inputCls =
  "w-full bg-zinc-900 border border-zinc-600 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-green-600 transition-colors";

export const labelCls =
  "block text-zinc-400 text-sm font-semibold uppercase tracking-wider mb-1.5";

/* CTA verde da trilha do narrador. */
export const submitCls =
  "bg-green-800 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-lg shadow-green-900/30";

export const disabledSubmitCls =
  "bg-zinc-700 text-zinc-500 font-semibold px-6 py-2.5 rounded-lg cursor-not-allowed";

export const cancelCls = "text-zinc-400 hover:text-zinc-300 text-sm transition-colors";
