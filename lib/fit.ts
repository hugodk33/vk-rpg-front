export const FIT_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: "normal", label: "Normal", desc: "Sem ajuste especial" },
  { value: "tailored", label: "Sob medida", desc: "Ajustado ao usuário (pleno efeito)" },
  { value: "loose", label: "Folgada", desc: "Folga para armação pesada" },
  { value: "cheap", label: "Pobre", desc: "Ajuste ruim" },
];

export function fitLabel(fit?: string | null): string {
  if (!fit) return "Unfitted";
  const found = FIT_OPTIONS.find((o) => o.value === fit);
  return found ? found.label : fit.charAt(0).toUpperCase() + fit.slice(1);
}