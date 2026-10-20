# VK-RPG — Front

> A platform for playing games and telling stories.

The **narrator & player client** for VK-RPG: a [Next.js](https://nextjs.org) (App Router) + React 19 + Tailwind CSS 4 interface over the VK-RPG API. It carries two trails — the narrator's *desk* (green) and the player's *console* (blue) — on a dark "tabletop ledger" theme, and ships bilingual (Português / English).

```
      ___
    /\\6 /\\
   /  \\/  \\
  | 5 || 4 |
   \\  /\\  /
    \\/  \\/
     3
```

> *A D6 rolled a 3.*

## Requirements

- Node.js 20+
- The **VK-RPG API** running on `http://localhost:3000` (see the `VKRPG` backend repository)

## Installation

```bash
npm install
```

## Running

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server on http://localhost:3001 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Configuration

The client reaches the API through a same-origin `/api` proxy:

- **Browser** — requests hit `/api/**` and are rewritten by `next.config.ts` to `http://localhost:3000/**` (avoids CORS; the backend stays on port 3000).
- **Server Components** — `lib/api.ts` resolves the base from `API_URL`.

| Variable | Side | Default | Description |
|----------|------|---------|-------------|
| `API_URL` | server | `http://localhost:3000` | Base URL used by server-side fetches |

## Routes

### Narrator (GM) trail

| Path | Description |
|------|-------------|
| `/` | Home — pick a perspective (narrator or player) |
| `/narrator` | Narrator desk — campaign dossiers |
| `/narrator/kit` | Narrator kit — shortcuts and dice roller |
| `/table/new` | Create a game table (guided wizard) |
| `/table/:id` | Campaign ledger — table overview |
| `/table/:id/edit` | Edit the table |
| `/table/:id/items` | Items |
| `/table/:id/advantages` | Advantages |
| `/table/:id/disadvantages` | Disadvantages |
| `/table/:id/skills` | Skills |
| `/table/:id/characters` | Characters and NPCs |
| `/table/:id/locations` | Locations |
| `/table/:id/locations/new` | Create a location |
| `/table/:id/scenes` | Chronicle — scene timeline |
| `/table/:id/map` | Battle-log map |
| `/table/:id/sessions` | Sessions |
| `/table/:id/visibility` | Visibility rules |
| `/table/:id/modifiers` | Modifiers / conditions |
| `/table/:id/settings` | Table settings |
| `/user/:id` | User profile |

### Entity pages

| Path | Description |
|------|-------------|
| `/advantage` | Advantage catalog (across tables) |
| `/advantage/new` · `/advantage/:id` · `/advantage/:id/edit` | Create · detail · edit advantage |
| `/disadvantage` | Disadvantage catalog (across tables) |
| `/disadvantage/new` · `/disadvantage/:id` · `/disadvantage/:id/edit` | Create · detail · edit disadvantage |
| `/skill/new` · `/skill/:id` · `/skill/:id/edit` | Create · detail · edit skill |
| `/item/new` · `/item/:id` · `/item/:id/edit` | Create · detail · edit item |
| `/character/new` · `/character/:id` · `/character/:id/edit` | Create · sheet · edit character |
| `/npc/new` · `/npc/:id/edit` | Create · edit NPC |
| `/location/:id` · `/location/:id/edit` | Detail · edit location |

### Player trail

| Path | Description |
|------|-------------|
| `/player` | Player console — "your company" |
| `/player/table/:id/character/new` | Create a character for a table |
| `/player/character` | Resolve the local seat and redirect to its console |
| `/player/character/:id` | Character console (sheet + table) |
| `/player/character/:id/view` | Read-only sheet through a viewer's visibility |
| `/player/character/:id/session` | Live session |

## API endpoints

The client talks to the VK-RPG API over `lib/api.ts` (`api<T>()`) and a few raw `fetch()` / `EventSource` calls. In the browser every path below is prefixed with `/api` (rewritten by `next.config.ts`); Server Components hit the same paths against `API_URL`. Paths are relative to the API base.

`id` parameters are table / entity ids. A few write routes carry the id in the **body** instead of the path (noted below).

### Users

| Method | Path | Used by |
|--------|------|---------|
| `POST` | `/create-user` | Guest narrators panel (create a type-3 user) |
| `GET` | `/users` | Table wizard, character form, player character creation |
| `GET` | `/users/:id` | User profile page |

### Game tables & chronicle

| Method | Path | Used by |
|--------|------|---------|
| `POST` | `/create-game-table` | Table wizard, table form |
| `GET` | `/game-tables` | Narrator desk, player console, create forms |
| `GET` | `/game-table/:id` | Table ledger, join landing |
| `PUT` | `/game-table/edit/:id` | Table form |
| `GET` | `/game-table-scenes/:id` | Ledger, scenes, map, sessions, visibility, modifiers, player |
| `POST` | `/game-table-scene` | Session client |
| `PUT` | `/game-table-scene/:id` | Scene timeline (set image) |
| `POST` | `/game-table-narration` | Session client |
| `POST` | `/game-table-action` | Session client, player session |
| `PUT` | `/game-table-action/:id` | Session client |
| `DELETE` | `/game-table-action/:id` | Session client |
| `POST` | `/game-table-action/:id/copy` | Session client |
| `GET` | `/content-modules` | Table wizard |

### Join (pre-approval) & access

| Method | Path | Used by |
|--------|------|---------|
| `GET` | `/game-table/:id/join` | `lib/join.ts` — request status |
| `POST` | `/game-table/:id/join` | `lib/join.ts` — submit request |
| `DELETE` | `/game-table/:id/join/:userId` | `lib/join.ts` — cancel request |
| `GET` | `/game-table/:id/join/candidates` | `lib/join.ts` |
| `GET` | `/game-table/:id/join-requests` | `lib/join.ts`, join requests panel |
| `POST` | `/game-table/:id/join-requests/:userId` | `lib/join.ts` — approve / reject |
| `GET` | `/game-table/:id/members` | `lib/join.ts`, `TableMembersPanel` — roster (owner only) |
| `PUT` | `/game-table/:id/members/:userId/mute` | `lib/join.ts`, `TableMembersPanel` — mute / unmute a player |
| `DELETE` | `/game-table/:id/members/:userId` | `lib/join.ts`, `TableMembersPanel` — remove a player |
| `POST` | `/game-table/:id/leave` | `lib/join.ts`, `TableLobby` — a player leaves the table |
| `GET` | `/game-table/:id/membership` | `lib/player.ts` — is the viewer a player? muted? |
| `GET` | `/game-table/:id/access` | Guest narrators panel |
| `POST` | `/game-table/:id/access` | Guest narrators panel (grant) |
| `PUT` | `/game-table/:id/access` | Guest narrators panel (update) |
| `DELETE` | `/game-table/:id/access/:userId` | Guest narrators panel (revoke) |

### Characters & NPCs

| Method | Path | Used by |
|--------|------|---------|
| `GET` | `/game-table-characters/:id` | Catalogs, player console, visibility |
| `GET` | `/game-table-character/:id` | Sheet, edit form, viewer |
| `POST` | `/game-table-character` | Character form, player first sheet |
| `PUT` | `/game-table-character` | Character form (**id in body**) |
| `PUT` | `/game-table-character/:id/images` | Character gallery |
| `DELETE` | `/game-table-character/:id` | Characters page |
| `POST` | `/game-table-character/:id/copy` | Characters page |
| `GET` | `/game-table-character/:id/history` | Character journey |
| `POST` | `/game-table-character/points` | Table quick actions (award XP) |
| `POST` | `/game-table-character/modifier` | Character sheet (toggle rule) |
| `GET` | `/game-table-npcs/:id` | NPC catalogs, location shop |
| `GET` | `/game-table-npc/:id` | NPC edit form |
| `POST` | `/game-table-npc` | Character / NPC forms |
| `PUT` | `/game-table-npc` | NPC form (**id in body**) |
| `DELETE` | `/game-table-npc/:id` | Characters page |
| `POST` | `/game-table-npc/:id/copy` | Characters page |

### Equipment & inventory

| Method | Path | Used by |
|--------|------|---------|
| `PUT` | `/game-table-character-equipment` | Gear panel, player inventory |
| `DELETE` | `/game-table-character-equipment` | Player inventory (drop) |
| `POST` | `/game-table-character-equipment/transfer` | Player inventory (trade) |
| `POST` | `/game-table-character-equipment/sell` | Player inventory (sell) |

### Items, skills, advantages & disadvantages

| Method | Path | Used by |
|--------|------|---------|
| `GET` | `/game-table-items/:id` | Item catalogs, forms |
| `GET` | `/game-table-item/:id` | Item detail / edit |
| `POST` | `/game-table-item` | Item form |
| `PUT` | `/game-table-item` | Item form (**id in body**) |
| `DELETE` | `/game-table-item/:id` | Items page |
| `POST` | `/game-table-item/:id/copy` | Items page |
| `POST` | `/game-table-item/grant` | Table quick actions |
| `GET` | `/game-table-skills/:id` | Skill catalogs, forms |
| `GET` | `/game-table-skill/:id` | Skill detail / edit |
| `POST` | `/game-table-skill` | Skill form |
| `PUT` | `/game-table-skill/:id` | Skill form |
| `DELETE` | `/game-table-skill/:id` | Skills page |
| `POST` | `/game-table-skill/:id/copy` | Skills page |
| `POST` | `/game-table-skill-relation/:kind` | Skill relations |
| `PUT` | `/game-table-skill-relation/:kind/:id` | Skill relations |
| `DELETE` | `/game-table-skill-relation/:kind/:id` | Skill relations |
| `GET` | `/game-table-advantages/:id` | Advantage catalogs |
| `GET` | `/game-table-advantage/:id` | Advantage detail |
| `POST` | `/game-table-advantage` | Advantage form |
| `PUT` | `/game-table-advantage/:id` | Advantage form |
| `DELETE` | `/game-table-advantage/:id` | Advantages page |
| `POST` | `/game-table-advantage/:id/copy` | Advantages page |
| `GET` | `/game-table-disadvantages/:id` | Disadvantage catalogs |
| `GET` | `/game-table-disadvantage/:id` | Disadvantage detail |
| `POST` | `/game-table-disadvantage` | Disadvantage form |
| `PUT` | `/game-table-disadvantage/:id` | Disadvantage form |
| `DELETE` | `/game-table-disadvantage/:id` | Disadvantages page |
| `POST` | `/game-table-disadvantage/:id/copy` | Disadvantages page |

### Locations

| Method | Path | Used by |
|--------|------|---------|
| `GET` | `/game-table-locations/:id` | Location pages, forms, player atlas |
| `GET` | `/table-location/:id` | Location detail / edit |
| `GET` | `/table-location/:id/table` | `lib/actor.ts` (resolve owner table) |
| `POST` | `/table-location` | Location form |
| `PUT` | `/table-location/:id` | Location form, map studio |
| `DELETE` | `/table-location/:id` | Location plate |
| `PUT` | `/table-location/:id/images` | Location gallery |
| `POST` | `/game-table-locations/default` | Locations atlas (set default) |
| `GET` | `/table-location/:id/links` | Location links |
| `POST` | `/table-location/:id/link` | Location links |
| `PUT` | `/table-location-link/:id` | Location links |
| `DELETE` | `/table-location-link/:id` | Location links |
| `POST` | `/table-location/:id/copy` | Locations atlas |

### Modifiers, visibility, queue & settings

| Method | Path | Used by |
|--------|------|---------|
| `GET` | `/game-table-modifiers/:id` | Modifiers panel, entity / location modifiers |
| `POST` | `/game-table-modifier` | Modifiers panel, quick actions, forms |
| `PUT` | `/game-table-modifier` | Modifiers panel, entity / location modifiers |
| `DELETE` | `/game-table-modifier/:id` | Entity modifiers |
| `GET` | `/game-table-visibility/:id` | Visibility panel, location visibility, player |
| `POST` | `/game-table-visibility` | Visibility panels |
| `PUT` | `/game-table-visibility` | Visibility panels |
| `GET` | `/game-table-queue/:id` | Sessions page, player |
| `POST` | `/game-table-queue` | Session client |
| `PUT` | `/game-table-queue` | Session client |
| `GET` | `/game-table-settings/:id` | Settings page, character forms, sessions |
| `PUT` | `/game-table-settings` | Settings panel, table wizard |
| `POST` | `/game-table-end-turn` | Player session (end turn) |
| `POST` | `/game-table-roll-effect` | Player session, session client |

### Live updates & uploads

| Method | Path | Used by |
|--------|------|---------|
| `GET` (SSE) | `/realtime/events/:tableId` | `lib/useTableLive.ts` (live table events) |
| `POST` | `/upload` | `lib/api.ts` `uploadImage()` (base64 → `/uploads` URL) |
| `GET` | `/uploads/*` | Static images (portrait, map, scene) |

> Backend endpoints the front does **not** consume: `GET /users/search/:searchTerm`, `PUT /users/edit/:id`, `GET /table-access/resources`, `GET /table-join/roles`, the `/game-table-peculiarit*` routes, `GET /game-table-queue-item/:id`, `GET /game-table-visibility-item/:id`, and `POST|DELETE /game-table-character/trait`.

## Project structure

```
app/          # App Router pages (server + client components)
components/   # UI building blocks (table, character, player, modifiers, ...)
lib/          # API client, shared types, i18n and rules helpers
```

- `lib/api.ts` — typed fetch wrapper (`api<T>(path)`); reads `API_URL` on the server, uses the `/api` proxy in the browser.
- `lib/types.ts` — shapes returned by the API.
- `lib/i18n-core.ts` + `lib/i18n-parts/*` — PT/EN dictionaries; `lib/i18n.tsx` (client) and `lib/i18n-server.ts` (server) resolve the current language.
- `lib/units.ts`, `lib/categories.ts` — presentation helpers (weights shown in kg, category slugs translated).

## Internationalization

The UI is available in **Portuguese (default)** and **English**. The active language lives in the `vkrpg.lang` cookie and is switched from the header. Add new strings to both the `PT` and `EN` maps under `lib/i18n-parts/`.

## Related

- **VK-RPG API** (`VKRPG`) — Express + `better-sqlite3` backend serving the JSON endpoints this client consumes.
