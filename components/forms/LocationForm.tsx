"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import { LOCATION_KINDS, absoluteHex, formatHexScale } from "@/lib/location";
import type { Location } from "@/lib/types";

export interface LocationFormProps {
  initial?: Location;
  tableId?: string;
  allLocations?: Location[];
  defaultParentId?: string;
  defaultKind?: string;
}

const IS_BATTLE: Array<{ value: string; label: string }> = [
  { value: "flat", label: "Borda plana" },
  { value: "pointy", label: "Vértice em cima" },
  { value: "square", label: "Grade quadrada" },
];

function rankOf(kind?: string): number {
  const i = LOCATION_KINDS.findIndex((k) => k.value === kind);
  return i === -1 ? -1 : i;
}

export default function LocationForm({
  initial,
  tableId,
  allLocations = [],
  defaultParentId,
  defaultKind,
}: LocationFormProps) {
  const router = useRouter();
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
      setError("Selecione a mesa.");
      return;
    }
    if (!name.trim()) {
      setError("Dê um nome a esta divisão de território.");
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
      setError(err instanceof Error ? err.message : "Falha ao salvar o local.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-green-100 mb-1">
          {isEdit ? "Editar Local" : "Novo Local"}
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Uma divisão de território numa cadeia de escala hexagonal: world → … → site → battlemap.
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} placeholder="ex: Valorholm" />
            </div>
            <div>
              <label className={labelCls}>Contém em (pai)</label>
              <select value={parentId} onChange={(e) => handleParentChange(e.target.value)} className={inputCls}>
                <option value="">— Sem pai (mundo) —</option>
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
            <label className={labelCls}>Tipo de território</label>
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
                  <span className="block text-sm font-medium text-zinc-200">{k.label}</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">{k.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 border border-zinc-700/40 rounded-xl p-4 bg-zinc-800/30">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Grade hexagonal</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Hex (m)</label>
                <input type="number" step="0.1" min="0" value={sizeM} onChange={(e) => setSizeM(e.target.value)} className={inputCls} placeholder="ex: 500000" />
              </div>
              <div>
                <label className={labelCls}>Largura (hex)</label>
                <input type="number" step="1" min="0" value={width} onChange={(e) => setWidth(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Altura (hex)</label>
                <input type="number" step="1" min="0" value={height} onChange={(e) => setHeight(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Orientação</label>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as "flat" | "pointy" | "square")} className={inputCls}>
                  {IS_BATTLE.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Centro Q</label>
                <input type="number" value={centerQ} onChange={(e) => setCenterQ(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Centro R</label>
                <input type="number" value={centerR} onChange={(e) => setCenterR(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Rotação (°)</label>
                <input type="number" step="15" value={rotationDeg} onChange={(e) => setRotationDeg(e.target.value)} className={inputCls} placeholder="0, 15, 30…" />
              </div>
              <div className="flex items-end">
                <label className={`${inputCls} flex items-center gap-2 cursor-pointer py-2.5`}>
                  <input type="checkbox" checked={indoor} onChange={(e) => setIndoor(e.target.checked)} className="accent-amber-500" />
                  <span className="text-sm text-zinc-300 font-medium">Interior</span>
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
              <span>Escala: <span className="text-zinc-300 font-semibold">{formatHexScale(sizeNum)}</span></span>
              <span aria-hidden>·</span>
              <span>
                Abs Q/R: <span className="font-mono text-zinc-300">q{preview.q}·r{preview.r}</span>{" "}
                <span className="text-zinc-600">(reduzido à escala deste hex)</span>
              </span>
              {sizeNum != null && sizeNum <= 2 ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 uppercase tracking-widest font-semibold">
                  Mapa de batalha
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 border border-zinc-700/40 rounded-xl p-4 bg-zinc-800/30">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Recadastro de terreno</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Região</label>
                <input value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sub-região</label>
                <input value={subRegion} onChange={(e) => setSubRegion(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Endereço</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>País</label>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Área</label>
                <input value={area} onChange={(e) => setArea(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Dimensões</label>
                <input value={dimensions} onChange={(e) => setDimensions(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="space-y-3 border border-zinc-700/40 rounded-xl p-4 bg-zinc-800/30">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Loja (opcional)</h3>
            <p className="text-[11px] text-zinc-600">
              Se preenchido, o local vira uma loja e a ficha ganha a aba “Loja”, com os NPCs da
              equipe e o estoque de itens vinculados a ele.
            </p>
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className={inputCls}
              placeholder="ex: A Flecha de Bronze"
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notas (outros)</label>
              <textarea value={other} onChange={(e) => setOther(e.target.value)} rows={2} className={inputCls} />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Local"}
            </button>
            <a
              href={isEdit ? `/location/${locId}` : currentTableId ? `/table/${currentTableId}/locations` : "/narrator"}
              className={cancelCls}
            >
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}