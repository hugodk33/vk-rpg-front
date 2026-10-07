/* ============================================================
   i18n-parts/cat — rótulos da taxonomia de conteúdo.

   As listas da mesa guardam a categoria como SLUG canônico
   ('combat', 'survival', 'Melee'…), o mesmo que o catálogo de
   conteúdo usa para agrupar tudo. O slug nunca é traduzido no
   banco: é a chave. Aqui ele ganha rótulo nos dois idiomas.
   Mesclado ao dict de lib/i18n-core.ts via spread.
   ============================================================ */

export const PT: Record<string, string> = {
  /* ---------- Perícias ---------- */
  "cat.combat": "Combate",
  "cat.melee": "Armas Brancas",
  "cat.ranged": "Armas de Projétil",
  "cat.unarmed": "Desarmado",
  "cat.defense": "Defesa",
  "cat.military": "Militar",
  "cat.command": "Comando",
  "cat.intelligence": "Inteligência",
  "cat.survival": "Sobrevivência",
  "cat.wilderness": "Natureza",
  "cat.animals": "Animais",
  "cat.athletics": "Atletismo",
  "cat.medical": "Medicina",
  "cat.social": "Social",
  "cat.communication": "Comunicação",
  "cat.languages": "Idiomas",
  "cat.craft": "Ofícios",
  "cat.technical": "Técnica",
  "cat.vehicle": "Veículos",
  "cat.science": "Ciências",
  "cat.business": "Negócios & Profissões",
  "cat.crime": "Crime & Submundo",
  "cat.shadow": "Sombra",
  "cat.burglary": "Arrombamento",
  "cat.deception": "Enganação",
  "cat.poison": "Veneno",
  "cat.arts": "Artes",
  "cat.magic": "Magia & Misticismo",

  /* ---------- Vantagens / Desvantagens ---------- */
  "cat.physical": "Físico",
  "cat.mental": "Mental",
  "cat.fitness": "Condicionamento",
  "cat.senses": "Sentidos",
  "cat.resistance": "Resistência",
  "cat.recuperation": "Recuperação",
  "cat.toughness": "Tenacidade",
  "cat.perception": "Percepção",
  "cat.talent": "Talento",
  "cat.willpower": "Força de Vontade",
  "cat.status": "Status",
  "cat.appearance": "Aparência",
  "cat.magical": "Mágico",
  "cat.exotic": "Exótico",
  "cat.health": "Saúde",
  "cat.addiction": "Vícios",
  "cat.speech": "Fala",
  "cat.compulsive": "Compulsões",
  "cat.emotional": "Emocional",
  "cat.cognitive": "Cognitivo",
  "cat.behavior": "Comportamento",

  /* ---------- Itens ---------- */
  "cat.shield": "Escudos",
  "cat.armor": "Armaduras",
  "cat.clothing": "Vestuário",
  "cat.equipment": "Equipamento",
  "cat.consumable": "Consumíveis",

  /* ---------- PNJs (papel) ---------- */
  "cat.combatante": "Combatentes",
  "cat.atirador": "Atiradores",
  "cat.arcano": "Arcanos",
  "cat.assassino": "Assassinos",
};

export const EN: Record<string, string> = {
  /* ---------- Skills ---------- */
  "cat.combat": "Combat",
  "cat.melee": "Melee Weapons",
  "cat.ranged": "Ranged Weapons",
  "cat.unarmed": "Unarmed",
  "cat.defense": "Defense",
  "cat.military": "Military",
  "cat.command": "Command",
  "cat.intelligence": "Intelligence",
  "cat.survival": "Survival",
  "cat.wilderness": "Wilderness",
  "cat.animals": "Animals",
  "cat.athletics": "Athletics",
  "cat.medical": "Medicine",
  "cat.social": "Social",
  "cat.communication": "Communication",
  "cat.languages": "Languages",
  "cat.craft": "Crafts",
  "cat.technical": "Technical",
  "cat.vehicle": "Vehicles",
  "cat.science": "Science",
  "cat.business": "Business & Professions",
  "cat.crime": "Crime & Underworld",
  "cat.shadow": "Shadowing",
  "cat.burglary": "Burglary",
  "cat.deception": "Deception",
  "cat.poison": "Poison",
  "cat.arts": "Arts",
  "cat.magic": "Magic & Mysticism",

  /* ---------- Advantages / Disadvantages ---------- */
  "cat.physical": "Physical",
  "cat.mental": "Mental",
  "cat.fitness": "Fitness",
  "cat.senses": "Senses",
  "cat.resistance": "Resistance",
  "cat.recuperation": "Recovery",
  "cat.toughness": "Toughness",
  "cat.perception": "Perception",
  "cat.talent": "Talent",
  "cat.willpower": "Willpower",
  "cat.status": "Status",
  "cat.appearance": "Appearance",
  "cat.magical": "Magical",
  "cat.exotic": "Exotic",
  "cat.health": "Health",
  "cat.addiction": "Addiction",
  "cat.speech": "Speech",
  "cat.compulsive": "Compulsions",
  "cat.emotional": "Emotional",
  "cat.cognitive": "Cognitive",
  "cat.behavior": "Behavior",

  /* ---------- Items ---------- */
  "cat.shield": "Shields",
  "cat.armor": "Armor",
  "cat.clothing": "Clothing",
  "cat.equipment": "Equipment",
  "cat.consumable": "Consumables",

  /* ---------- NPCs (role) ---------- */
  "cat.combatante": "Combatants",
  "cat.atirador": "Sharpshooters",
  "cat.arcano": "Arcane",
  "cat.assassino": "Assassins",
};
