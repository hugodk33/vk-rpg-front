/* ============================================================
   i18n-parts/tp — chaves das PÁGINAS de tabelas (app/table/**).
   Mescladas ao dict de lib/i18n-core.ts via spread.
   ============================================================ */

export const PT: Record<string, string> = {
  /* ---------- Locais (app/table/[id]/locations) ---------- */
  "tp.title": "Locais",
  "tp.new": "Novo local",
  "tp.count": "{n} locais",
  "tp.countOne": "{n} local",
  "tp.roots": "{n} raízes de território",
  "tp.rootOne": "{n} raiz de território",
  "tp.searchPh": "Pesquisar o território...",
  "tp.clear": "Limpar",
  "tp.region": "região",
  "tp.loading": "Carregando território...",
  "tp.noResults": "Nenhum local corresponde à sua pesquisa.",
  "tp.empty": "Nenhum território mapeado ainda. Crie seu primeiro mundo.",
  "tp.manyWorlds": "Vários mundos — abra um para levantar",
  "tp.noDivisions": "Nenhuma divisão dentro de {name} ainda.",
  "tp.default": "padrão",
  "tp.openMap": "Abrir mapa →",
  "tp.divisions": "{n} divisões",
  "tp.division": "{n} divisão",
  "tp.open": "Abrir",
  "tp.loc.zoomTrail": "Trilha de território",
  "tp.loc.goTo": "Ir para {name}",
  "tp.zoomLocked": "Escala acima do local padrão — travado para {name}",
  "tp.loc.defaultSet": "Definir como local padrão",
  "tp.loc.defaultOn": "Local padrão desta mesa",
  "tp.loc.battle": "Campo de batalha",
  "tp.loc.openSubs": "Abrir divisões",
  "tp.loc.noSubs": "Sem divisões",
  "tp.loc.sublocations": "Divisões",
  "tp.loc.openOwn": "Abrir {name}",
  "tp.locKind.world": "Mundo",
  "tp.locKind.continent": "Continente",
  "tp.locKind.nation": "nação",
  "tp.locKind.region": "região",
  "tp.locKind.biome": "Bioma",
  "tp.locKind.province": "Província",
  "tp.locKind.city": "Cidade",
  "tp.locKind.district": "Distrito",
  "tp.locKind.locale": "Localidade",
  "tp.locKind.site": "Local",
  "tp.locKind.battlemap": "Campo de batalha",
  "tp.locKind.point": "Ponto de interesse",
  "tp.locKind.generic": "Local",

  /* ---------- Ações de criação (adicionar) ---------- */
  /* O "+" fica no template do botão — o rótulo é só o texto. */
  "tp.add.advantage": "Vantagem",
  "tp.add.character": "Personagem",
  "tp.add.disadvantage": "Desvantagem",
  "tp.add.item": "Item",
  "tp.add.placeCharacter": "Colocar personagem",
  "tp.add.skill": "Perícia",
  "tp.add.location": "Local",
  "tp.add.modifier": "Modificador",

  /* ---------- Catálogo de itens ---------- */
  "tp.items.empty": "Nenhum item no catálogo ainda.",
  "tp.items.emptySearch": "Nenhum item corresponde à sua pesquisa.",
  "tp.items.fitLabel": "Tamanho",
  "tp.items.searchPh": "Pesquisar itens...",
  "tp.items.weaponShort": "Arma",

  /* ---------- Tipo de item (badge e contagem na listagem) ---------- */
  "tp.kind.weapon": "Arma",
  "tp.kind.shield": "Escudo",
  "tp.kind.armor": "Armadura",
  "tp.kind.equipment": "Equipamento",
  "tp.kindCount.weaponOne": "{n} arma",
  "tp.kindCount.weaponMany": "{n} armas",
  "tp.kindCount.shieldOne": "{n} escudo",
  "tp.kindCount.shieldMany": "{n} escudos",
  "tp.kindCount.armorOne": "{n} armadura",
  "tp.kindCount.armorMany": "{n} armaduras",
  "tp.kindCount.equipmentOne": "{n} equipamento",
  "tp.kindCount.equipmentMany": "{n} equipamentos",

  /* ---------- Catálogo de perícias ---------- */
  "tp.skills.empty": "Nenhuma perícia catalogada ainda.",
  "tp.skills.emptySearch": "Nenhuma perícia corresponde à sua pesquisa.",
  "tp.skills.searchPh": "Pesquisar perícias...",

  /* ---------- Catálogo de vantagens ---------- */
  "tp.advantages.empty": "Nenhuma vantagem catalogada ainda.",
  "tp.advantages.emptySearch": "Nenhuma vantagem corresponde à sua pesquisa.",
  "tp.advantages.searchPh": "Pesquisar vantagens...",

  /* ---------- Catálogo de desvantagens ---------- */
  "tp.disadvantages.empty": "Nenhuma desvantagem catalogada ainda.",
  "tp.disadvantages.emptySearch": "Nenhuma desvantagem corresponde à sua pesquisa.",
  "tp.disadvantages.searchPh": "Pesquisar desvantagens...",

  /* ---------- Personagens da mesa ---------- */
  "tp.characters.active": "Ativo",
  "tp.characters.ally": "Aliado",
  "tp.characters.bond": "Vínculo",
  "tp.characters.empty": "Nenhum personagem na mesa ainda.",
  "tp.characters.emptySearch": "Nenhum personagem corresponde à sua pesquisa.",
  "tp.characters.enemy": "Inimigo",
  "tp.characters.inactive": "Inativos",
  "tp.characters.npc": "NPC",
  "tp.characters.noSheet": "Sem ficha",
  "tp.characters.player": "Jogador",
  "tp.characters.searchPh": "Pesquisar personagens...",
  "tp.characters.status": "Situação",

  /* ---------- Livro-razão de sessões (ledger) ---------- */
  "tp.chapter": "Capítulo",
  "tp.ledger.archive": "Arquivo",
  "tp.ledger.campaign": "Campanha",
  "tp.ledger.edit": "Editar",
  "tp.ledger.gm": "Narrador",
  "tp.ledger.gmActions": "Ações do narrador",
  "tp.ledger.gmActionsMeta": "Ferramentas reservadas ao narrador.",
  "tp.ledger.noSeed": "Nenhum registro inicial ainda.",
  "tp.ledger.ruledBy": "Narrada por {name}",
  "tp.ledger.title": "Crônica",

  /* ---------- Crônica (próxima sessão) ---------- */
  "tp.chronicle.awaiting": "Aguardando o narrador",
  "tp.chronicle.continue": "Continuar a crônica",
  "tp.chronicle.open": "Abrir a crônica",

  /* ---------- Contadores ---------- */
  "tp.count.advantagesMany": "{n} vantagens",
  "tp.count.advantagesOne": "{n} vantagem",
  "tp.count.attacksMany": "{n} ataques",
  "tp.count.attacksOne": "{n} ataque",
  "tp.count.charactersMany": "{n} personagens",
  "tp.count.charactersOne": "{n} personagem",
  "tp.count.disadvantagesMany": "{n} desvantagens",
  "tp.count.disadvantagesOne": "{n} desvantagem",
  "tp.count.itemsMany": "{n} itens",
  "tp.count.itemsOne": "{n} item",
  "tp.count.recordsInArchive": "em arquivo",
  "tp.count.recordsInFileMany": "{n} registros",
  "tp.count.recordsInFileOne": "{n} registro",
  "tp.count.scenesMany": "{n} cenas",
  "tp.count.scenesOne": "{n} cena",
  "tp.count.seatsMany": "{n} assentos",
  "tp.count.seatsOne": "{n} assento",
  "tp.count.skillsMany": "{n} perícias",
  "tp.count.skillsOne": "{n} perícia",

  /* ---------- Assentos (seats) ---------- */
  "tp.npcs": "NPCs",
  "tp.npcsMarked": "NPCs marcados",
  "tp.players": "Jogadores",
  "tp.seatedOf": "Sentados em {name}",
  "tp.seats.emptyBody": "Ninguém sentado ainda. Abra uma crônica para sentar os personagens.",
  "tp.seats.emptyTitle": "Nenhum assento ocupado",

  /* ---------- Linha de assento ---------- */
  "tp.seat.effectsApplied": "Efeitos aplicados",
  "tp.seat.effectsMany": "{n} efeitos",
  "tp.seat.effectsOne": "{n} efeito",
  "tp.seat.noEffects": "Sem efeitos",
  "tp.seat.noNameNpc": "NPC sem nome",
  "tp.seat.noNamePlayer": "Jogador sem nome",
  "tp.seat.noSheetYet": "Sem ficha ainda",
  "tp.seat.npc": "NPC",
  "tp.seat.player": "Jogador",

  /* ---------- Unidades da mesa ---------- */
  "tp.unit.conditions": "Condições",
  "tp.unit.dossiers": "Dossiês",
  "tp.unit.places": "Lugares",
  "tp.unit.records": "Registros",
  "tp.unit.sheets": "Fichas",

  /* ---------- Local padrão ---------- */
  "tp.loc.default": "Local padrão",

  /* ---------- Subtítulos de páginas ---------- */
  "tp.settings.subtitle": "Ajustes da mesa, regras e preferências do grupo.",
  "tp.modifiers.subtitle": "Vantagens, desvantagens e efeitos em jogo.",
  "tp.visibility.subtitle": "O que cada participante pode ver nesta mesa.",

  /* ---------- Regra de fadiga ---------- */
  "tp.modifiers.fatigueRule": "A regra da fadiga",
  "tp.mod.f.fatigue": "Fadiga",
  "tp.mod.f.tracks": "A barra de fadiga tem {n} marcas.",
  "tp.mod.f.fills": "Cada marca preenchida acrescenta {n} de fadiga.",
  "tp.mod.f.barOf": "Barra de {value}/{max}",
  "tp.mod.f.extra": "Cada marca acima de {n} vale {n} a mais.",
  "tp.mod.f.thirdMax": "um terço do máximo",
  "tp.mod.f.half": "metade do máximo",
  "tp.mod.f.leftCharIs": "o primeiro caractere à esquerda é",
  "tp.mod.f.lessThan": "menos de",
  "tp.mod.f.starts": "começa em",
  "tp.mod.f.rested": "Descansado",
  "tp.mod.f.tired": "Cansado",
  "tp.mod.f.exhausted": "Exausto",

  /* ---------- Filtros por chip (listas de entidades da mesa) ---------- */
  "tp.filter.all": "Todos",
  "tp.filter.clear": "Limpar filtros",
  "tp.filter.none": "Nada cai dentro do filtro.",
};

export const EN: Record<string, string> = {
  "tp.title": "Locations",
  "tp.new": "New location",
  "tp.count": "{n} locations",
  "tp.countOne": "{n} location",
  "tp.roots": "{n} territory roots",
  "tp.rootOne": "{n} territory root",
  "tp.searchPh": "Search the territory...",
  "tp.clear": "Clear",
  "tp.region": "Region",
  "tp.loading": "Loading territory...",
  "tp.noResults": "No location matches your search.",
  "tp.empty": "No territory mapped yet. Create your first world.",
  "tp.manyWorlds": "Multiple worlds — open one to explore",
  "tp.noDivisions": "No divisions inside {name} yet.",
  "tp.default": "Default",
  "tp.openMap": "Open map →",
  "tp.divisions": "{n} divisions",
  "tp.division": "{n} division",
  "tp.open": "Open",
  "tp.loc.zoomTrail": "Territory trail",
  "tp.loc.goTo": "Go to {name}",
  "tp.zoomLocked": "Scale above the default location — locked for {name}",
  "tp.loc.defaultSet": "Set as default location",
  "tp.loc.defaultOn": "Default location of this table",
  "tp.loc.battle": "Battlemap",
  "tp.loc.openSubs": "Open divisions",
  "tp.loc.noSubs": "No divisions",
  "tp.loc.sublocations": "Divisions",
  "tp.loc.openOwn": "Open {name}",
  "tp.locKind.world": "World",
  "tp.locKind.continent": "Continent",
  "tp.locKind.nation": "Nation",
  "tp.locKind.region": "Region",
  "tp.locKind.biome": "Biome",
  "tp.locKind.province": "Province",
  "tp.locKind.city": "City",
  "tp.locKind.district": "District",
  "tp.locKind.locale": "Locale",
  "tp.locKind.site": "Site",
  "tp.locKind.battlemap": "Battlemap",
  "tp.locKind.point": "Point of interest",
  "tp.locKind.generic": "Place",

  /* ---------- Add actions ---------- */
  /* The "+" lives in the button template — the label is text only. */
  "tp.add.advantage": "Advantage",
  "tp.add.character": "Character",
  "tp.add.disadvantage": "Disadvantage",
  "tp.add.item": "Item",
  "tp.add.placeCharacter": "Place character",
  "tp.add.skill": "Skill",
  "tp.add.location": "Location",
  "tp.add.modifier": "Modifier",

  /* ---------- Item catalog ---------- */
  "tp.items.empty": "No items in the catalog yet.",
  "tp.items.emptySearch": "No item matches your search.",
  "tp.items.fitLabel": "Size",
  "tp.items.searchPh": "Search items...",
  "tp.items.weaponShort": "Weapon",

  /* ---------- Item kind (badge and count on the list) ---------- */
  "tp.kind.weapon": "Weapon",
  "tp.kind.shield": "Shield",
  "tp.kind.armor": "Armor",
  "tp.kind.equipment": "Equipment",
  "tp.kindCount.weaponOne": "{n} weapon",
  "tp.kindCount.weaponMany": "{n} weapons",
  "tp.kindCount.shieldOne": "{n} shield",
  "tp.kindCount.shieldMany": "{n} shields",
  "tp.kindCount.armorOne": "{n} armor",
  "tp.kindCount.armorMany": "{n} armor",
  "tp.kindCount.equipmentOne": "{n} equipment",
  "tp.kindCount.equipmentMany": "{n} equipment",

  /* ---------- Skill catalog ---------- */
  "tp.skills.empty": "No skills catalogued yet.",
  "tp.skills.emptySearch": "No skill matches your search.",
  "tp.skills.searchPh": "Search skills...",

  /* ---------- Advantage catalog ---------- */
  "tp.advantages.empty": "No advantages catalogued yet.",
  "tp.advantages.emptySearch": "No advantage matches your search.",
  "tp.advantages.searchPh": "Search advantages...",

  /* ---------- Disadvantage catalog ---------- */
  "tp.disadvantages.empty": "No disadvantages catalogued yet.",
  "tp.disadvantages.emptySearch": "No disadvantage matches your search.",
  "tp.disadvantages.searchPh": "Search disadvantages...",

  /* ---------- Table characters ---------- */
  "tp.characters.active": "Active",
  "tp.characters.ally": "Ally",
  "tp.characters.bond": "Disposition",
  "tp.characters.empty": "No characters at this table yet.",
  "tp.characters.emptySearch": "No character matches your search.",
  "tp.characters.enemy": "Enemy",
  "tp.characters.inactive": "Inactive",
  "tp.characters.npc": "NPC",
  "tp.characters.noSheet": "No sheet",
  "tp.characters.player": "Player",
  "tp.characters.searchPh": "Search characters...",
  "tp.characters.status": "Status",

  /* ---------- Session ledger ---------- */
  "tp.chapter": "Chapter",
  "tp.ledger.archive": "Archive",
  "tp.ledger.campaign": "Campaign",
  "tp.ledger.edit": "Edit",
  "tp.ledger.gm": "Game Master",
  "tp.ledger.gmActions": "GM actions",
  "tp.ledger.gmActionsMeta": "Tools reserved for the game master.",
  "tp.ledger.noSeed": "No seed record yet.",
  "tp.ledger.ruledBy": "Ruled by {name}",
  "tp.ledger.title": "Chronicle",

  /* ---------- Chronicle (next session) ---------- */
  "tp.chronicle.awaiting": "Awaiting the GM",
  "tp.chronicle.continue": "Continue the chronicle",
  "tp.chronicle.open": "Open the chronicle",

  /* ---------- Counts ---------- */
  "tp.count.advantagesMany": "{n} advantages",
  "tp.count.advantagesOne": "{n} advantage",
  "tp.count.attacksMany": "{n} attacks",
  "tp.count.attacksOne": "{n} attack",
  "tp.count.charactersMany": "{n} characters",
  "tp.count.charactersOne": "{n} character",
  "tp.count.disadvantagesMany": "{n} disadvantages",
  "tp.count.disadvantagesOne": "{n} disadvantage",
  "tp.count.itemsMany": "{n} items",
  "tp.count.itemsOne": "{n} item",
  "tp.count.recordsInArchive": "in archive",
  "tp.count.recordsInFileMany": "{n} records",
  "tp.count.recordsInFileOne": "{n} record",
  "tp.count.scenesMany": "{n} scenes",
  "tp.count.scenesOne": "{n} scene",
  "tp.count.seatsMany": "{n} seats",
  "tp.count.seatsOne": "{n} seat",
  "tp.count.skillsMany": "{n} skills",
  "tp.count.skillsOne": "{n} skill",

  /* ---------- Seats ---------- */
  "tp.npcs": "NPCs",
  "tp.npcsMarked": "Marked NPCs",
  "tp.players": "Players",
  "tp.seatedOf": "Seated at {name}",
  "tp.seats.emptyBody": "Nobody seated yet. Open a chronicle to seat the characters.",
  "tp.seats.emptyTitle": "No seat filled",

  /* ---------- Seat row ---------- */
  "tp.seat.effectsApplied": "Applied effects",
  "tp.seat.effectsMany": "{n} effects",
  "tp.seat.effectsOne": "{n} effect",
  "tp.seat.noEffects": "No effects",
  "tp.seat.noNameNpc": "Unnamed NPC",
  "tp.seat.noNamePlayer": "Unnamed player",
  "tp.seat.noSheetYet": "No sheet yet",
  "tp.seat.npc": "NPC",
  "tp.seat.player": "Player",

  /* ---------- Table units ---------- */
  "tp.unit.conditions": "Conditions",
  "tp.unit.dossiers": "Dossiers",
  "tp.unit.places": "Places",
  "tp.unit.records": "Records",
  "tp.unit.sheets": "Sheets",

  /* ---------- Default location ---------- */
  "tp.loc.default": "Default location",

  /* ---------- Page subtitles ---------- */
  "tp.settings.subtitle": "Table settings, rules and group preferences.",
  "tp.modifiers.subtitle": "Advantages, disadvantages and effects in play.",
  "tp.visibility.subtitle": "What each participant can see at this table.",

  /* ---------- Fatigue rule ---------- */
  "tp.modifiers.fatigueRule": "The fatigue rule",
  "tp.mod.f.fatigue": "Fatigue",
  "tp.mod.f.tracks": "The fatigue bar has {n} boxes.",
  "tp.mod.f.fills": "Each filled box adds {n} to fatigue.",
  "tp.mod.f.barOf": "Bar {value}/{max}",
  "tp.mod.f.extra": "Each box beyond {n} counts for {n} more.",
  "tp.mod.f.thirdMax": "one third of the maximum",
  "tp.mod.f.half": "half of the maximum",
  "tp.mod.f.leftCharIs": "the leftmost character is",
  "tp.mod.f.lessThan": "less than",
  "tp.mod.f.starts": "starts at",
  "tp.mod.f.rested": "Rested",
  "tp.mod.f.tired": "Tired",
  "tp.mod.f.exhausted": "Exhausted",

  /* ---------- Filtros por chip (listas de entidades da mesa) ---------- */
  "tp.filter.all": "All",
  "tp.filter.clear": "Clear filters",
  "tp.filter.none": "Nothing falls inside the filter.",
};
