---
name: react-vercel-geo1
description: >
  Expert in React 19, Next.js 16 App Router, deck.gl geo components, Tailwind v4,
  and Vercel deployment for the geo1 territorial sales platform.
  Use this skill whenever the user asks about: React components, hooks, Server/Client
  Components, Next.js App Router patterns, deck.gl maps, MapLibre, Web Workers,
  Tailwind v4 styles, Vercel deployment errors, Prisma build issues, environment
  variables, or anything related to building or shipping this project. Trigger even
  if the user just says "deploy", "build", "component", "map", or "style" — the
  context of this project makes it almost always relevant.
---

# React + Vercel Expert — geo1

You are an expert collaborator on the geo1 territorial sales platform. This document gives you the project-specific knowledge to answer questions correctly without having to re-read the entire codebase every time.

## Project snapshot

| Detail | Value |
|--------|-------|
| Framework | Next.js **16.2.6** (App Router, Turbopack) |
| React | **19.2.4** |
| Styling | Tailwind **v4** (`@tailwindcss/postcss`) |
| ORM | Prisma **6** + PostgreSQL/Neon |
| Map render | Deck.gl **9.3.x** + MapLibre GL **5.x** |
| State/fetch | TanStack Query **v5** |
| Validation | Zod **v4** |
| Icons | lucide-react |

## File structure

```
app/
  layout.tsx        ← root layout (Server Component)
  page.tsx          ← main page, orchestrates useGeoData()
components/
  map/
    GeoMap.tsx      ← deck.gl ScatterplotLayer + PolygonLayer over MapLibre
    SearchBar.tsx   ← Google Places API (new async API)
  sidebar/
    TerritoryPanel.tsx ← vendor selector + territory generation UI
workers/
  geo.worker.ts     ← heavy geo processing (greedy NN, convex hull, R-tree)
app/api/
  points/           ← GET all points (5min cache), POST bulk load
  sellers/          ← GET ordered by codigo
  territories/      ← GET/POST/DELETE territories
prisma/
  schema.prisma
  seed.ts           ← loads puntos.xlsx → 90 sellers + 18 763 points
```

## React 19 + Next.js 16 App Router

### Server vs Client Components
- `app/layout.tsx` and `app/page.tsx` are **Server Components** by default.
- Add `'use client'` only when you need: browser APIs, event handlers, hooks, or interactive state.
- `GeoMap.tsx`, `SearchBar.tsx`, and `TerritoryPanel.tsx` are all Client Components (they use hooks and browser APIs).
- Never import a Client Component into a Server Component without wrapping — or just keep it as-is since the current architecture already handles this correctly.

### Data fetching pattern
`useGeoData()` (custom hook in `app/page.tsx`) fetches via TanStack Query v5:
```ts
// v5 syntax — useQuery signature changed from v4
const { data } = useQuery({
  queryKey: ['points'],
  queryFn: () => fetch('/api/points').then(r => r.json()),
  staleTime: 5 * 60 * 1000,
})
```
Don't use `useEffect` + `fetch` — all data fetching goes through TanStack Query.

### Next.js 16 breaking changes (from AGENTS.md)
This is **not** the Next.js you know from training. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the relevant guide. Key differences to watch:
- Layouts and pages in App Router may have changed APIs
- Turbopack is the default dev bundler (`next dev` uses Turbopack)
- Some middleware or config patterns may be different

## Tailwind v4

Tailwind v4 uses **CSS-first configuration** — there is no `tailwind.config.js`.

Config is done in `app/globals.css` using `@theme`:
```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(55% 0.2 250);
}
```

Key changes from v3:
- No `@apply` with custom utilities unless defined in `@layer utilities`
- Arbitrary values still work: `w-[300px]`, `bg-[#ff0000]`
- `tailwind-merge` (v3.6) is used for conditional class merging — use `twMerge()` or `clsx` + `twMerge`

## Deck.gl 9 + MapLibre

`GeoMap.tsx` renders two layers:
```ts
new ScatterplotLayer({
  id: 'points',
  data: salesPoints,
  getPosition: d => [d.longitud, d.latitud],
  getFillColor: d => colorByTerritory(d.territorioId),
  radiusMinPixels: 3,
})

new PolygonLayer({
  id: 'territories',
  data: territories,
  getPolygon: d => d.geoJson.coordinates[0],
  getFillColor: d => [...hexToRgb(d.color), 100], // 40% opacity
})
```

Important patterns:
- `GeoMap.tsx` uses **derived state from props** (not `useEffect`) to sync `center` prop with `viewState`
- Web Worker is instantiated with `new Worker(new URL('../workers/geo.worker.ts', import.meta.url))` — Webpack 5 handles this automatically
- MapLibre base map is **hardcoded** to CartoDB Dark Matter. Don't add env var switching unless asked.

## Google Places SearchBar

`SearchBar.tsx` uses the **new async Places API** (not the deprecated `Autocomplete` widget):
```ts
const suggestions = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input })
const place = await Place.fetchFields({ fields: ['location', 'displayName'] })
```
The `Autocomplete` widget is deprecated for new API keys since March 2025. Don't suggest reverting to it.

## Vercel deployment — this project specifically

### Environment variables (required on Vercel)
```
DATABASE_URL          postgresql://user:pass@host/geo_territorial  (Neon)
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY   (for SearchBar; warns if missing)
```
Set these in Vercel → Project → Settings → Environment Variables. `NEXT_PUBLIC_*` is exposed to the browser.

### Build command
The `package.json` build script is:
```
"build": "prisma generate && next build"
```
Vercel uses this automatically. The `postinstall` hook also runs `prisma generate`, so Prisma client is always generated before build.

### Known Vercel build failure — DO NOT use `prisma.config.ts`
**Critical:** Adding a `prisma.config.ts` file causes the Vercel build to fail. This was already tried and reverted (commit `a695420`). If Prisma configuration is needed, it goes in `prisma/schema.prisma`, not in a separate config file. Do not suggest `prisma.config.ts` as a solution.

### Prisma + Neon tips
- Neon uses **connection pooling** — add `?pgbouncer=true&connection_limit=1` to `DATABASE_URL` if you see connection limit errors in production
- `prisma migrate deploy` (not `dev`) for production migrations
- Seed runs `ts-node` with `--compiler-options '{"module":"CommonJS"}'` — this is required

### Common Vercel build errors and fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Can't resolve '@prisma/client'` | Prisma client not generated | Already handled by `postinstall` + `build` script |
| `Module not found: geo.worker.ts` | Worker path wrong | Use `new URL('../workers/geo.worker.ts', import.meta.url)` |
| `Environment variable not found: DATABASE_URL` | Missing in Vercel env | Add to Vercel project settings |
| Type errors blocking build | Strict TypeScript | Fix the types; don't add `// @ts-ignore` |

## Data models (quick reference)

```prisma
model Vendedor   { id, codigo (unique), nombreCompleto, territorios[] }
model PuntoVenta { id, nombreCliente, latitud, longitud, montoAnual,
                   moneda, ultimaCompra, territorioId? }
model Territorio { id, nombre, color, vendedorId,
                   geoJson Json,   // GeoJSON Polygon — NOT a PostGIS column
                   puntosVenta[], creadoEn }
```

`geoJson` is stored as `Json` type for direct Deck.gl compatibility — no PostGIS needed.

## API routes quick reference

| Route | Method | Notes |
|-------|--------|-------|
| `/api/points` | GET | `Cache-Control: s-maxage=300` |
| `/api/points` | POST | `skipDuplicates: true` bulk load |
| `/api/sellers` | GET | Ordered by `codigo` |
| `/api/territories` | GET | Includes nested vendor + points |
| `/api/territories` | POST | Clears previous, creates new, updates `territorioId` on points |
| `/api/territories` | DELETE | Resets all `territorioId` to null, deletes all territories |

Validation uses Zod v4. All routes should validate request bodies before hitting Prisma.
