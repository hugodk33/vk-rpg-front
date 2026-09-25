/* ============================================================
   i18n-server — leitura de idioma no SERVER (Server Components).
   O layout já lê o cookie vkrpg.lang; aqui centralizamos o padrão
   para páginas e componentes de servidor que precisam traduzir
   texto da própria casca (títulos, breadcrumbs, vazios).
   ============================================================ */

import { cookies } from "next/headers";
import {
  LANG_COOKIE,
  langFromCookieValue,
  translate,
  type Lang,
} from "./i18n-core";

export async function getLang(): Promise<Lang> {
  const jar = await cookies();
  return langFromCookieValue(jar.get(LANG_COOKIE)?.value);
}

export function makeT(lang: Lang) {
  return (key: string): string => translate(lang, key);
}

export type ServerT = ReturnType<typeof makeT>;