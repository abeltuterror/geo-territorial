# Geo Territorial — Optimización y Análisis Espacial

Herramienta administrativa para visualizar **18,763 puntos de venta** y segmentarlos territorialmente entre 90 vendedores mediante polígonos generados automáticamente.

## Stack

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Base de datos | **Neon (PostgreSQL + PostGIS)** | Índices GIST nativos para consultas espaciales |
| ORM | **Prisma + Zod** | Tipado end-to-end, validación de esquemas |
| Backend | **Next.js 15 App Router** | API Routes serverless, caché integrado |
| Procesamiento | **Web Workers + Turf.js** | K-means + convex hull sin bloquear el hilo principal |
| Visualización | **Deck.gl (WebGL)** | Renderizado por GPU — 60 FPS con 18k puntos |
| Mapa base | **MapLibre** (dev) / **Google Maps** (prod) | Swap via env var, sin lock-in |

## Setup local

```bash
# 1. Clonar e instalar
git clone <repo>
npm install

# 2. Variables de entorno
cp .env.local.example .env.local
# Editar: DATABASE_URL, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# 3. Crear tablas en Neon (primera vez)
npx prisma migrate dev --name init

# 4. Cargar datos
npm run db:seed          # 90 vendedores
# + cargar los 18,763 puntos desde Excel/CSV

# 5. Correr en desarrollo
npm run dev
```

## Variables de entorno

```env
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
NEXT_PUBLIC_MAP_PROVIDER=maplibre   # o "google"
```

## Estrategia para 18k puntos

1. **Carga única vía seed** (`prisma db seed`) — los datos están en BD al arrancar el demo.
2. **API con caché HTTP** — `Cache-Control: s-maxage=300` evita re-queries innecesarias.
3. **Web Worker** — los 18k puntos se cargan en memoria del worker, no en el hilo principal.
4. **Deck.gl ScatterplotLayer** — renderizado por GPU: sin DOM manipulation, sin React re-renders por punto.

## Algoritmo de asignación territorial

1. **K-means espacial** (implementado a mano sobre lng/lat) — divide N puntos en K clusters contiguos.
2. **Convex hull** con `turf.convex()` — genera el polígono mínimo que encierra cada cluster.
3. **Buffer de 50m** — asegura que los puntos en el borde queden dentro del polígono.
4. **R-tree (rbush)** — point-in-polygon en O(log n) en vez de O(n) para filtros de radio.

## Escalabilidad a 500,000 puntos

| Problema | Solución actual | Solución a 500k |
|----------|----------------|-----------------|
| Transferencia de datos | API JSON (~3MB) | Tiles vectoriales (MVT) con PostGIS `ST_AsMVT` |
| Renderizado | Deck.gl ScatterplotLayer | Deck.gl + GPU aggregation layers |
| Clustering | K-means en Worker | DBSCAN en Worker o pre-clustering en BD |
| Búsqueda espacial | rbush in-memory | PostGIS `ST_DWithin` con índice GIST |
| API latency | Cache HTTP 5min | Redis + revalidación incremental |

## Librerías externas

- **`@deck.gl/react`** — renderizado WebGL de capas geoespaciales
- **`@turf/turf`** — cálculos geoespaciales (convex hull, buffer, distance)
- **`rbush`** — R-tree spatial index para point-in-polygon O(log n)
- **`react-map-gl` + `maplibre-gl`** — wrapper React para MapLibre (mapa base dev)
- **`@vis.gl/react-google-maps`** — integración oficial Google Maps
- **`zod`** — validación de esquemas en API routes
- **`prisma`** — ORM con soporte PostGIS via extensiones
