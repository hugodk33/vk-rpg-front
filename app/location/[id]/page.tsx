import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";

interface LocationDetail {
  id: string;
  name?: string;
  region?: string;
  sub_region?: string;
  address?: string;
  is_indoor?: number;
  country?: string;
  area?: string;
  dimensions?: string;
  description?: string;
  other?: string;
  table_id?: string;
  table_title?: string;
}

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let location: LocationDetail | undefined;
  try {
    location = await api<LocationDetail>(`/table-location/${id}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

  const tableId = location.table_id;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {tableId ? (
        <Link href={`/table/${tableId}`} className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 inline-block transition-colors">
          &larr; Back to table
        </Link>
      ) : null}

      <div className="bg-zinc-900/90 border border-zinc-700/50 shadow-2xl rounded-xl overflow-hidden">
        <div className="py-5 px-6 border-b border-zinc-700/40">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <h1 className="text-2xl font-bold text-amber-100">{location.name || "Unnamed Location"}</h1>
              {location.region ? (
                <span className="text-xs text-zinc-500 uppercase tracking-wider">
                  {location.region}{location.sub_region ? ` / ${location.sub_region}` : ""}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {location.description ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Description</h3>
              <p className="text-zinc-300 text-sm">{location.description}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {location.address ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Address</span>
                <span className="text-zinc-200 text-sm font-medium">{location.address}</span>
              </div>
            ) : null}
            {location.country ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Country</span>
                <span className="text-zinc-200 text-sm font-medium">{location.country}</span>
              </div>
            ) : null}
            {location.area ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Area</span>
                <span className="text-zinc-200 text-sm font-medium">{location.area}</span>
              </div>
            ) : null}
            {location.dimensions ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Dimensions</span>
                <span className="text-zinc-200 text-sm font-medium">{location.dimensions}</span>
              </div>
            ) : null}
            {location.is_indoor != null ? (
              <div className="bg-zinc-800/40 rounded-lg px-4 py-3 text-center">
                <span className="text-zinc-500 text-xs uppercase block">Indoor</span>
                <span className="text-zinc-200 text-sm font-medium">{location.is_indoor ? "Yes" : "No"}</span>
              </div>
            ) : null}
          </div>

          {location.other ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Other Details</h3>
              <p className="text-zinc-300 text-sm">{location.other}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
