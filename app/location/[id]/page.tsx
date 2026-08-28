import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import LocationPlate from "@/components/location/LocationPlate";

export const dynamic = "force-dynamic";

interface LocationDetail {
  id: string;
  name?: string;
  region?: string;
  sub_region?: string;
  address?: string;
  is_indoor?: number | boolean;
  country?: string;
  area?: string;
  dimensions?: string;
  description?: string;
  other?: string;
  table_id?: string;
  table_title?: string;
}

export default async function LocationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let location: LocationDetail | undefined;
  try {
    location = await api<LocationDetail>(`/table-location/${id}`);
  } catch {
    location = undefined;
  }
  if (!location) notFound();

  return <LocationPlate location={location} tableId={location.table_id} />;
}
