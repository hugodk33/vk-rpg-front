/* ============================================================
   i18n-parts/en — chaves novas das PÁGINAS de entidades.
   Blocos avulsos do dicionário, prontos para serem mesclados
   ao dict de lib/i18n-core.ts (spread ...PT / ...EN).

   Chaves reaproveitadas do dict existente (não repetidas aqui):
     itm.back    → "Voltar à mesa"   (desvantagem)
     itm.cost    → "Custo"
     skx.effect  → "Efeito"
     ra.edit     → "Editar"
   ============================================================ */

export const PT: Record<string, string> = {
  /* ---------- app/disadvantage/[id] ---------- */
  "en.disadvantage.unnamed": "Desvantagem sem nome",
  "en.disadvantage.description": "Descrição",
  "en.disadvantage.category": "Categoria",

  /* ---------- app/user/[id] ---------- */
  "en.backHome": "Voltar ao início",
  "en.user.unnamed": "Usuário sem nome",
  "en.user.typeAdmin": "Administrador",
  "en.user.typePlayer": "Jogador",
  "en.user.email": "Email",
  "en.user.phone": "Telefone",

  /* ---------- app/player/character/[id]/view ---------- */
  "en.player.selfViewNote":
    "Você está vendo este personagem como o seu personagem. Tudo o que você ainda não consegue ver (o narrador manteve oculto) é o que você ainda não descobriu em jogo — não é um bug da página.",
};

export const EN: Record<string, string> = {
  /* ---------- app/disadvantage/[id] ---------- */
  "en.disadvantage.unnamed": "Unnamed disadvantage",
  "en.disadvantage.description": "Description",
  "en.disadvantage.category": "Category",

  /* ---------- app/user/[id] ---------- */
  "en.backHome": "Back to home",
  "en.user.unnamed": "Unnamed user",
  "en.user.typeAdmin": "Administrator",
  "en.user.typePlayer": "Player",
  "en.user.email": "Email",
  "en.user.phone": "Phone",

  /* ---------- app/player/character/[id]/view ---------- */
  "en.player.selfViewNote":
    "You are viewing this character as your own character. Anything you still cannot see (the narrator kept hidden) is what you have not discovered in play — it is not a page bug.",
};
