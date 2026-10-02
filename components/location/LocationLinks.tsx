"use client";

/* ============================================================
   LocationLinks — CRUD das passagens (portas/escadas/portais)
   que ligam esta planta a outras. O narrador escolhe o destino,
   o tipo, os andares de origem/destino e o hex "here" desta
   planta; rotas novas: GET/POST /table-location/:id/link(s),
   PUT/DELETE /table-location-link/:id.
   ============================================================ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { submitJson } from "@/components/forms/submit";
import { inputCls, labelCls, submitCls } from "@/components/forms/formStyles";
import { useTranslation } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { Location, LocationConnection } from "@/lib/types";

const LINK_KINDS = ["door", "stairs", "trapdoor", "portal", "bridge", "elevator", "secret"] as const;

interface LocationLinksProps {
  location: Location;
  allLocations?: Location[];
  onChanged?: () => void;
}

const edge = (l: Location) =>
  ({
    id: l.id,
    name: l.name,
    hasGrid: !!(l.hex?.width && l.hex?.height),
  }) as { id: string; name: string; hasGrid: boolean };

export default function LocationLinks({ location, allLocations = [], onChanged }: LocationLinksProps) {
  const { t } = useTranslation();
  const [links, setLinks] = useState<LocationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [kind, setKind] = useState<string>("door");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [toId, setToId] = useState("");
  const [toQ, setToQ] = useState("");
  const [toR, setToR] = useState("");
  const [hereQ, setHereQ] = useState("");
  const [hereR, setHereR] = useState("");
  const [floorFrom, setFloorFrom] = useState(String(location.floor ?? 0));
  const [floorTo, setFloorTo] = useState("");
  const [bidirectional, setBidirectional] = useState(true);

  const targets = useMemo(
    () =>
      allLocations
        .filter((l) => l.id !== location.id)
        .sort(
          (a, b) =>
            Number(!!b.hex?.width && !!b.hex?.height) - Number(!!a.hex?.width && !!a.hex?.height) ||
            (a.name ?? "").localeCompare(b.name ?? "")
        ),
    [allLocations, location.id]
  );

  const reload = useCallback(async () => {
    try {
      const res = await api<{ links: LocationConnection[] }>(`/table-location/${location.id}/links`);
      setLinks(res?.links ?? []);
      setError(null);
    } catch {
      setError("links");
    } finally {
      setLoading(false);
    }
  }, [location.id]);

  useEffect(() => {
    let alive = true;
    api<{ links: LocationConnection[] }>(`/table-location/${location.id}/links`)
      .then((res) => {
        if (!alive) return;
        setLinks(res?.links ?? []);
        setError(null);
      })
      .catch(() => {
        if (alive) setError("links");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [location.id]);

  /* default destination hex positions come from the target's own grid. */
  function pickTo(id: string) {
    setToId(id);
    const target = allLocations.find((l) => l.id === id);
    if (!target) {
      setToQ("");
      setToR("");
      setFloorTo("");
      return;
    }
    const cq = Math.floor((target.hex?.width ?? 0) / 2);
    const cr = Math.floor((target.hex?.height ?? 0) / 2);
    setToQ(String(target.hex?.centerQ ?? cq));
    setToR(String(target.hex?.centerR ?? cr));
    setFloorTo(String(target.floor ?? 0));
  }

  function beginEdit(link: LocationConnection) {
    setEditingId(link.id);
    setKind(link.kind ?? "door");
    setLabel(link.label ?? "");
    setDescription(link.description ?? "");
    const to = link.to;
    setToId(to?.id ?? "");
    setToQ(to?.q != null ? String(to.q) : "");
    setToR(to?.r != null ? String(to.r) : "");
    setFloorTo(link.floorTo != null ? String(link.floorTo) : "0");
    setFloorFrom(link.floorFrom != null ? String(link.floorFrom) : "0");
    setBidirectional(!!link.bidirectional);
  }

  function resetForm() {
    setEditingId(null);
    setKind("door");
    setLabel("");
    setDescription("");
    setToId("");
    setToQ("");
    setToR("");
    setFloorFrom(String(location.floor ?? 0));
    setFloorTo("");
    setBidirectional(true);
  }

  async function save() {
    if (!toId) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await submitJson(`/api/table-location-link/${editingId}`, "PUT", {
          kind,
          label: label.trim() || null,
          description: description.trim() || null,
          to: { id: toId, q: toQ === "" ? null : Number(toQ), r: toR === "" ? null : Number(toR) },
          floorFrom: floorFrom === "" ? null : Number(floorFrom),
          floorTo: floorTo === "" ? null : Number(floorTo),
          bidirectional: bidirectional ? 1 : 0,
        });
      } else {
        await submitJson<{ links?: LocationConnection[] }>(`/api/table-location/${location.id}/link`, "POST", {
          tableId: location.tableId,
          kind,
          label: label.trim() || null,
          description: description.trim() || null,
          from: {
            id: location.id,
            q: hereQ === "" ? null : Number(hereQ),
            r: hereR === "" ? null : Number(hereR),
          },
          to: { id: toId, q: toQ === "" ? null : Number(toQ), r: toR === "" ? null : Number(toR) },
          floorFrom: floorFrom === "" ? null : Number(floorFrom),
          floorTo: floorTo === "" ? null : Number(floorTo),
          bidirectional: bidirectional ? 1 : 0,
        });
      }
      resetForm();
      await reload();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLink(id: string) {
    if (!window.confirm(t("lc.conn.deleteConfirm"))) return;
    setSaving(true);
    setError(null);
    try {
      await submitJson(`/api/table-location-link/${id}`, "DELETE");
      if (editingId === id) resetForm();
      await reload();
      onChanged?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "delete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t("lc.conn.title")}</h3>
        <p className="text-[11px] text-zinc-600 mt-0.5">{t("lc.conn.subtitle")}</p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-600 italic">{t("lc.common.saving")}</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-zinc-600 italic">{t("lc.conn.empty")}</p>
      ) : (
        <ul className="divide-y divide-zinc-700/40 border-y border-zinc-700/40">
          {links.map((link) => {
            const targetName =
              allLocations.find((l) => l.id === link.to?.id)?.name ??
              link.to?.id?.slice(0, 8) ??
              "—";
            return (
              <li key={link.id} className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-zinc-800/70 border border-zinc-700/50 text-zinc-300 shrink-0">
                  {t(`lc.conn.kind.${link.kind}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200 truncate">
                    {link.label || t("lc.conn.kind." + (link.kind ?? "door"))}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-600 truncate">
                    {targetName}
                    {link.floorTo != null ? ` · ${link.floorTo}` : ""}
                    {link.bidirectional ? "" : " ·→"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => beginEdit(link)}
                  className={`${inputCls} !w-auto px-3 py-1 text-[11px] hover:border-zinc-500`}
                >
                  {t("lc.conn.edit")}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => deleteLink(link.id)}
                  className="text-red-400/80 hover:text-red-300 px-1 text-sm disabled:opacity-50"
                  aria-label={t("lc.conn.delete")}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* form */}
      <div className="space-y-4 border-t border-zinc-700/40 pt-5">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          {editingId ? t("lc.conn.edit") : t("lc.conn.add")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>{t("lc.conn.kind")}</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
              {LINK_KINDS.map((k) => (
                <option key={k} value={k}>{t(`lc.conn.kind.${k}`)}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>{t("lc.conn.to")}</label>
            <select value={toId} onChange={(e) => pickTo(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {targets.map((l) => {
                const e = edge(l);
                return (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.hasGrid ? "▪" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>{t("lc.conn.label")}</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder={t("lc.conn.labelPh")} />
          </div>
          <div>
            <label className={labelCls}>{t("lc.conn.floorTo")}</label>
            <input type="number" value={floorTo} onChange={(e) => setFloorTo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>{t("lc.conn.description")}</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} placeholder={t("lc.conn.descriptionPh")} />
          </div>
          <div>
            <label className={labelCls}>{t("lc.conn.floorFrom")}</label>
            <input type="number" value={floorFrom} onChange={(e) => setFloorFrom(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="flex items-center gap-6 flex-wrap text-sm">
          <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
            <input type="checkbox" checked={bidirectional} onChange={(e) => setBidirectional(e.target.checked)} className="accent-amber-500" />
            {t("lc.conn.bidir")}
          </label>
          {!editingId ? (
            <span className="inline-flex items-center gap-2 font-mono text-[11px] text-zinc-500">
              here:
              <input type="number" value={hereQ} onChange={(e) => setHereQ(e.target.value)} className={`${inputCls} !w-16 !py-1`} placeholder="q" />
              <input type="number" value={hereR} onChange={(e) => setHereR(e.target.value)} className={`${inputCls} !w-16 !py-1`} placeholder="r" />
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="button" disabled={saving || !toId} onClick={save} className={`${submitCls} disabled:opacity-50`}>
            {saving ? t("lc.conn.saving") : editingId ? t("fr.saveChanges") : t("lc.conn.save")}
          </button>
          {editingId ? (
            <button type="button" onClick={resetForm} className="text-zinc-400 hover:text-zinc-200 text-sm">
              {t("lc.conn.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}