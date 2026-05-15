# Geo Territorial

Plataforma de segmentación y visualización de **18 763 puntos de venta** para 90 vendedores en Lima. Asignación automática de territorios mediante clustering espacial y renderizado WebGL a 60 fps.

---

## Demo

> Enlace de despliegue en Vercel: _(agregar URL tras deploy)_

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Base de datos | PostgreSQL + PostGIS (Neon en prod) |
| ORM | Prisma 6 |
| Validación API | Zod |
| Data fetching | TanStack Query v5 |
| Renderizado mapa | Deck.gl 9 (WebGL) — ScatterplotLayer + PolygonLayer |
| Mapa base | MapLibre GL + react-map-gl |
| Algoritmos geo | Turf.js + rbush |
| Procesamiento pesado | Web Worker (`workers/geo.worker.ts`) |
| Búsqueda | Google Places API (`AutocompleteSuggestion` + `Place.fetchFields`) |
| UI | React 19, Tailwind v4, Lucide icons, TypeScript |

---

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Editar DATABASE_URL y NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# 3. Migraciones y seed (90 vendedores + 18 763 puntos desde puntos.xlsx)
npm run db:migrate
npm run db:seed

# 4. Servidor de desarrollo
npm run dev
```

Para cargar puntos desde una fuente externa:
```bash
npx ts-node data_source/send.ts
```

---

## Comandos disponibles

```bash
npm run dev          # Servidor de desarrollo (Turbopack)
npm run build        # prisma generate + next build
npm run db:migrate   # Aplica migraciones pendientes
npm run db:seed      # Carga 90 vendedores + 18 763 puntos desde puntos.xlsx
npm run db:studio    # Prisma Studio en http://localhost:5555
```

Para producción:
```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx prisma db seed
```

---

## Estrategia para 18 000+ puntos

### Renderizado GPU (Deck.gl)
Los 18 763 puntos se renderizan en la GPU mediante `ScatterplotLayer`. El hilo principal nunca itera sobre los puntos para dibujarlos — un solo draw call por frame garantiza 60 fps con todos los puntos visibles.

### Procesamiento off-thread (Web Worker)
El algoritmo de asignación y el filtro espacial corren en `workers/geo.worker.ts`. La UI no se bloquea durante el cálculo.

### Índice espacial R-tree (rbush)
El filtro de radio construye un R-tree con todos los puntos. La búsqueda por bounding box es O(log n); la distancia exacta con Turf.js se aplica solo sobre los candidatos del bbox.

### Algoritmo de asignación — Greedy con capacidad fija
1. Se eligen **k semillas aleatorias** de puntos reales del dataset.
2. Se calculan todos los pares punto↔semilla y se ordenan por distancia.
3. Asignación greedy: cada punto va al vendedor más cercano con cupo disponible.

Esto garantiza exactamente **N puntos por vendedor** sin solapamiento, a diferencia de K-means estándar que no tiene restricción de capacidad.

### Cache HTTP
`/api/points` responde con `Cache-Control: s-maxage=300`. El cache de 5 minutos elimina carga innecesaria a la base de datos en recargas.

---

## Librerías externas y justificación

**Deck.gl 9** — Única opción que mantiene 60 fps con 18k+ geometrías con picking, tooltips y highlight interactivos.

**MapLibre GL + react-map-gl** — Fork open-source de Mapbox GL sin cuota de uso. Integración nativa con Deck.gl como base layer.

**Turf.js** — Librería estándar de geoestadística en JS. Modular (tree-shakeable), no requiere servidor. Usada para convex hull, buffer y distancia exacta.

**rbush** — La implementación R-tree más rápida en JS. Búsqueda O(log n) vs O(n) de iteración lineal — crítico para el filtro de radio sobre 18k puntos.

**TanStack Query v5** — Cache, deduplicación y revalidación automática para las llamadas a `/api/points`, `/api/sellers` y `/api/territories`.

**Next.js 16** — API serverless integrada (evita backend separado), Turbopack para dev rápido, App Router para layouts.

**Prisma 6** — Tipado end-to-end generado desde el schema; migraciones declarativas; compatible con Neon serverless Postgres.

**Google Places API (AutocompleteSuggestion)** — Cobertura completa de Lima y Perú. Se usa el nuevo API async/await (`AutocompleteSuggestion` + `Place.fetchFields`) en lugar del widget deprecado desde marzo 2025.

---

## Escalabilidad a 500 000 puntos

Con 18 763 puntos el cálculo greedy y el filtro espacial corren en el navegador (Web Worker). Con 500k puntos ese enfoque falla en tres frentes:

| Problema | Con 18k (actual) | Con 500k |
|----------|-----------------|----------|
| Descarga inicial | ~2 MB JSON ✓ | ~50 MB JSON ✗ |
| Cálculo greedy | 18k × k pares en Worker ✓ | 500k × k pares — varios segundos ✗ |
| R-tree en memoria | ~5 MB RAM ✓ | ~130 MB RAM en el navegador ✗ |

La solución es **mover el cálculo pesado al servidor** y **reemplazar la descarga masiva por tiles**.

---

### Carga de datos — Vector Tiles (MVT)

En lugar de descargar `GET /api/points` (array JSON completo), el frontend pide tiles por coordenada `{z}/{x}/{y}`. El servidor calcula qué puntos caen en ese tile y devuelve un binario comprimido.

**Backend — nuevo endpoint tileado:**

```ts
// app/api/points/[z]/[x]/[y]/route.ts
import { Pool } from "pg"
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(
  _req: Request,
  { params }: { params: { z: string; x: string; y: string } }
) {
  const { z, x, y } = params

  const sql = `
    WITH mvtgeom AS (
      SELECT
        ST_AsMVTGeom(
          geom_3857,
          ST_TileEnvelope($1, $2, $3),
          extent => 4096, buffer => 64
        ) AS geom,
        id, nombre_cliente, monto_anual, territory_id, color
      FROM puntos_venta
      WHERE geom_3857 && ST_TileEnvelope($1, $2, $3, margin => (64.0/4096))
    )
    SELECT ST_AsMVT(mvtgeom, 'puntos_venta', 4096, 'geom') AS tile
    FROM mvtgeom;
  `

  const result = await pool.query(sql, [z, x, y])
  const tile = result.rows[0]?.tile

  return new Response(tile || new Uint8Array(), {
    headers: {
      "Content-Type": "application/vnd.mapbox-vector-tile",
      "Cache-Control": "public, max-age=60",
    },
  })
}
```

`ST_TileEnvelope` calcula el bbox geográfico del tile. `ST_AsMVTGeom` recorta los puntos a ese bbox. `ST_AsMVT` serializa el resultado como binario Protobuf — solo viajan los puntos visibles en pantalla.

**Tabla con índice espacial requerido:**

```sql
ALTER TABLE puntos_venta ADD COLUMN geom_3857 geometry(Point, 3857);
UPDATE puntos_venta SET geom_3857 = ST_Transform(
  ST_SetSRID(ST_MakePoint(longitud, latitud), 4326), 3857
);
CREATE INDEX puntos_venta_geom_3857_gix ON puntos_venta USING GIST (geom_3857);
```

**Frontend — reemplazar `ScatterplotLayer` por `MVTLayer`:**

```ts
// GeoMap.tsx — con 500k puntos
import { MVTLayer } from "@deck.gl/geo-layers"

const pointsLayer = useMemo(
  () =>
    new MVTLayer({
      id: "sales-points",
      data: "/api/points/{z}/{x}/{y}",   // URL templated — Deck.gl pide los tiles que necesita
      pickable: true,
      getPointRadius: 4,
      pointRadiusMinPixels: 3,
      pointRadiusMaxPixels: 12,
      getFillColor: (f) => f.properties.color ?? [160, 160, 160, 180],
      onClick: (info) => {
        if (info.object) onPointClick?.(info.object.properties)
      },
    }),
  [onPointClick]
)
```

El frontend ya no recibe `points: SalesPoint[]`. Accede a los atributos desde `object.properties` dentro de cada feature del tile.

---

### Clustering server-side — PostGIS

El algoritmo greedy del Web Worker se reemplaza por `ST_ClusterKMeans` en PostgreSQL:

```sql
SELECT vendedor_id, ST_ClusterKMeans(geom, k) OVER () AS cluster_id
FROM puntos_venta;
```

El servidor tiene los 500k puntos con índice GiST — búsquedas O(log n). El cliente solo recibe los **polígonos finales**, no los puntos crudos.

---

### Renderizado — Supercluster a zoom bajo

A zoom ciudad, mostrar 500k puntos individuales sobrecarga la GPU aunque sea con MVTLayer. La solución:

- Zoom bajo → **Supercluster**: ~200 burbujas con conteo agregado.
- Al hacer zoom → el tile siguiente ya contiene los puntos individuales del área visible.

---

### Cache — Redis

Los territorios calculados se guardan en Redis con clave `hash(vendedores + N)`. Si los mismos parámetros ya fueron calculados, el servidor devuelve el resultado cacheado sin ejecutar el clustering de nuevo.

---

## Estructura del proyecto

```
geo1/
├── app/
│   ├── api/
│   │   ├── points/route.ts          # GET + POST (carga masiva)
│   │   ├── sellers/route.ts         # GET vendedores
│   │   └── territories/route.ts    # GET / POST / DELETE
│   ├── layout.tsx
│   └── page.tsx                    # Orquestador principal
├── components/
│   ├── map/
│   │   ├── GeoMap.tsx              # Deck.gl + MapLibre
│   │   └── SearchBar.tsx           # Google Places Autocomplete
│   └── sidebar/
│       └── TerritoryPanel.tsx      # Panel de asignación de territorios
├── data_source/
│   ├── send.ts                     # Carga puntos vía API
│   ├── send-geojson.ts             # Carga puntos en formato GeoJSON
│   └── export.ts                   # Exporta datos
├── lib/
│   ├── db.ts                       # Cliente Prisma singleton
│   ├── useGeoData.ts               # Hook central de datos
│   └── utils.ts                    # Helpers
├── prisma/
│   ├── schema.prisma               # Modelos de datos
│   ├── seed.ts                     # Seed vendedores + puntos
│   └── data/puntos.xlsx            # Dataset fuente
├── types/geo.ts                    # Tipos compartidos
└── workers/geo.worker.ts           # Clustering + filtro espacial
```

---

## Estructura del proyecto — versión 500 000 puntos

Cambios respecto a la estructura actual: se elimina el Web Worker (el cálculo pasa al servidor), se agrega el endpoint tileado MVT, y se añaden la capa de cache Redis y el servicio de clustering PostGIS.

```
geo1/
├── app/
│   ├── api/
│   │   ├── points/
│   │   │   ├── route.ts                  # GET lista (reemplazado por tiles) + POST carga masiva
│   │   │   └── [z]/[x]/[y]/route.ts     # ★ NUEVO — MVT tile endpoint (ST_AsMVT)
│   │   ├── sellers/route.ts              # GET vendedores (sin cambios)
│   │   └── territories/
│   │       ├── route.ts                  # GET / DELETE (sin cambios)
│   │       └── compute/route.ts         # ★ NUEVO — POST dispara ST_ClusterKMeans en PostGIS
│   ├── layout.tsx
│   └── page.tsx                         # Orquestador — ya no pasa points[] a GeoMap
├── components/
│   ├── map/
│   │   ├── GeoMap.tsx                   # ★ MODIFICADO — MVTLayer reemplaza ScatterplotLayer
│   │   └── SearchBar.tsx                # Sin cambios
│   └── sidebar/
│       └── TerritoryPanel.tsx           # Sin cambios
├── lib/
│   ├── db.ts                            # Cliente Prisma singleton
│   ├── redis.ts                         # ★ NUEVO — cliente Redis para cache de territorios
│   ├── tiles.ts                         # ★ NUEVO — helpers ST_TileEnvelope, bbox → sql
│   └── utils.ts                         # Sin cambios
├── prisma/
│   ├── schema.prisma                    # ★ MODIFICADO — agrega geom_3857 + índice GiST
│   ├── migrations/
│   │   └── add_geom_3857/migration.sql  # ★ NUEVO — ALTER TABLE + CREATE INDEX GIST
│   ├── seed.ts                          # Sin cambios
│   └── data/puntos.xlsx                 # Sin cambios
├── types/geo.ts                         # ★ MODIFICADO — MVTFeature en lugar de SalesPoint[]
└── workers/
    └── geo.worker.ts                    # ✕ ELIMINADO — clustering movido a PostGIS
```

### Qué desaparece y qué llega

| Elemento | Antes (18k) | Después (500k) |
|----------|-------------|----------------|
| `GET /api/points` | Devuelve JSON array completo | Redirige o devuelve vacío |
| `GET /api/points/{z}/{x}/{y}` | No existe | ★ Devuelve tile MVT binario |
| `POST /api/territories` | Worker greedy en cliente | ★ `ST_ClusterKMeans` en servidor |
| `workers/geo.worker.ts` | Greedy + R-tree en navegador | ✕ Eliminado |
| `GeoMap.tsx` capa puntos | `ScatterplotLayer(data: points[])` | ★ `MVTLayer(data: "/api/points/{z}/{x}/{y}")` |
| `useGeoData.ts` | Fetch + estado `points[]` | Solo fetch sellers y territories |
| Cache | `Cache-Control: s-maxage=300` en HTTP | ★ Redis con clave `hash(params)` |

---

## Variables de entorno

```bash
DATABASE_URL="postgresql://user:pass@host/geo_territorial"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""   # Requerida para SearchBar; sin ella muestra aviso
```
