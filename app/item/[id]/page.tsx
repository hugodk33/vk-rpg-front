import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let item: Item | undefined;
  try {
    item = await api<Item>(`/game-table-item/${id}`);
  } catch {
    item = undefined;
  }
  if (!item) notFound();

  const tableId = item.table_id;
  const isWeapon = !!item.damage_id;
  const isArmor = !!item.armor_id;
  const typeName = item.type === 1 ? "Weapon" : item.type === 2 ? "Armor" : item.type === 3 ? "Equipment" : null;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          &larr; Back to table
        </Link>
      ) : null}

      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden">
        <div className="py-5 px-6 border-b border-zinc-700/40">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-amber-100">{item.name || "Unnamed Item"}</h1>
              <div className="flex items-center gap-2 mt-1">
                {typeName ? <span className="text-xs text-zinc-500 uppercase tracking-wider">{typeName}</span> : null}
                {item.category ? <span className="text-xs text-zinc-600">·</span> : null}
                {item.category ? <span className="text-xs text-zinc-500 uppercase tracking-wider">{item.category}</span> : null}
              </div>
            </div>
            {item.weight != null ? <span className="text-zinc-500 text-sm">{item.weight} kg</span> : null}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {item.description ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Description</h3>
              <p className="text-zinc-300 text-sm">{item.description}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {item.quality ? (
              <div className="bg-zinc-800/40 rounded-lg px-3 py-2 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Quality</span>
                <span className="text-zinc-200 text-sm font-medium">{item.quality}</span>
              </div>
            ) : null}
            {item.condition ? (
              <div className="bg-zinc-800/40 rounded-lg px-3 py-2 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Condition</span>
                <span className="text-zinc-200 text-sm font-medium">{item.condition}</span>
              </div>
            ) : null}
            {item.dimensions ? (
              <div className="bg-zinc-800/40 rounded-lg px-3 py-2 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Dimensions</span>
                <span className="text-zinc-200 text-sm font-medium">{item.dimensions}</span>
              </div>
            ) : null}
            {item.skill_level ? (
              <div className="bg-zinc-800/40 rounded-lg px-3 py-2 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Skill Required</span>
                <span className="text-zinc-200 text-sm font-medium">{item.skill_level}</span>
              </div>
            ) : null}
          </div>

          {(item.holder_id || item.owner_id || item.skill_user_id) ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Ownership</h3>
              <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-lg px-4 py-3 space-y-2">
                {item.owner_id ? (
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-zinc-500 text-xs uppercase w-20">Owner</span>
                    <Link href={`/user/${item.owner_id}`} className="text-zinc-200 text-sm hover:text-amber-300 transition-colors">
                      {item.owner_username || item.owner_id}
                    </Link>
                  </div>
                ) : null}
                {item.holder_id ? (
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                    </svg>
                    <span className="text-zinc-500 text-xs uppercase w-20">Holder</span>
                    <Link href={`/user/${item.holder_id}`} className="text-zinc-200 text-sm hover:text-blue-300 transition-colors">
                      {item.holder_username || item.holder_id}
                    </Link>
                  </div>
                ) : null}
                {item.skill_user_id ? (
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span className="text-zinc-500 text-xs uppercase w-20">Skill User</span>
                    <Link href={`/user/${item.skill_user_id}`} className="text-zinc-200 text-sm hover:text-purple-300 transition-colors">
                      {item.skill_user_username || item.skill_user_id}
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {isWeapon ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
                </svg>
                Weapon
              </h3>
              <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
                <div className="flex flex-wrap gap-4">
                  {item.damage_name ? (
                    <div>
                      <span className="text-zinc-500 text-xs uppercase">Name</span>
                      <p className="text-zinc-200 text-sm font-medium">{item.damage_name}</p>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">Damage</span>
                    <p className="text-red-300 font-bold text-lg">{item.damage_value || "—"}</p>
                  </div>
                  {item.damage_range ? (
                    <div>
                      <span className="text-zinc-500 text-xs uppercase">Range</span>
                      <p className="text-zinc-200 text-sm">{item.damage_range}</p>
                    </div>
                  ) : null}
                  {item.damage_type ? (
                    <div>
                      <span className="text-zinc-500 text-xs uppercase">Type</span>
                      <p className="text-zinc-200 text-sm">{item.damage_type}{item.damage_subtype ? `/${item.damage_subtype}` : ""}</p>
                    </div>
                  ) : null}
                </div>
                {item.damage_description ? <p className="text-zinc-500 text-xs mt-2">{item.damage_description}</p> : null}
              </div>
            </div>
          ) : null}

          {isArmor ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Armor
              </h3>
              <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg px-4 py-3">
                <div className="flex flex-wrap gap-4">
                  {item.armor_name ? (
                    <div>
                      <span className="text-zinc-500 text-xs uppercase">Name</span>
                      <p className="text-zinc-200 text-sm font-medium">{item.armor_name}</p>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-zinc-500 text-xs uppercase">DR</span>
                    <p className="text-cyan-300 font-bold text-lg">{item.armor_value || "—"}</p>
                  </div>
                  {item.armor_fit ? (
                    <div>
                      <span className="text-zinc-500 text-xs uppercase">Fit</span>
                      <p className="text-zinc-200 text-sm">{item.armor_fit}</p>
                    </div>
                  ) : null}
                  {item.armor_type ? (
                    <div>
                      <span className="text-zinc-500 text-xs uppercase">Type</span>
                      <p className="text-zinc-200 text-sm">{item.armor_type}{item.armor_subtype ? `/${item.armor_subtype}` : ""}</p>
                    </div>
                  ) : null}
                </div>
                {item.armor_description ? <p className="text-zinc-500 text-xs mt-2">{item.armor_description}</p> : null}
              </div>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <Link href={`/item/${item.id}/edit`} className="bg-amber-700/60 hover:bg-amber-600 text-amber-100 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Edit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
