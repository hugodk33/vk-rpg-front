/* ============================================================
   categories — rótulo de categoria a partir do slug canônico.

   As listas da mesa guardam a categoria como slug ('combat',
   'survival', 'Melee'…): a mesma chave estável que o catálogo de
   conteúdo usa. O rótulo traduzido vive em i18n (`cat.<slug>`,
   parts/cat.ts). Slug sem tradução — categoria criada à mão pelo
   narrador — aparece como veio, sem inventar texto.
   ============================================================ */

type TranslateFn = (key: string) => string;

export function categoryLabel(t: TranslateFn, raw?: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const key = `cat.${value.toLowerCase()}`;
  const label = t(key);
  return label === key ? value : label;
}
