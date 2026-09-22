import Link from "next/link";
import GmDiceRoller from "@/components/GmDiceRoller";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kit do Mestre — VKRPG",
};

const shortcuts = [
  { href: "/table/new", label: "Nova mesa" },
  { href: "/character/new", label: "Novo personagem" },
  { href: "/npc/new", label: "Novo NPC" },
  { href: "/item/new", label: "Novo item" },
  { href: "/advantage/new", label: "Nova vantagem" },
  { href: "/disadvantage/new", label: "Nova desvantagem" },
];

export default function NarratorKitPage() {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-green-100">Kit do Mestre</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Role testes rápidos de 3d6 contra qualquer alvo e entre direto na criação
          das suas mesas.
        </p>
      </div>

      <GmDiceRoller />

      <section aria-label="Criação rápida" className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
          Criação rápida
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group flex items-center justify-between gap-3 bg-zinc-800/40 hover:bg-zinc-800/70 border border-zinc-700/50 hover:border-green-900/50 rounded-lg px-4 py-3 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-200 group-hover:text-zinc-100">
                {shortcut.label}
              </span>
              <span aria-hidden className="text-zinc-500 transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-8 text-center">
        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
          &larr; Voltar ao início
        </Link>
      </div>
    </div>
  );
}
