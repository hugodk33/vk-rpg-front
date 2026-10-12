"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import FormShell from "./FormShell";
import { LOCATION_KINDS, absoluteHex, formatHexScale } from "@/lib/location";
import { useTranslation } from "@/lib/i18n";
import type { Location } from "@/lib/types";

export interface LocationFormProps {
  initial?: Location;
  tableId?: string;
  tableTitle?: string;
  allLocations?: Location[];
  defaultParentId?: string;
  defaultKind?: string;
  /** Renderizar sem a moldura de cartão (usado dentro do editor). */
  embedded?: boolean;
}

const IS_BATTLE: Array<{ value: string; label: string }> = [
  { value: "flat", label: "fr.loc.orientation.flat" },
  { value: "pointy", label: "fr.loc.orientation.pointy" },
  { value: "square", label: "fr.loc.orientation.square" },
];

function rankOf(kind?: string): number {
  const i = LOCATION_KINDS.findIndex((k) => k.value === kind);
  return i === -1 ? -1 : i;
}

export default function LocationForm({
  initial,
  tableId,
  tableTitle,
  allLocations = [],
  defaultParentId,
  defaultKind,
  embedded = false,
}: LocationFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isEdit = !!initial;
  const locId = initial?.id ?? "";
  const h = initial?.hex;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.tableId ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? defaultKind ?? "site");
  const [parentId, setParentId] = useState<string>(initial?.parentId ?? defaultParentId ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [subRegion, setSubRegion] = useState(initial?.subRegion ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [other, setOther] = useState(initial?.other ?? "");
  const [shopName, setShopName] = useState(initial?.shopName ?? "");
  const [indoor, setIndoor] = useState(!!initial?.isIndoor);
  const [sizeM, setSizeM] = useState(h?.sizeM != null ? String(h.sizeM) : "");
  const [width, setWidth] = useState(h?.width != null ? String(h.width) : "");
  const [height, setHeight] = useState(h?.height != null ? String(h.height) : "");
  const [centerQ, setCenterQ] = useState(h?.centerQ != null ? String(h.centerQ) : "0");
  const [centerR, setCenterR] = useState(h?.centerR != null ? String(h.centerR) : "0");
  const [orientation, setOrientation] = useState(h?.orientation ?? "flat");
  const [rotationDeg, setRotationDeg] = useState(h?.rotationDeg != null ? String(h.rotationDeg) : "0");
  const [floor, setFloor] = useState(initial?.floor != null ? String(initial.floor) : "");
  const [floorName, setFloorName] = useState(initial?.floorName ?? "");

  const [kindEdited, setKindEdited] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizeNum = sizeM === "" ? null : Number(sizeM);

  const parentOptions = useMemo(
    () =>
      allLocations
        .filter((l) => {
          if (l.id === locId) return false;
          if (initial?.path && l.path?.startsWith(initial.path)) return false;
          return true;
        })
        .sort(
          (a, b) =>
            (a.level ?? 0) - (b.level ?? 0) || (a.name ?? "").localeCompare(b.name ?? "")
        ),
    [allLocations, locId, initial]
  );

  function handleParentChange(next: string) {
    setParentId(next);
    if (kindEdited || !next) return;
    const p = allLocations.find((l) => l.id === next);
    const r = rankOf(p?.kind);
    if (r >= 0 && r + 1 < LOCATION_KINDS.length) setKind(LOCATION_KINDS[r + 1].value);
  }

  const preview = useMemo(
    () =>
      absoluteHex({
        id: locId,
        name,
        hex: { sizeM: sizeNum, centerQ: Number(centerQ || 0), centerR: Number(centerR || 0), orientation },
        ancestors: initial?.ancestors,
      }),
    [locId, name, sizeNum, centerQ, centerR, orientation, initial]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTableId) {
      setError(t("fr.error.selectTable"));
      return;
    }
    if (!name.trim()) {
      setError(t("fr.err.locationName"));
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      ...(isEdit ? { id: locId } : {}),
      table_id: currentTableId,
      parent_id: parentId || null,
      kind,
      name,
      region,
      sub_region: subRegion,
      address,
      country,
      area,
      dimensions,
      description,
      other,
      shop_name: shopName.trim() || null,
      is_indoor: indoor ? 1 : 0,
      floor: floor === "" ? null : Number(floor),
      floor_name: floorName.trim() || null,
      hex: {
        sizeM: sizeNum,
        width: width === "" ? null : Number(width),
        height: height === "" ? null : Number(height),
        centerQ: Number(centerQ || 0),
        centerR: Number(centerR || 0),
        orientation,
        rotationDeg: Number(rotationDeg || 0),
      },
    };

    try {
      if (isEdit) {
        await submitJson(`/api/table-location/${locId}`, "PUT", payload);
        router.push(`/location/${locId}`);
      } else {
        const created = await submitJson<Location>("/api/table-location", "POST", payload);
        router.push(`/location/${created.id}`);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.err.location"));
      setSaving(false);
    }
  }

  const contextTableId = tableId ?? initial?.tableId ?? "";
  const contextTableTitle = tableTitle;

  return (
    <FormShell
      tableId={contextTableId || undefined}
      tableTitle={contextTableTitle}
      resourceLabel="nav.locations"
      actionLabel={isEdit ? "fr.loc.editTitle" : "fr.loc.newTitle"}
      title={isEdit ? t("fr.loc.editTitle") : t("fr.loc.newTitle")}
      subtitle={t("fr.loc.subtitle")}
      wide
      embedded={embedded}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.name")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder={t("fr.loc.namePh")} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.loc.parent")}</label>
              <select value={parentId} onChange={(e) => handleParentChange(e.target.value)} className={inputCls}>
                <option value="">{t("fr.loc.noParent")}</option>
                {parentOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {"· ".repeat(Math.max(0, l.level ?? 0))}
                    {l.name}
                    {l.kind ? ` (${l.kind})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>{t("fr.loc.territoryType")}</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {LOCATION_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => {
                    setKind(k.value);
                    setKindEdited(true);
                  }}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${kind === k.value
                    ? "border-amber-500/70 bg-amber-900/20"
                    : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600"
                  }`}
                >
                  <span className="block text-sm font-medium text-zinc-200">{t(`fr.loc.kind.${k.value}`)}</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">{t(`fr.loc.kindD.${k.value}`)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-700/40 pt-5">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t("fr.loc.hexGrid")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>{t("fr.loc.hex")}</label>
                <input type="number" step="0.1" min="0" value={sizeM} onChange={(e) => setSizeM(e.target.value)} className={inputCls} placeholder={t("fr.loc.hexPh")} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.width")}</label>
                <input type="number" step="1" min="0" value={width} onChange={(e) => setWidth(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.height")}</label>
                <input type="number" step="1" min="0" value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.orientation")}</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as "flat" | "pointy" | "square")} className={inputCls}>
                  {IS_BATTLE.map((o) => (
                    <option key={o.value} value={o.value}>{t(o.label)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.centerQ")}</label>
                <input type="number" value={centerQ} onChange={(e) => setCenterQ(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.centerR")}</label>
                <input type="number" value={centerR} onChange={(e) => setCenterR(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.rotation")}</label>
                <input type="number" step="15" value={rotationDeg} onChange={(e) => setRotationDeg(e.target.value)} className={inputCls} placeholder={t("fr.loc.rotationPh")} />
              </div>
              <div className="flex items-end">
                <label className={`${inputCls} flex items-center gap-2 cursor-pointer py-2.5`}>
                  <input type="checkbox" checked={indoor} onChange={(e) => setIndoor(e.target.checked)} className="accent-amber-500" />
                  <span className="text-sm text-zinc-300 font-medium">{t("fr.loc.indoor")}</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>{t("fr.loc.floor")}</label>
                <input type="number" step="1" value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} placeholder={t("fr.loc.floorPh")} />
              </div>
              <div className="md:col-span-3">
                <label className={labelCls}>{t("fr.loc.floorName")}</label>
                <input value={floorName} onChange={(e) => setFloorName(e.target.value)} className={inputCls} placeholder={t("fr.loc.floorNamePh")} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
              <span>{t("fr.loc.scale")} <span className="text-zinc-300 font-semibold">{formatHexScale(sizeNum)}</span></span>
              <span aria-hidden>·</span>
              <span>
                {t("fr.loc.absQr")} <span className="font-mono text-zinc-300">q{preview.q}·r{preview.r}</span>{" "}
                <span className="text-zinc-600">{t("fr.loc.reduced")}</span>
              </span>
              {sizeNum != null && sizeNum <= 2 ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 uppercase tracking-widest font-semibold">
                  {t("fr.loc.battlemap")}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-700/40 pt-5">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t("fr.loc.survey")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>{t("fr.loc.region")}</label>
                <input value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.subRegion")}</label>
                <input value={subRegion} onChange={(e) => setSubRegion(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.address")}</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.country")}</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.area")}</label>
                <input value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.loc.dimensions")}</label>
                <input value={dimensions} onChange={(e) => setDimensions(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-700/40 pt-5">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t("fr.loc.shop")}</h3>
            <p className="text-[11px] text-zinc-600">{t("fr.loc.shopHint")}</p>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className={inputCls}
              placeholder={t("fr.loc.shopPh")}
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>{t("fr.description")}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.loc.notes")}</label>
              <textarea value={other} onChange={(e) => setOther(e.target.value)} rows={2} className={inputCls} />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? t("fr.saving") : isEdit ? t("fr.saveChanges") : t("fr.loc.create")}
            </button>
            <Link
              href={isEdit ? `/location/${locId}` : currentTableId ? `/table/${currentTableId}/locations` : "/narrator"}
              className={cancelCls}
            >
              {t("fr.cancel")}
            </Link>
          </div>
        </form>
    </FormShell>
  );
}