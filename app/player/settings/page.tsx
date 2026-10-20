import Link from "next/link";
import { getLang, makeT } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

/* Área de configurações do jogador: reúne atalhos para o que já existe
   (perspectiva, mesa, ficha, sessão). Fácil de estender com mais opções
   sem inflar o painel principal. */
export default async function PlayerSettingsPage() {
  const t = makeT(await getLang());

  const items = [
    { href: "/player", label: t("pg.player.company") },
    { href: "/player/character", label: t("nav.characters") },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header className="border-l-2 border-blue-600 pl-5 mb-8">
        <p className="font-mono text-[10px] tracking-widest uppercase text-blue-400">{t("pg.player.eyebrow")}</p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 mt-2">Configurações</h1>
        <p className="text-sm text-zinc-500 mt-2">Opções do jogador.</p>
      </header>

      <div className="rounded-2xl border border-zinc-700/50 bg-zinc-900/60 divide-y divide-zinc-800/70">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition-colors"
          >
            <span className="text-sm text-zinc-200">{item.label}</span>
            <span className="text-zinc-600">→</span>
          </Link>
        ))}
      </div>

      <div className="mt-6">
        <Link href="/player" className="text-sm text-zinc-500 hover:text-blue-300 transition-colors">
          {t("pg.backHome")}
        </Link>
      </div>
    </div>
  );
}
