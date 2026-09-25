import { translate, type Lang } from "./i18n-core";

export const FIT_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: "normal", label: "fit.normal", desc: "fit.d.normal" },
  { value: "tailored", label: "fit.tailored", desc: "fit.d.tailored" },
  { value: "loose", label: "fit.loose", desc: "fit.d.loose" },
  { value: "cheap", label: "fit.cheap", desc: "fit.d.cheap" },
];

export function fitLabel(fit: string | null | undefined, lang: Lang): string {
  if (!fit) return translate(lang, "fit.none");
  const found = FIT_OPTIONS.find((o) => o.value === fit);
  if (found) return translate(lang, found.label);
  return fit.charAt(0).toUpperCase() + fit.slice(1);
}