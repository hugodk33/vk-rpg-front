import Link from "next/link";
import { getLang, makeT } from "@/lib/i18n-server";

export default async function Home() {
  const t = makeT(await getLang());

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-amber-100 mb-3">VKRPG</h1>
        <p className="text-zinc-400 text-lg">{t("pg.home.subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Link
          href="/narrator"
          className="block bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6 hover:border-green-900/50 transition-colors group"
        >
          <div className="text-3xl mb-2">🎲</div>
          <h2 className="text-xl font-bold text-zinc-100 group-hover:text-green-500 transition-colors">{t("f.narrator")}</h2>
          <p className="text-zinc-500 text-sm mt-1">{t("pg.home.narratorDesc")}</p>
        </Link>
        <Link
          href="/player"
          className="block bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6 hover:border-blue-700/50 transition-colors group"
        >
          <div className="text-3xl mb-2">⚔️</div>
          <h2 className="text-xl font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">{t("ps.player")}</h2>
          <p className="text-zinc-500 text-sm mt-1">{t("pg.home.playerDesc")}</p>
        </Link>
      </div>
    </div>
  );
}
