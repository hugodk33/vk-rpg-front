import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import LocationPlate from "@/components/location/LocationPlate";
import type { Location } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let location: Location | undefined;
  try {
    location = await api<Location>(`/table-location/${id}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

  return <LocationPlate location={location} tableId={location.tableId} />;
}