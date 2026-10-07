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
