# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

# Geo Territorial — Arquitectura del proyecto

Plataforma de gestión y visualización de territorios de ventas. Asigna 18 763 puntos de venta a 90 vendedores mediante clustering espacial y renderiza el resultado en un mapa WebGL interactivo.

---

## Comandos

```bash
npm run dev              # Servidor de desarrollo (Turbopack)
npm run build            # prisma generate + next build
npm run db:migrate       # Aplica migraciones pendientes (prisma migrate deploy)
npm run db:seed          # Carga 90 vendedores + 18 763 puntos desde puntos.xlsx
npm run db:studio        # Prisma Studio en http://localhost:5555
```

Para producción, prefija con `DATABASE_URL="postgresql://..."`:
```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx prisma db seed
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Base de datos | PostgreSQL + PostGIS (Neon en prod) |
| ORM | Prisma 6 |
| Validación API | Zod |
| Renderizado mapa | Deck.gl 9 (WebGL) — `ScatterplotLayer` + `PolygonLayer` |
| Mapa base | MapLibre GL (hardcodeado CartoDB Dark Matter en `GeoMap.tsx`) |
| Algoritmos geo | Turf.js + rbush |
| Procesamiento pesado | Web Worker (`workers/geo.worker.ts`) |
| Búsqueda | Google Places API — `AutocompleteSuggestion` + `Place.fetchFields` (nuevo API async) |
| UI | React 19, Tailwind v4, Lucide icons |

---

## Flujo de datos

```
page.tsx
  └─ useGeoData()
       ├─ GET /api/points      → SalesPoint[]  (cache HTTP 5 min)
       ├─ GET /api/sellers     → Seller[]
       ├─ GET /api/territories → Territory[]
       ├─ assignTerritories()  → ASSIGN_TERRITORIES → geo.worker.ts
       │    └─ Greedy nearest neighbor + convex hull → POST /api/territories
       └─ filterByRadius()     → FILTER_RADIUS → geo.worker.ts
            └─ R-tree + Turf distance → Set<id> filteredIds

GeoMap.tsx
  ├─ ScatterplotLayer  (puntos coloreados por territorio)
  └─ PolygonLayer      (polígonos de territorio, 40% opacidad)

TerritoryPanel.tsx
  ├─ Selección de vendedores + puntos por vendedor
  ├─ Botón "Generar territorios" → assignTerritories()
  └─ Botón "Limpiar" → DELETE /api/territories
```

---

## Algoritmos (`workers/geo.worker.ts`)

**ASSIGN_TERRITORIES — Greedy Nearest Neighbor con capacidad fija**
1. Elige k semillas aleatorias de puntos reales del dataset (`pickRandomSeeds`)
2. Calcula todos los pares punto↔semilla ordenados por distancia euclidiana
3. Asignación greedy: cada punto va al vendedor más cercano con cupo disponible
4. Garantiza exactamente `pointsPerSeller` puntos por vendedor sin solapamiento
5. `buildPolygon()` — `turf.convex()` + `turf.buffer(0.05 km)` sobre los puntos asignados

> No usa K-means — K-means no tiene restricción de capacidad y produce clusters de tamaños desiguales.

**FILTER_RADIUS — R-tree**
- Construye índice rbush con todos los puntos (O(n log n))
- Búsqueda por bounding box O(log n), luego distancia exacta con `turf.distance()` sobre candidatos

---

## API Routes

| Ruta | Método | Comportamiento |
|------|--------|---------------|
| `/api/points` | GET | Todos los puntos; `Cache-Control: s-maxage=300` |
| `/api/points` | POST | Carga masiva JSON o GeoJSON; `skipDuplicates: true` |
| `/api/sellers` | GET | Vendedores ordenados por `codigo` |
| `/api/territories` | GET | Territorios con vendedor y puntosVenta anidados |
| `/api/territories` | POST | Body: `{ assignments[] }` — limpia anteriores, crea nuevos, actualiza `territorioId` en puntos |
| `/api/territories` | DELETE | Resetea todos los `territorioId` a null y borra territorios |

---

## Modelos de datos

```prisma
model Vendedor   { id, codigo (unique), nombreCompleto, territorios[] }
model PuntoVenta { id, nombreCliente, latitud, longitud, montoAnual,
                   moneda, ultimaCompra, territorioId? }
model Territorio { id, nombre, color, vendedorId, geoJson (GeoJSON Polygon),
                   puntosVenta[], creadoEn }
```

- `geoJson` se guarda como `Json` (no columna espacial PostGIS) — compatible con Deck.gl directo.
- Índice compuesto `[longitud, latitud]` en `PuntoVenta`.

---

## Variables de entorno

```bash
DATABASE_URL="postgresql://user:pass@host/geo_territorial"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""    # Requerida para SearchBar; sin ella muestra aviso
```

---

## Consideraciones importantes

- **SearchBar** usa `AutocompleteSuggestion.fetchAutocompleteSuggestions()` + `Place.fetchFields()` — el widget `Autocomplete` está deprecado para claves nuevas desde marzo 2025.
- **MapLibre** está hardcodeado en `GeoMap.tsx`. La variable `NEXT_PUBLIC_MAP_PROVIDER` existe pero no se usa.
- **PostGIS** está habilitado en el schema pero las consultas usan Prisma estándar; no hay queries `ST_*` activas.
- El **Web Worker** usa `import.meta.url` — requiere Webpack 5+ (Next.js lo maneja automáticamente).
- El seed (`prisma/seed.ts`) carga tanto los vendedores como los 18 763 puntos desde `prisma/data/puntos.xlsx`.
- `GeoMap.tsx` usa el patrón de estado derivado de props (no `useEffect`) para sincronizar el prop `center` con `viewState`.
