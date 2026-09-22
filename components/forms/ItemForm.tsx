"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import { FIT_OPTIONS } from "@/lib/fit";
import type { ArmorData, GameTableLocations, Item, Weapon, WeaponAttack } from "@/lib/types";

export interface ItemFormProps {
  initial?: Item;
  tableId?: string;
  tables?: Array<{ id: string; title: string }>;
  defaultLocationId?: string;
}

const KINDS: Array<{ value: string; label: string; desc: string }> = [
  { value: "equipment", label: "Equipamento", desc: "Item genérico" },
  { value: "weapon", label: "Arma", desc: "Arma (usos atacáveis)" },
  { value: "shield", label: "Escudo", desc: "Escudo / defesa" },
  { value: "armor", label: "Armadura", desc: "Proteção (DR, locais)" },
];

const QUALITIES = ["", "ruim", "boa", "excelente", "master"];
const QUALITY_LABEL: Record<string, string> = { master: "Mestre" };
const CONDITIONS = ["", "danificado", "quebrado", "gasto"];
const HANDEDNESS = [
  { value: 1, label: "1 mão" },
  { value: 2, label: "2 mãos" },
];
const DEFAULT_RATING_ST = 10;

const DAMAGE_SOURCE_LABELS: Record<string, string> = {
  st_swing: "Balanço (ST)",
  st_thrust: "Empuxo (ST)",
  rated_st_swing: "Balanço (ST poderosa)",
  rated_st_thrust: "Empuxo (ST poderosa)",
  fixed: "Fixado (dados próprios)",
};

const DAMAGE_TYPES: Array<{ value: string; label: string }> = [
  { value: "cut", label: "Corte" },
  { value: "cr", label: "Esmagamento" },
  { value: "imp", label: "Perfuração" },
  { value: "pi", label: "Flecha" },
  { value: "pi-", label: "Flecha pequena" },
  { value: "pi+", label: "Flecha grande" },
  { value: "pi++", label: "Flecha enorme" },
  { value: "burn", label: "Queimadura" },
  { value: "tox", label: "Veneno" },
  { value: "cor", label: "Corrosão" },
  { value: "fat", label: "Fadiga" },
];

const isWeaponish = (kind: string) => kind === "weapon" || kind === "shield";
const isArmorish = (kind: string) => kind === "armor" || kind === "shield";

function emptyAttack(): WeaponAttack {
  return {
    name: "Ataque",
    usage: "",
    damage_source: "st_swing",
    damage_dice: "",
    damage_modifier: 0,
    damage_type: "cut",
    armor_penetration: 0,
    accuracy: null,
    range: "C",
    recoil: null,
    shots: null,
  };
}

export default function ItemForm({ initial, tableId, tables, defaultLocationId }: ItemFormProps) {
  const router = useRouter();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table_id ?? "");
  const [locationId, setLocationId] = useState(initial?.location_id ?? defaultLocationId ?? "");
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "equipment");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [weight, setWeight] = useState(initial?.weight_lb != null ? String(initial.weight_lb) : "");
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [quality, setQuality] = useState(initial?.quality ?? "");
  const [condition, setCondition] = useState(initial?.condition ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  // Arma / escudo
  const [weaponSkill, setWeaponSkill] = useState(initial?.weapon?.skill ?? "");
  const [minSt, setMinSt] = useState(initial?.weapon?.min_st != null ? String(initial.weapon.min_st) : "");
  const [ratedSt, setRatedSt] = useState(initial?.weapon?.rated_st != null ? String(initial.weapon.rated_st) : "");
  const [handedness, setHandedness] = useState(initial?.weapon?.handedness ?? 1);
  const [reach, setReach] = useState(initial?.weapon?.reach ?? "C");
  const [parry, setParry] = useState(initial?.weapon?.parry ?? "");
  const [block, setBlock] = useState(initial?.weapon?.block ?? "");
  const [weaponFit, setWeaponFit] = useState(initial?.weapon?.fit ?? "normal");
  const [attacks, setAttacks] = useState<WeaponAttack[]>(
    (initial?.weapon?.attacks?.length ? initial.weapon.attacks : [emptyAttack()]).map((a) => ({ ...a }))
  );

  // Armadura / escudo
  const [dr, setDr] = useState(
    initial?.armor?.dr != null ? String(initial.armor.dr) : (initial && isArmorish(initial.kind ?? "") ? "" : "")
  );
  const [flex, setFlex] = useState(initial?.armor?.flex ?? false);
  const [locations, setLocations] = useState(initial?.armor?.locations ?? "torso");
  const [armorFit, setArmorFit] = useState(initial?.armor?.fit ?? "normal");

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

  function setAttackField(index: number, patch: Partial<WeaponAttack>) {
    setAttacks((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function addAttack() {
    setAttacks((prev) => [...prev, emptyAttack()]);
  }

  function removeAttack(index: number) {
    setAttacks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTableId) {
      setError("Selecione a mesa.");
      return;
    }
    setSaving(true);
    setError(null);

    const weaponFields =
      isWeaponish(kind) && isEdit && initial?.weapon
        ? {
            weapon_skill: weaponSkill || null,
            min_st: minSt === "" ? null : Number(minSt),
            rated_st: ratedSt === "" ? null : Number(ratedSt),
            handedness,
            reach: reach || "C",
            parry: parry || null,
            block: block || null,
            weapon_fit: weaponFit || "normal",
            attacks: attacks.map((a) => ({
              name: a.name || "Ataque",
              usage: a.usage || null,
              damage_source: a.damage_source,
              damage_dice: a.damage_source === "fixed" ? a.damage_dice || "0" : null,
              damage_modifier:
                a.damage_source === "fixed"
                  ? 0
                  : a.damage_source === "st_swing" || a.damage_source === "st_thrust"
                    ? a.damage_modifier ?? 0
                    : a.damage_modifier ?? 0,
              damage_type: a.damage_type || "cr",
              armor_penetration: a.armor_penetration ?? 0,
              accuracy: a.accuracy ?? null,
              range: a.range || "C",
              recoil: a.recoil ?? null,
              shots: a.shots ?? null,
            })),
          }
        : isWeaponish(kind)
          ? {
              weapon_skill: weaponSkill || null,
              min_st: minSt === "" ? null : Number(minSt),
              rated_st: ratedSt === "" ? null : Number(ratedSt),
              handedness,
              reach: reach || "C",
              parry: parry || null,
              block: block || null,
              weapon_fit: weaponFit || "normal",
              attacks: attacks.map((a) => ({
                name: a.name || "Ataque",
                usage: a.usage || null,
                damage_source: a.damage_source,
                damage_dice: a.damage_source === "fixed" ? a.damage_dice || "0" : null,
                damage_modifier: a.damage_source === "fixed" ? 0 : (a.damage_modifier ?? 0),
                damage_type: a.damage_type || "cr",
                armor_penetration: a.armor_penetration ?? 0,
                accuracy: a.accuracy ?? null,
                range: a.range || "C",
                recoil: a.recoil ?? null,
                shots: a.shots ?? null,
              })),
            }
          : {};

    const armorFields = isArmorish(kind)
      ? {
          dr: dr === "" ? null : Number(dr),
          flex: flex ? 1 : 0,
          locations: locations || "torso",
          armor_fit: armorFit || "normal",
        }
      : {};

    const payload = {
      ...(isEdit && initial ? { id: initial.id } : {}),
      table_id: currentTableId,
      location_id: locationId || null,
      name,
      kind,
      category,
      weight_lb: weight === "" ? null : Number(weight),
      cost: cost === "" ? null : Number(cost),
      dimensions,
      description,
      quality,
      condition,
      ...weaponFields,
      ...armorFields,
    };

    try {
      await submitJson<{ success?: boolean }>("/api/game-table-item", isEdit ? "PUT" : "POST", payload);
      router.push(`/table/${currentTableId}/items`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar o item.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-green-100 mb-6">
          {isEdit ? "Editar Item" : "Novo Item"}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          {!isEdit && !tableId ? (
            <div>
              <label className={labelCls}>Mesa</label>
              <select
                value={currentTableId}
                onChange={(e) => setCurrentTableId(e.target.value)}
                required
                className={inputCls}
              >
                <option value="" disabled>
                  Selecione a mesa
                </option>
                {(tables ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {locationOptions.length > 0 ? (
            <div>
              <label className={labelCls}>Local (opcional)</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
                <option value="">— Nenhum local —</option>
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1">
                Vincula o item a um local — ex: uma loja exibe na aba “Loja” tudo o que aponta pra ela.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Categoria</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputCls}
                placeholder="ex: Arma, Armadura, Poção"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tipo de item</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${kind === k.value
                    ? "border-rose-500/70 bg-rose-900/20"
                    : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600"}
                  `}
                >
                  <span className="block text-sm font-medium text-zinc-200">{k.label}</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">{k.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>Peso (lb)</label>
              <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Custo ($)</label>
              <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Dimensões</label>
              <input value={dimensions} onChange={(e) => setDimensions(e.target.value)} className={inputCls} placeholder="ex: 30x5cm" />
            </div>
            <div>
              <label className={labelCls}>Qualidade</label>
              <select value={quality} onChange={(e) => setQuality(e.target.value)} className={inputCls}>
                <option value="">Comum</option>
                {QUALITIES.slice(1).map((q) => (
                  <option key={q} value={q}>
                    {QUALITY_LABEL[q] ?? q.charAt(0).toUpperCase() + q.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Condição</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
                <option value="">Intacto</option>
                {CONDITIONS.slice(1).map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isWeaponish(kind) ? (
            <div className="space-y-4 border border-zinc-700/40 rounded-xl p-4 bg-zinc-800/30">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Arma / Escudo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Habilidade</label>
                  <input value={weaponSkill} onChange={(e) => setWeaponSkill(e.target.value)} className={inputCls} placeholder="ex: Sword" />
                </div>
                <div>
                  <label className={labelCls}>ST mín.</label>
                  <input type="number" value={minSt} onChange={(e) => setMinSt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>ST poderosa</label>
                  <input type="number" value={ratedSt} onChange={(e) => setRatedSt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Empunhadura</label>
                  <select value={handedness} onChange={(e) => setHandedness(Number(e.target.value))} className={inputCls}>
                    {HANDEDNESS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {h.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Alcance</label>
                  <input value={reach} onChange={(e) => setReach(e.target.value)} className={inputCls} placeholder="C, 1, 2" />
                </div>
                <div>
                  <label className={labelCls}>Parry</label>
                  <input value={parry} onChange={(e) => setParry(e.target.value)} className={inputCls} placeholder="ex: 9U" />
                </div>
                <div>
                  <label className={labelCls}>Block</label>
                  <input value={block} onChange={(e) => setBlock(e.target.value)} className={inputCls} placeholder="ex: 9" />
                </div>
                <div>
                  <label className={labelCls}>Ajuste</label>
                  <select value={weaponFit} onChange={(e) => setWeaponFit(e.target.value)} className={inputCls}>
                    {FIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={labelCls}>Ataques</label>
                  <button type="button" onClick={addAttack} className="bg-green-900/60 hover:bg-green-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
                    + Ataque
                  </button>
                </div>
                {attacks.map((atk, index) => (
                  <div key={index} className="border border-zinc-700/40 rounded-lg p-3 mb-3 bg-zinc-800/40">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Nome</label>
                        <input value={atk.name || ""} onChange={(e) => setAttackField(index, { name: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Uso</label>
                        <input value={atk.usage || ""} onChange={(e) => setAttackField(index, { usage: e.target.value })} className={inputCls} placeholder="ex: Bash" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Fonte de dano</label>
                        <select
                          value={atk.damage_source}
                          onChange={(e) => setAttackField(index, { damage_source: e.target.value as WeaponAttack["damage_source"] })}
                          className={inputCls}
                        >
                          {Object.entries(DAMAGE_SOURCE_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Tipo</label>
                        <select value={atk.damage_type} onChange={(e) => setAttackField(index, { damage_type: e.target.value as WeaponAttack["damage_type"] })} className={inputCls}>
                          {DAMAGE_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Modificador</label>
                        <input type="number" value={atk.damage_modifier ?? 0} onChange={(e) => setAttackField(index, { damage_modifier: Number(e.target.value) })} className={inputCls} />
                      </div>
                      {atk.damage_source === "fixed" ? (
                        <div className="md:col-span-2">
                          <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Dados fixos</label>
                          <input value={atk.damage_dice || ""} onChange={(e) => setAttackField(index, { damage_dice: e.target.value })} className={inputCls} placeholder="ex: 2d+1" />
                        </div>
                      ) : null}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Pene. (AP)</label>
                        <input type="number" value={atk.armor_penetration ?? 0} onChange={(e) => setAttackField(index, { armor_penetration: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Acerto (Acc)</label>
                        <input type="number" value={atk.accuracy ?? ""} onChange={(e) => setAttackField(index, { accuracy: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Alcance</label>
                        <input value={atk.range || ""} onChange={(e) => setAttackField(index, { range: e.target.value })} className={inputCls} placeholder="C, 1, 10/20" />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">Tiros (Rcl)</label>
                        <input type="number" value={atk.recoil ?? ""} onChange={(e) => setAttackField(index, { recoil: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isArmorish(kind) ? (
            <div className="space-y-4 border border-zinc-700/40 rounded-xl p-4 bg-zinc-800/30">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Armadura</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>DR</label>
                  <input type="number" value={dr} onChange={(e) => setDr(e.target.value)} className={inputCls} placeholder="ex: 4" />
                </div>
                <div>
                  <label className={labelCls}>Flexível</label>
                  <select value={flex ? "1" : "0"} onChange={(e) => setFlex(e.target.value === "1")} className={inputCls}>
                    <option value="1">Sim</option>
                    <option value="0">Não</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Locais</label>
                  <input value={locations} onChange={(e) => setLocations(e.target.value)} className={inputCls} placeholder="torso" />
                </div>
                <div>
                  <label className={labelCls}>Ajuste</label>
                  <select value={armorFit} onChange={(e) => setArmorFit(e.target.value)} className={inputCls}>
                    <option value="normal">Normal</option>
                    <option value="tight">Justa</option>
                    <option value="loose">Folgada</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelCls}>Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Item"}
            </button>
            <a href={currentTableId ? `/table/${currentTableId}/items` : "/narrator"} className={cancelCls}>
              Cancelar
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
