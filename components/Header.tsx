"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LanguageSwitch from "./LanguageSwitch";

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const tableId = (() => {
    const m = pathname?.match(/^\/(?:table|player\/table)\/([^/]+)/);
    return m ? m[1] : undefined;
  })();

  const charNewHref = tableId
    ? `/character/new?table_id=${tableId}`
    : "/character/new";

  const linkClass =
    "block px-4 py-2 text-sm text-zinc-300 hover:text-green-500 hover:bg-zinc-700/50";

  return (
    <header className="bg-zinc-800/90 border-b border-zinc-700/50 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 relative">
        <div className="flex items-center justify-center h-14">
          <div className="w-14"></div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <LanguageSwitch />
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-amber-400 font-bold text-xl tracking-tight"
          >
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            ShieldFrog
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-700/50 focus:outline-none"
            aria-label="Menu"
          >
            {open ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
        {open && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-0 w-52 bg-zinc-800 border border-zinc-700/60 rounded-lg shadow-xl py-2 z-50 text-center">
            <Link href="/" className={linkClass}>Início</Link>
            <div className="text-zinc-500 text-xs uppercase tracking-wider px-4 pt-3 pb-1">Novo</div>
            <Link href="/table/new" className={linkClass}>Mesa</Link>
            <Link href={charNewHref} className={linkClass}>Personagem</Link>
            <Link href="/npc/new" className={linkClass}>NPC</Link>
            <Link href="/item/new" className={linkClass}>Item</Link>
            <Link href="/advantage/new" className={linkClass}>Vantagem</Link>
            <Link href="/disadvantage/new" className={linkClass}>Desvantagem</Link>
            <div className="text-zinc-500 text-xs uppercase tracking-wider px-4 pt-3 pb-1">Painéis</div>
            <Link href="/narrator" className={linkClass}>Narrador</Link>
            <Link href="/player" className={linkClass}>Jogador</Link>
          </div>
        )}
      </div>
    </header>
  );
}
