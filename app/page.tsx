import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-amber-100 mb-3">VKRPG</h1>
        <p className="text-zinc-400 text-lg">A platform for playing games and telling stories.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Link
          href="/narrator"
          className="block bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6 hover:border-amber-700/50 transition-colors group"
        >
          <div className="text-3xl mb-2">🎲</div>
          <h2 className="text-xl font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">Narrator</h2>
          <p className="text-zinc-500 text-sm mt-1">Manage your tables, scenes, and characters. Guide the story.</p>
        </Link>
        <Link
          href="/player"
          className="block bg-zinc-800/60 border border-zinc-700/50 rounded-xl p-6 hover:border-emerald-700/50 transition-colors group"
        >
          <div className="text-3xl mb-2">⚔️</div>
          <h2 className="text-xl font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">Player</h2>
          <p className="text-zinc-500 text-sm mt-1">View your characters, track your progress, and play the game.</p>
        </Link>
      </div>
    </div>
  );
}
