/* ============================================================
   i18n-core — funções puras de idioma (sem React).
   Seguro para importar em componentes de servidor e de cliente.
   ============================================================ */

export type Lang = "pt" | "en";

export const DEFAULT_LANG: Lang = "en";

export const LANGS: Array<{ id: Lang; label: string }> = [
  { id: "en", label: "EN" },
  { id: "pt", label: "PT" },
];

export const STORAGE_KEY = "vkrpg.lang";
export const LANG_COOKIE = "vkrpg.lang";

export function normalizeLang(value: string | null | undefined): Lang {
  return value === "pt" ? "pt" : "en";
}

export function langFromCookieValue(value: string | undefined): Lang {
  return normalizeLang(value);
}

const dict: Record<Lang, Record<string, string>> = {
  pt: {
    "lang.label": "Idioma",

    /* ---------- Assistente de nova mesa ---------- */
    "wizard.breadcrumb": "Mesas",
    "wizard.eyebrow": "Montagem da mesa",
    "wizard.title": "Monte sua mesa",
    "wizard.subtitle":
      "Três passos, sem um formulário gigante: nomeie a campanha, escolha um kit inicial e defina o orçamento das primeiras fichas.",
    "s1.title": "Identidade",
    "s1.desc": "O nome, o sistema e a apresentação da campanha.",
    "s2.title": "Kit inicial",
    "s2.desc": "Pacotes prontos de perícias, itens, vantagens e personagens.",
    "s3.title": "Pontos da ficha",
    "s3.desc": "O orçamento do jogador para a primeira ficha.",
    "f.narrator": "Narrador",
    "f.narratorPh": "Escolha o narrador",
    "f.titleField": "Título",
    "f.titlePh": "ex: As Crônicas de Marvengard",
    "f.system": "Sistema",
    "f.systemLocked": "Por enquanto o sistema é fixo no GURPS — em breve será possível escolher.",
    "f.intro": "Introdução",
    "f.introPh": "Uma frase para apresentar o mundo aos jogadores.",
    "s2.hint":
      "Opcional — pode começar a mesa vazia e adicionar conteúdo depois.",
    "s2.selectedZero": "Nenhum módulo",
    "s2.selectedOne": "1 módulo",
    "s2.selectedMany": "{n} módulos",
    "s2.addAll": "Adicionar todos",
    "s2.clearAll": "Limpar",
    "s2.empty": "Sem módulos escolhidos — a mesa nasce vazia.",
    "c.skills": "perícias",
    "c.items": "itens",
    "c.characters": "personagens",
    "c.npcs": "npcs",
    "c.advantages": "vantagens",
    "c.disadvantages": "desvantagens",
    "s3.hint":
      "É o total de pontos que cada jogador terá para montar a primeira ficha — fica gravado nas regras da mesa.",
    "s3.suggestions": "Sugestões",
    "s3.custom": "Outro valor",
    "s3.note": "Escolha um valor pronto ou digite o seu.",
    "s3.footnote": "pontos por ficha",
    "act.back": "Voltar",
    "act.next": "Continuar",
    "act.create": "Criar mesa",
    "act.creating": "Criando…",
    "w.needTitle": "Dê um título à campanha para continuar.",
    "w.needNarrator": "Escolha o narrador para continuar.",
    "w.createError": "Não foi possível criar a mesa.",
    "rail.eyebrow": "Carga da mesa",
    "rail.points": "pontos",
    "w.step": "passo",
    "w.modules": "módulo(s)",
    "w.load": "item(ns) na carga",

    /* ---------- Ficha inicial do jogador ---------- */
    "p.breadcrumb": "Jogadores",
    "p.eyebrow": "Primeira ficha",
    "p.title": "Crie seu personagem",
    "p.subtitle": "Junte-se à campanha com o orçamento definido pelas regras da mesa.",
    "p.who": "Quem você é",
    "p.whoPh": "— escolha seu nome de jogador —",
    "p.whoEmpty": "Precisamos saber quem você é para associar a ficha.",
    "p.name": "Nome do personagem",
    "p.bio": "Bio",
    "p.backstory": "História",
    "p.attrs": "Atributos",
    "p.hp": "HP",
    "p.fp": "FP",
    "p.speed": "Velocidade básica",
    "p.encumbrance": "Carga",
    "p.adv": "Vantagens",
    "p.dis": "Desvantagens",
    "p.skills": "Perícias",
    "p.items": "Itens",
    "p.quirks": "Manias (até 5, −1 pt cada)",
    "p.add": "Adicionar",
    "p.done": "Feito",
    "p.selected": "selecionado(s)",
    "p.budgetTitle": "Orçamento",
    "p.remaining": "restam",
    "p.over": "Limite excedido — reduza os gastos antes de salvar.",
    "p.save": "Criar ficha",
    "p.saving": "Criando…",
    "p.savedTo": "Sua ficha está pronta: ",
    "p.rulesOn": "regras da mesa",
    "p.ruleTurn": "turno encerra após teste",
    "p.ruleMove": "turno encerra após mover",
    "p.ruleItemsPoints": "itens por pontos",
    "p.ruleItemsGm": "itens pelo mestre",

    /* ---------- Barra de busca (SearchModal) ---------- */
    "search.placeholder": "Buscar…",
    "search.button": "Buscar",
    "search.loading": "Carregando…",
    "search.empty": "Nada encontrado.",
    "search.close": "Fechar",
  },
  en: {
    "lang.label": "Language",

    "wizard.breadcrumb": "Tables",
    "wizard.eyebrow": "Table assembly",
    "wizard.title": "Set up your table",
    "wizard.subtitle":
      "Three short steps instead of one giant form: name the campaign, pick a starter kit, and set the budget for the first sheets.",
    "s1.title": "Identity",
    "s1.desc": "The name, system and one-line pitch of the campaign.",
    "s2.title": "Starter kit",
    "s2.desc": "Ready-made packs of skills, items, advantages and characters.",
    "s3.title": "Sheet points",
    "s3.desc": "The budget players get for their first sheet.",
    "f.narrator": "Narrator",
    "f.narratorPh": "Choose the narrator",
    "f.titleField": "Title",
    "f.titlePh": "e.g. The Chronicles of Marvengard",
    "f.system": "System",
    "f.systemLocked": "For now the system is fixed to GURPS — choosing will be available soon.",
    "f.intro": "Intro",
    "f.introPh": "One line to pitch the world to the players.",
    "s2.hint": "Optional — you can start empty and add content later.",
    "s2.selectedZero": "No modules",
    "s2.selectedOne": "1 module",
    "s2.selectedMany": "{n} modules",
    "s2.addAll": "Add all",
    "s2.clearAll": "Clear",
    "s2.empty": "No modules picked — the table starts empty.",
    "c.skills": "skills",
    "c.items": "items",
    "c.characters": "characters",
    "c.npcs": "npcs",
    "c.advantages": "advantages",
    "c.disadvantages": "disadvantages",
    "s3.hint":
      "How many points each player can use to build the first sheet — saved in the table's house rules.",
    "s3.suggestions": "Suggestions",
    "s3.custom": "Custom",
    "s3.note": "Pick a preset or type your own amount.",
    "s3.footnote": "points per sheet",
    "act.back": "Back",
    "act.next": "Continue",
    "act.create": "Create table",
    "act.creating": "Creating…",
    "w.needTitle": "Give the campaign a title to continue.",
    "w.needNarrator": "Choose the narrator to continue.",
    "w.createError": "Could not create the table.",
    "rail.eyebrow": "Table load",
    "rail.points": "points",
    "w.step": "step",
    "w.modules": "module(s)",
    "w.load": "item(s) on load",

    "p.breadcrumb": "Players",
    "p.eyebrow": "First sheet",
    "p.title": "Create your character",
    "p.subtitle": "Join the campaign with the budget set by the table's house rules.",
    "p.who": "Who you are",
    "p.whoPh": "— choose your player name —",
    "p.whoEmpty": "We need to know who you are to attach the sheet.",
    "p.name": "Character name",
    "p.bio": "Bio",
    "p.backstory": "Backstory",
    "p.attrs": "Attributes",
    "p.hp": "HP",
    "p.fp": "FP",
    "p.speed": "Basic Speed",
    "p.encumbrance": "Load",
    "p.adv": "Advantages",
    "p.dis": "Disadvantages",
    "p.skills": "Skills",
    "p.items": "Items",
    "p.quirks": "Quirks (up to 5, −1 pt each)",
    "p.add": "Add",
    "p.done": "Done",
    "p.selected": "selected",
    "p.budgetTitle": "Budget",
    "p.remaining": "left",
    "p.over": "Over budget — trim expenses before saving.",
    "p.save": "Create sheet",
    "p.saving": "Creating…",
    "p.savedTo": "Your sheet is ready: ",
    "p.rulesOn": "house rules",
    "p.ruleTurn": "turn ends after a test",
    "p.ruleMove": "turn ends after moving",
    "p.ruleItemsPoints": "items cost points",
    "p.ruleItemsGm": "items granted by the GM",

    "search.placeholder": "Search…",
    "search.button": "Search",
    "search.loading": "Loading…",
    "search.empty": "No results.",
    "search.close": "Close",
  },
};

export function translate(lang: Lang, key: string): string {
  return dict[lang]?.[key] ?? dict.en?.[key] ?? key;
}

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}