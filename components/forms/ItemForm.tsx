"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { seatActorQuery } from "@/lib/seat";
import { submitJson } from "./submit";
import { cancelCls, inputCls, labelCls, submitCls } from "./formStyles";
import FormShell from "./FormShell";
import CategoryField from "./CategoryField";
import { FIT_OPTIONS } from "@/lib/fit";
import { DAMAGE_SOURCE_LABELS, DAMAGE_TYPES } from "@/lib/damage";
import { kgToLb, lbToKg } from "@/lib/units";
import { useTranslation } from "@/lib/i18n";
import type { ArmorData, GameTableItems, GameTableLocations, GameTableSkills, Item, Weapon, WeaponAttack } from "@/lib/types";

export interface ItemFormProps {
  initial?: Item;
  tableId?: string;
  tableTitle?: string;
  tables?: Array<{ id: string; title: string }>;
  defaultLocationId?: string;
}

const KINDS: Array<{ value: string; label: string; desc: string }> = [
  { value: "equipment", label: "fr.item.kind.equipment", desc: "fr.item.kindD.equipment" },
  { value: "weapon", label: "fr.item.kind.weapon", desc: "fr.item.kindD.weapon" },
  { value: "shield", label: "fr.item.kind.shield", desc: "fr.item.kindD.shield" },
  { value: "armor", label: "fr.item.kind.armor", desc: "fr.item.kindD.armor" },
];

const QUALITIES = ["", "ruim", "boa", "excelente", "master"];
const CONDITIONS = ["", "danificado", "quebrado", "gasto"];
const HANDEDNESS = [
  { value: 1, label: "it.hands.1" },
  { value: 2, label: "it.hands.2" },
];
const DEFAULT_RATING_ST = 10;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* Rótulos de fonte de dano vêm de lib/damage (já chaves); "fixed" é
   completado aqui porque a nuance é só de formulário. */
const DAMAGE_SOURCE_KEYS: Record<string, string> = {
  ...DAMAGE_SOURCE_LABELS,
  fixed: "fr.atk.dmgSourceFixed",
};

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

export default function ItemForm({ initial, tableId, tableTitle, tables, defaultLocationId }: ItemFormProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const isEdit = !!initial;

  const [currentTableId, setCurrentTableId] = useState(tableId ?? initial?.table_id ?? "");
  const [locationId, setLocationId] = useState(initial?.location_id ?? defaultLocationId ?? "");
    const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [currencyOptions, setCurrencyOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "equipment");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [weight, setWeight] = useState(initial?.weight_lb != null ? String(Number(lbToKg(initial.weight_lb).toFixed(2))) : "");
  const [cost, setCost] = useState(initial?.cost != null ? String(initial.cost) : "");
  const [currencyItemId, setCurrencyItemId] = useState(initial?.currency_item_id ?? "");
  const [dimensions, setDimensions] = useState(initial?.dimensions ?? "");
  const [quality, setQuality] = useState(initial?.quality ?? "");
  const [condition, setCondition] = useState(initial?.condition ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  // Arma / escudo
  const [weaponSkill, setWeaponSkill] = useState(initial?.weapon?.skill ?? "");
  // weapons.skill é texto solto (GURPS); skill_id é a perícia resolvida na
  // mesa. O input continua livre — livrinhas trazem perícia que a mesa não
  // tem — mas escolher uma da lista passa a gravar o id junto.
  const [weaponSkillId, setWeaponSkillId] = useState<string | null>(initial?.weapon?.skill_id ?? initial?.skill_id ?? null);
  const [skillOptions, setSkillOptions] = useState<Array<{ id: string; name: string }>>([]);
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
    api<GameTableLocations>(`/game-table-locations/${currentTableId}${seatActorQuery()}`)
      .then((d) => {
        if (cancel) return;
        setLocationOptions((d.locations ?? []).map((l) => ({ id: l.id, name: l.name })));
      })
      .catch(() => {
        if (cancel) return;
        setLocationOptions([]);
      });
    // Catálogo da mesa para o item escolher em que moeda o preço está cotado.
    api<GameTableItems>(`/game-table-items/${currentTableId}`)
      .then((d) => {
        if (cancel) return;
        setCurrencyOptions((d.items ?? []).filter((it) => it.id !== initial?.id).map((it) => ({ id: it.id, name: it.name })));
      })
      .catch(() => {
        if (cancel) return;
        setCurrencyOptions([]);
      });
    // Perícias da mesa, para o campo de skill sugerir as que existem de fato.
    api<GameTableSkills>(`/game-table-skills/${currentTableId}`)
      .then((d) => {
        if (cancel) return;
        setSkillOptions((d.skills ?? []).map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {
        if (cancel) return;
        setSkillOptions([]);
      });
    return () => {
      cancel = true;
    };
  }, [currentTableId, initial?.id]);

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
      setError(t("fr.error.selectTable"));
      return;
    }
    setSaving(true);
    setError(null);

    const weaponFields =
      isWeaponish(kind) && isEdit && initial?.weapon
        ? {
            weapon_skill: weaponSkill || null,
            skill_id: weaponSkillId,
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
            skill_id: weaponSkillId,
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
      weight_lb: weight === "" ? null : Number(kgToLb(Number(weight)).toFixed(3)),
      cost: cost === "" ? null : Number(cost),
      currency_item_id: currencyItemId || null,
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
      setError(err instanceof Error ? err.message : t("fr.err.item"));
      setSaving(false);
    }
  }

  const contextTableId = tableId ?? initial?.table_id ?? "";
  const contextTableTitle =
    tableTitle ?? tables?.find((entry) => entry.id === contextTableId)?.title;

  return (
    <FormShell
      tableId={contextTableId || undefined}
      tableTitle={contextTableTitle}
      resourceLabel="nav.items"
      actionLabel={isEdit ? "fr.item.editTitle" : "fr.item.newTitle"}
      title={isEdit ? t("fr.item.editTitle") : t("fr.item.newTitle")}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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

          {locationOptions.length > 0 ? (
            <div>
              <label className={labelCls}>{t("fr.loc.link")}</label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}>
                <option value="">{t("fr.loc.noLink")}</option>
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-zinc-600 mt-1">{t("fr.loc.linkHintItem")}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.name")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </div>
          </div>

          <CategoryField
            tableId={currentTableId || undefined}
            entity="item"
            category={category}
            subcategory=""
            onCategory={setCategory}
            onSubcategory={() => {}}
            hasSubcategory={false}
            categoryPlaceholder={t("fr.item.categoryPh")}
          />

          <div>
            <label className={labelCls}>{t("fr.item.kindLabel")}</label>
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
                  <span className="block text-sm font-medium text-zinc-200">{t(k.label)}</span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5">{t(k.desc)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>{t("fr.item.weightKg")}</label>
              <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.item.costDollar")}</label>
              <input type="number" step="1" value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.item.currency")}</label>
              <select value={currencyItemId} onChange={(e) => setCurrencyItemId(e.target.value)} className={inputCls}>
                <option value="">{t("fr.item.currencyNone")}</option>
                {currencyOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("fr.item.dimensions")}</label>
              <input value={dimensions} onChange={(e) => setDimensions(e.target.value)} className={inputCls} placeholder={t("fr.item.dimensionsPh")} />
            </div>
            <div>
              <label className={labelCls}>{t("fr.quality")}</label>
              <select value={quality} onChange={(e) => setQuality(e.target.value)} className={inputCls}>
                <option value="">{t("fr.quality.common")}</option>
                {QUALITIES.slice(1).map((q) => (
                  <option key={q} value={q}>
                    {cap(t(`fr.quality.${q}`))}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t("fr.condition")}</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputCls}>
                <option value="">{t("fr.condition.intact")}</option>
                {CONDITIONS.slice(1).map((c) => (
                  <option key={c} value={c}>
                    {cap(t(`fr.condition.${c}`))}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isWeaponish(kind) ? (
            <div className="space-y-4 border-t border-zinc-700/40 pt-5">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t("fr.item.weaponShield")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>{t("fr.item.skill")}</label>
                  <input
                    list="item-skill-options"
                    value={weaponSkill}
                    onChange={(e) => {
                      const value = e.target.value
                      setWeaponSkill(value)
                      // Bate o texto contra as perícias da mesa: se casar,
                      // grava o id; se for texto novo, limpa o id para o
                      // backend resolver (ou recusar) pelo nome.
                      const hit = skillOptions.find((s) => s.name === value)
                      setWeaponSkillId(hit ? hit.id : null)
                    }}
                    className={inputCls}
                    placeholder={t("fr.item.skillPh")}
                  />
                  <datalist id="item-skill-options">
                    {skillOptions.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className={labelCls}>{t("fr.item.minSt")}</label>
                  <input type="number" value={minSt} onChange={(e) => setMinSt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("fr.item.ratedSt")}</label>
                  <input type="number" value={ratedSt} onChange={(e) => setRatedSt(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{t("fr.item.grip")}</label>
                  <select value={handedness} onChange={(e) => setHandedness(Number(e.target.value))} className={inputCls}>
                    {HANDEDNESS.map((h) => (
                      <option key={h.value} value={h.value}>
                        {t(h.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>{t("fr.reach")}</label>
                  <input value={reach} onChange={(e) => setReach(e.target.value)} className={inputCls} placeholder={t("fr.reachPh")} />
                </div>
                <div>
                  <label className={labelCls}>{t("fr.item.parry")}</label>
                  <input value={parry} onChange={(e) => setParry(e.target.value)} className={inputCls} placeholder={t("fr.item.parryPh")} />
                </div>
                <div>
                  <label className={labelCls}>{t("fr.item.block")}</label>
                  <input value={block} onChange={(e) => setBlock(e.target.value)} className={inputCls} placeholder={t("fr.item.blockPh")} />
                </div>
                <div>
                  <label className={labelCls}>{t("fr.fit")}</label>
                  <select value={weaponFit} onChange={(e) => setWeaponFit(e.target.value)} className={inputCls}>
                    {FIT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{t(o.label)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className={labelCls}>{t("fr.attacks")}</label>
                  <button type="button" onClick={addAttack} className="bg-green-900/60 hover:bg-green-800 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
                    {t("fr.addAttack")}
                  </button>
                </div>
                {attacks.map((atk, index) => (
                  <div key={index} className="border-t border-zinc-700/40 pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.name")}</label>
                        <input value={atk.name || ""} onChange={(e) => setAttackField(index, { name: e.target.value })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.atk.usage")}</label>
                        <input value={atk.usage || ""} onChange={(e) => setAttackField(index, { usage: e.target.value })} className={inputCls} placeholder={t("fr.atk.usagePh")} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.atk.dmgSource")}</label>
                        <select
                          value={atk.damage_source}
                          onChange={(e) => setAttackField(index, { damage_source: e.target.value as WeaponAttack["damage_source"] })}
                          className={inputCls}
                        >
                          {Object.entries(DAMAGE_SOURCE_KEYS).map(([v, l]) => (
                            <option key={v} value={v}>{t(l)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.type")}</label>
                        <select value={atk.damage_type} onChange={(e) => setAttackField(index, { damage_type: e.target.value as WeaponAttack["damage_type"] })} className={inputCls}>
                          {Object.entries(DAMAGE_TYPES).map(([v, l]) => (
                            <option key={v} value={v}>{t(l)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.atk.modifier")}</label>
                        <input type="number" value={atk.damage_modifier ?? 0} onChange={(e) => setAttackField(index, { damage_modifier: Number(e.target.value) })} className={inputCls} />
                      </div>
                      {atk.damage_source === "fixed" ? (
                        <div className="md:col-span-2">
                          <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.atk.fixedDice")}</label>
                          <input value={atk.damage_dice || ""} onChange={(e) => setAttackField(index, { damage_dice: e.target.value })} className={inputCls} placeholder={t("fr.atk.fixedDicePh")} />
                        </div>
                      ) : null}
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.atk.ap")}</label>
                        <input type="number" value={atk.armor_penetration ?? 0} onChange={(e) => setAttackField(index, { armor_penetration: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.atk.acc")}</label>
                        <input type="number" value={atk.accuracy ?? ""} onChange={(e) => setAttackField(index, { accuracy: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.reach")}</label>
                        <input value={atk.range || ""} onChange={(e) => setAttackField(index, { range: e.target.value })} className={inputCls} placeholder={t("fr.reachPhFar")} />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-0.5">{t("fr.atk.shots")}</label>
                        <input type="number" value={atk.recoil ?? ""} onChange={(e) => setAttackField(index, { recoil: e.target.value === "" ? null : Number(e.target.value) })} className={inputCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {isArmorish(kind) ? (
            <div className="space-y-4 border-t border-zinc-700/40 pt-5">
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{t("fr.item.armor")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>DR</label>
                  <input type="number" value={dr} onChange={(e) => setDr(e.target.value)} className={inputCls} placeholder={t("fr.item.drPh")} />
                </div>
                <div>
                  <label className={labelCls}>{t("fr.flexible")}</label>
                  <select value={flex ? "1" : "0"} onChange={(e) => setFlex(e.target.value === "1")} className={inputCls}>
                    <option value="1">{t("fr.yes")}</option>
                    <option value="0">{t("fr.no")}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t("fr.locations")}</label>
                  <input value={locations} onChange={(e) => setLocations(e.target.value)} className={inputCls} placeholder="torso" />
                </div>
                <div>
                  <label className={labelCls}>{t("fr.fit")}</label>
                  <select value={armorFit} onChange={(e) => setArmorFit(e.target.value)} className={inputCls}>
                    <option value="normal">{t("fit.normal")}</option>
                    <option value="tight">{t("fr.armorFit.tight")}</option>
                    <option value="loose">{t("fit.loose")}</option>
                  </select>
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelCls}>{t("fr.description")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className={`${submitCls} disabled:opacity-50`}>
              {saving ? t("fr.saving") : isEdit ? t("fr.saveChanges") : t("fr.item.create")}
            </button>
            <Link
              href={currentTableId ? `/table/${currentTableId}/items` : "/narrator"}
              className={cancelCls}
            >
              {t("fr.cancel")}
            </Link>
          </div>
        </form>
    </FormShell>
  );
}
