# Geo Territorial

Plataforma de segmentación y visualización de **18 763 puntos de venta** para 90 vendedores en Lima. Asignación automática de territorios mediante clustering espacial y renderizado WebGL a 60 fps.

---

## Demo

> Enlace de despliegue en Vercel: _(agregar URL tras deploy)_

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| Base de datos | PostgreSQL + PostGIS (Neon en prod) |
| ORM | Prisma 6 |
| Renderizado mapa | Deck.gl 9 (WebGL) |
| Mapa base | MapLibre GL |
| Algoritmos geo | Turf.js + rbush |
| Procesamiento pesado | Web Worker (`workers/geo.worker.ts`) |
| Búsqueda | Google Places API (AutocompleteSuggestion) |
| UI | React 19, Tailwind v4, TypeScript |

---

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Editar DATABASE_URL y NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

# 3. Migraciones y seed de vendedores
npm run db:migrate
npm run db:seed

# 4. Cargar los 18 763 puntos de venta
npx ts-node data-source/send.ts

# 5. Servidor de desarrollo
npm run dev
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

**MapLibre GL** — Fork open-source de Mapbox GL sin cuota de uso. Integración nativa con Deck.gl como base layer.

**Turf.js** — Librería estándar de geoestadística en JS. Modular (tree-shakeable), no requiere servidor. Usada para convex hull, buffer y distancia exacta.

**rbush** — La implementación R-tree más rápida en JS. Búsqueda O(log n) vs O(n) de iteración lineal — crítico para el filtro de radio sobre 18k puntos.

**Next.js 16** — API serverless integrada (evita backend separado), Turbopack para dev rápido, App Router para layouts.

**Prisma 6** — Tipado end-to-end generado desde el schema; migraciones declarativas; compatible con Neon serverless Postgres.

**Google Places API (AutocompleteSuggestion)** — Cobertura completa de Lima y Perú. Se usa el nuevo API async/await (`AutocompleteSuggestion` + `Place.fetchFields`) en lugar del widget deprecado.

---

## Escalabilidad a 500 000 puntos

El enfoque actual falla en dos puntos con 500k puntos: la descarga inicial (~50 MB de JSON) y el cálculo greedy (500k × k pares). La estrategia de escala:

### Base de datos
- Mover el clustering a **PostgreSQL + PostGIS** con `ST_ClusterKMeans` o `ST_ClusterDBSCAN`.
- Índice GiST espacial para búsquedas por proximidad O(log n) en el servidor.

### Carga de datos
- **Viewport-based loading**: la API devuelve solo los puntos dentro del bounding box visible.
- **Vector Tiles (MVT)**: servir puntos como Mapbox Vector Tiles desde PostGIS (`ST_AsMVT`). Deck.gl los consume con `MVTLayer` — solo se descargan los tiles visibles.

### Renderizado
- **Supercluster** a zoom bajo: mostrar ~200 clusters con conteo en lugar de 500k puntos.
- Al hacer zoom, revelar puntos individuales del tile actual.

### Procesamiento
- **Worker Pool + SharedArrayBuffer**: múltiples workers en paralelo para el greedy.
- **Redis** para cachear territorios calculados con los mismos parámetros.

---

## Estructura del proyecto

```
geo1/
├── app/
│   ├── api/
│   │   ├── points/route.ts        # GET + POST (carga masiva)
│   │   ├── sellers/route.ts       # GET vendedores
│   │   └── territories/route.ts   # GET / POST / DELETE
│   └── page.tsx                   # Orquestador principal
├── components/
│   ├── map/GeoMap.tsx             # Deck.gl + MapLibre
│   └── map/SearchBar.tsx          # Google Places Autocomplete
├── workers/geo.worker.ts          # Clustering + filtro espacial
├── lib/useGeoData.ts              # Hook central
└── prisma/schema.prisma           # Modelos de datos
```

---

## Variables de entorno

```bash
DATABASE_URL="postgresql://user:pass@host/geo_territorial"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""   # Requerida para SearchBar
```
