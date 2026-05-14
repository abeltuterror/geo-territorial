@AGENTS.md

# Geo Territorial — Arquitectura del proyecto

Plataforma de gestión y visualización de territorios de ventas. Asigna 18 763 puntos de venta a 90 vendedores mediante clustering espacial K-means y renderiza el resultado en un mapa WebGL interactivo.

---

## Stack tecnológico

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Framework | Next.js 16 (App Router) | API serverless + SSR/RSC |
| Base de datos | PostgreSQL + PostGIS (Neon en prod, local en dev) | Índices espaciales GIST |
| ORM | Prisma 6 + extensión postgis | Tipado end-to-end |
| Validación API | Zod | Esquemas seguros en rutas POST |
| Renderizado mapa | Deck.gl 9 (WebGL) | GPU rendering de 18k puntos a 60 FPS |
| Mapa base | MapLibre (dev) / Google Maps (prod) | Intercambiable por env var |
| Algoritmos geo | Turf.js + rbush | Convex hull, buffer, R-tree |
| Procesamiento pesado | Web Worker (`workers/geo.worker.ts`) | K-means off-thread (no bloquea UI) |
| UI | React 19, Tailwind v4, Lucide icons | — |

---

## Estructura de archivos

```
geo1/
├── app/
│   ├── api/
│   │   ├── points/route.ts        # GET  → 18 763 puntos (cache 5 min)
│   │   ├── sellers/route.ts       # GET  → 90 vendedores
│   │   └── territories/route.ts   # GET / POST / DELETE territorios
│   ├── layout.tsx
│   └── page.tsx                   # Página principal (client component)
├── components/
│   ├── map/
│   │   ├── GeoMap.tsx             # Deck.gl + MapLibre, ScatterplotLayer + PolygonLayer
│   │   └── SearchBar.tsx          # Google Places Autocomplete (solo Perú)
│   └── sidebar/
│       └── TerritoryPanel.tsx     # Panel de asignación y estadísticas
├── lib/
│   ├── db.ts                      # Singleton PrismaClient
│   ├── useGeoData.ts              # Hook central: datos + comunicación con worker
│   └── utils.ts                   # cn(), formatCurrency(), getTerritoryColor(), hexToRgb()
├── types/
│   └── geo.ts                     # SalesPoint, Seller, Territory, TerritoryAssignmentParams
├── workers/
│   └── geo.worker.ts              # K-means, convex hull, filtro radio (R-tree)
└── prisma/
    ├── schema.prisma              # Modelos: Seller, SalesPoint, Territory
    ├── seed.ts                    # Carga vendedores + 18 763 puntos desde puntos.xlsx
    └── data/puntos.xlsx           # Fuente de datos (no versionar si es grande)
```

---

## Modelos de datos

```prisma
model Vendedor   { id, codigo (unique), nombreCompleto, territorios[] }
                   → tabla: vendedores

model PuntoVenta { id, nombreCliente, latitud, longitud, montoAnual,
                   moneda, ultimaCompra, territorioId? }
                   → tabla: puntos_venta

model Territorio { id, nombre, color, vendedorId, geoJson (GeoJSON Polygon),
                   puntosVenta[], creadoEn }
                   → tabla: territorios
```

- `geoJson` se guarda como `Json` (no columna espacial PostGIS) — compatible con Deck.gl directo.
- Índice compuesto `[longitud, latitud]` en `PuntoVenta` para consultas de proximidad.

---

## Flujo de datos

```
page.tsx
  └─ useGeoData()
       ├─ GET /api/points    → SalesPoint[]  (cache HTTP 5 min)
       ├─ GET /api/sellers   → Seller[]
       ├─ GET /api/territories → Territory[]
       ├─ assignTerritories() → ASSIGN_TERRITORIES → geo.worker.ts
       │    └─ K-means + convex hull → POST /api/territories
       └─ filterByRadius()  → FILTER_RADIUS  → geo.worker.ts
            └─ R-tree + Turf distance → Set<id> filteredIds

GeoMap.tsx
  ├─ ScatterplotLayer  (puntos coloreados por territorio)
  └─ PolygonLayer      (polígonos de territorio, 40% opacidad)

TerritoryPanel.tsx
  ├─ Selección de vendedores + puntos por vendedor
  ├─ Botón "Asignar" → assignTerritories()
  └─ Botón "Limpiar" → DELETE /api/territories
```

---

## Algoritmos (geo.worker.ts)

| Función | Descripción |
|---------|-------------|
| `kMeansClustering(points, k)` | K-means euclidiano, máx 50 iteraciones, centroides iniciales distribuidos uniformemente |
| `buildPolygon(points)` | `turf.convex()` + `turf.buffer(0.05 km)` para incluir puntos en el borde |
| R-tree (rbush) | Índice espacial para filtro de radio; búsqueda O(log n) en bounding box, distancia exacta con `turf.distance()` |

---

## API Routes

| Ruta | Método | Comportamiento |
|------|--------|---------------|
| `/api/points` | GET | Todos los puntos; `Cache-Control: s-maxage=300` |
| `/api/sellers` | GET | Vendedores ordenados por `codigo` |
| `/api/territories` | GET | Territorios con vendedor y puntosVenta anidados |
| `/api/territories` | POST | Body: `{ assignments[] }` — limpia anteriores, crea nuevos, actualiza `territorioId` en puntos |
| `/api/territories` | DELETE | Resetea todos los `territorioId` a null y borra territorios |

---

## Variables de entorno

```bash
DATABASE_URL="postgresql://geo_user:geo123@localhost:5432/geo_territorial"
NEXT_PUBLIC_MAP_PROVIDER="maplibre"          # "maplibre" | "google"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""           # Requerida para SearchBar
```

---

## Scripts útiles

```bash
npm run dev              # Servidor de desarrollo (Turbopack)
npm run build            # prisma generate + next build
npm run db:migrate       # Aplica migraciones pendientes
npm run db:seed          # Carga vendedores + 18 763 puntos desde puntos.xlsx
npm run db:studio        # Prisma Studio en http://localhost:5555
psql postgresql://geo_user:geo123@localhost:5432/geo_territorial
                         # Consola SQL directa
```

---

## Funcionalidades del sistema

1. **Visualización de puntos de venta** — 18 763 puntos sobre mapa oscuro (CartoDB Dark Matter), coloreados por territorio asignado.
2. **Asignación automática de territorios** — Seleccionar vendedores + cantidad de puntos → K-means genera clusters + polígonos convexos → guardado en DB.
3. **Filtro por radio** — SearchBar con Google Places autocomplete busca una ubicación en Perú y filtra puntos en un radio configurable (default 3 km).
4. **Panel de estadísticas** — Por territorio: total de clientes, monto anual acumulado, lista de primeros 50 clientes.
5. **Limpieza de territorios** — Borra todas las asignaciones y polígonos de la DB.

---

## Consideraciones importantes

- **PostGIS está habilitado** en el schema pero las consultas usan Prisma estándar (JSON); no hay queries `ST_*` activas aún.
- **SearchBar** solo funciona si `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` tiene valor; si no, muestra mensaje de aviso.
- **MapLibre style** está hardcodeado en `GeoMap.tsx` (CartoDB Dark Matter). El env `MAP_PROVIDER` no se usa dentro del componente aún.
- El **Web Worker** usa `import.meta.url` — requiere Webpack 5+ (Next.js lo maneja automáticamente).
- Los puntos de venta **no se cargan por seed** — hay que ejecutar `load-points.ts` separado desde el Excel.
