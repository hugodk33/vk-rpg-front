/* ============================================================
   hue — a paleta de cor por nome (sigilos, pontos de assento).
   Compartilhada entre Server e Client Components: quem
   desenha a cor calcula o MESMO matiz do outro lado.
   ============================================================ */

export interface Hue {
  dot: string
  ring: string
}

export const PALETTE: Hue[] = [
  { dot: "#fbbf24", ring: "#fbbf2455" },
  { dot: "#34d399", ring: "#34d39955" },
  { dot: "#38bdf8", ring: "#38bdf855" },
  { dot: "#f472b6", ring: "#f472b655" },
  { dot: "#a78bfa", ring: "#a78bfa55" },
  { dot: "#fb923c", ring: "#fb923c55" },
];

/** Matiz estável por nome — o mesmo nome devolve sempre a mesma cor. */
export function hueFor(name: string): Hue {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return PALETTE[sum % PALETTE.length];
}
