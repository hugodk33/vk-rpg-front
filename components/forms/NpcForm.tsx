"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import { useTranslation } from "@/lib/i18n";
import type { GameTableLocations, NpcViewer } from "@/lib/types";

export interface NpcFormProps {
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  initial?: NpcViewer;
  defaultLocationId?: string;
}

const STATUSES = [
  { value: "ally", label: "fr.status.ally" },
  { value: "neutral", label: "fr.status.neutral" },
  { value: "enemy", label: "fr.status.enemy" },
  { value: "boss", label: "fr.status.boss" },
];

const ATTRS: Array<{ key: "st" | "dx" | "iq" | "ht"; label: string }> = [
  { key: "st", label: "ST" },
  { key: "dx", label: "DX" },
  { key: "iq", label: "IQ" },
  { key: "ht", label: "HT" },
];

export default function NpcForm({ tableId, tables, initial, defaultLocationId }: NpcFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isEdit = !!initial;
  const sheet = initial?.character?.sheet;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table?.id ?? "");
  const [locationId, setLocationId] = useState(initial?.npc?.location_id ?? defaultLocationId ?? "");
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState(sheet?.name ?? initial?.character?.name ?? "");
  const [points, setPoints] = useState(sheet?.points != null ? String(sheet.points) : "");
  const [status, setStatus] = useState(initial?.npc?.status ?? "neutral");
  const [st, setSt] = useState(sheet?.st != null ? String(sheet.st) : "10");
  const [dx, setDx] = useState(sheet?.dx != null ? String(sheet.dx) : "10");
  const [iq, setIq] = useState(sheet?.iq != null ? String(sheet.iq) : "10");
  const [ht, setHt] = useState(sheet?.ht != null ? String(sheet.ht) : "10");
  const [hp, setHp] = useState(sheet?.hp != null ? String(sheet.hp) : "10");
  const [fatigue, setFatigue] = useState(sheet?.fatigue != null ? String(sheet.fatigue) : "10");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTableId) return;
    let cancel = false;
    api<GameTableLocations>(`/game-table-locations/${currentTableId}`)
      .then((d) => {
        if (cancel) return;
        setLocationOptions((d.locations ?? []).map((l) => ({ id: l.id, name: l.name })));
      })
      .catch(() => {
        if (cancel) return;
        setLocationOptions([]);
      });
    return () => {
      cancel = true;
    };
  }, [currentTableId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTableId) {
      setError(t("fr.error.selectTable"));
      return;
    }
    setSaving(true);
    setError(null);
    const payload = isEdit
      ? {
          id: initial!.npc.id,
          character_id: initial!.character.id,
          status,
          location_id: locationId || null,
        }
      : {
          table_id: currentTableId,
          user_id: null,
          status,
          location_id: locationId || null,
          sheet: {
            name,
            bio: "",
            backstory: "",
            points: points === "" ? 0 : Number(points),
            hp: hp === "" ? 10 : Number(hp),
            st: st === "" ? 10 : Number(st),
            dx: dx === "" ? 10 : Number(dx),
            iq: iq === "" ? 10 : Number(iq),
            ht: ht === "" ? 10 : Number(ht),
            fatigue: fatigue === "" ? 10 : Number(fatigue),
            encumbrance: "None",
          },
          advantages: [],
          disadvantages: [],
          skills: [],
        };
    try {
      await submitJson<{ success?: boolean }>("/api/game-table-npc", isEdit ? "PUT" : "POST", payload);
      router.push(`/table/${currentTableId}/scenes`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("fr.err.npc"));
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-green-100 mb-6">
          {isEdit ? t("fr.npc.editTitle") : t("fr.npc.newTitle")}
        </h1>

        {isEdit ? (
          <p className="text-[11px] text-zinc-500 mb-4">{t("fr.npc.editHint")}</p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isEdit && !tableId ? (
            <div>
              <label className={labelCls}>{t("fr.table")}</label>
              <select
                value={currentTableId}
                onChange={(e) => setCurrentTableId(e.target.value)}
                required
                className={inputCls}
              >
                <option value="" disabled>
                  {t("fr.pickTable")}
                </option>
                {(tables ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="border-b border-zinc-700/40 pb-4">
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">{t("fr.identity")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("fr.name")}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required disabled={isEdit} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("fr.points")}</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  disabled={isEdit}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className={labelCls}>{t("fr.status")}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.label)}
                  </option>
                ))}
              </select>
            </div>
            {locationOptions.length > 0 ? (
              <div className="mt-4">
                <label className={labelCls}>{t("fr.loc.link")}</label>
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
                  <option value="">{t("fr.loc.noLink")}</option>
                  {locationOptions.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-zinc-600 mt-1">{t("fr.loc.linkHintNpc")}</p>
              </div>
            ) : null}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-zinc-300 mb-4">{t("fr.attributes")}</h2>
            <div className="grid grid-cols-4 gap-3">
              {ATTRS.map(({ key, label }) => {
                const value = { st, dx, iq, ht }[key];
                const setters: Record<"st" | "dx" | "iq" | "ht", (v: string) => void> = {
                  st: setSt,
                  dx: setDx,
                  iq: setIq,
                  ht: setHt,
                };
                return (
                  <div key={key}>
                    <label className={`${labelCls} text-center`}>{label}</label>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) => setters[key](e.target.value)}
                      disabled={isEdit}
                      className={`${inputCls} text-center`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.hp")}</label>
              <input type="number" value={hp} onChange={(e) => setHp(e.target.value)} disabled={isEdit} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.fp")}</label>
              <input
                type="number"
                value={fatigue}
                onChange={(e) => setFatigue(e.target.value)}
                disabled={isEdit}
                className={inputCls}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? t("fr.saving") : isEdit ? t("fr.saveChanges") : t("fr.npc.create")}
            </button>
            <a href={currentTableId ? `/table/${currentTableId}/scenes` : "/narrator"} className={cancelCls}>
              {t("fr.cancel")}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
