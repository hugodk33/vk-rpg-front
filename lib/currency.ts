/* ============================================================
   Moedas da mesa — catálogo padrão, no mesmo formato do
   LOCATION_KINDS. A maioria das campanhas usa UMA moeda fixa,
   então o padrão já vem escolhido: o mecanismo de várias moedas
   é para quem realmente precisa dele.
   ============================================================ */

export interface CurrencyPreset {
  /** Identificador do preset; também a chave de tradução. */
  value: string
  /** Nome do item que representa a moeda. */
  name: string
  /** Rótulo curto, espelhando LOCATION_KINDS. */
  label: string
  /** Como o preço aparece: "1200 $". */
  symbol: string
}

export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { value: "generic", name: "Moeda", label: "Moeda padrão", symbol: "$" },
  { value: "crown", name: "Coroa", label: "Coroa", symbol: "cr" },
  { value: "gold", name: "Ouro", label: "Ouro", symbol: "Au" },
  { value: "silver", name: "Prata", label: "Prata", symbol: "Ag" },
  { value: "copper", name: "Cobre", label: "Cobre", symbol: "Cu" },
  { value: "crystal", name: "Cristal", label: "Cristal", symbol: "cr" },
  { value: "credits", name: "Créditos", label: "Créditos", symbol: "cr" },
  { value: "bone", name: "Ossos", label: "Ossos", symbol: "bn" },
];

/** A moeda que a mesa já começa com — o caso comum de moeda única. */
export const DEFAULT_CURRENCY_PRESET = CURRENCY_PRESETS[0];

/** Aceita o `value` do preset ou o nome do item-moeda ("Ouro" -> preset gold). */
export function findCurrencyPreset(value?: string | null): CurrencyPreset | undefined {
  if (!value) return undefined;
  const key = value.trim().toLowerCase();
  return CURRENCY_PRESETS.find(
    (p) => p.value === key || p.name.toLowerCase() === key || p.label.toLowerCase() === key
  );
}

/** Formata um preço na moeda: "1200 $" ou "1200 Cr". */
export function formatPrice(amount: number, preset?: CurrencyPreset | null, fallbackName?: string): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0;
  const suffix = preset?.symbol ?? (fallbackName ? ` ${fallbackName}` : "");
  return `${n.toLocaleString("pt-BR")}${suffix ? ` ${suffix}` : ""}`;
}
