import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { PublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user: PublicUser | undefined;
  try {
    user = await api<PublicUser>(`/users/${id}`);
  } catch {
    user = undefined;
  }
  if (!user) notFound();

  const typeLabel = user.type === 2 ? "Admin" : "Player";

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
        &larr; Back to home
      </Link>

      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden">
        <div className="py-5 px-6 border-b border-zinc-700/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-100">{user.username || "Unnamed User"}</h1>
              <span className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded ${user.type === 2 ? "bg-amber-900/40 text-amber-300" : "bg-emerald-900/40 text-emerald-300"}`}>
                {typeLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {user.email ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
                <span className="text-zinc-500 text-xs uppercase block mb-1">Email</span>
                <span className="text-zinc-200 text-sm font-medium">{user.email}</span>
              </div>
            ) : null}
            {user.phone ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3">
                <span className="text-zinc-500 text-xs uppercase block mb-1">Phone</span>
                <span className="text-zinc-200 text-sm font-medium">{user.phone}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
