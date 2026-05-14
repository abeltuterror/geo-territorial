import * as turf from "@turf/turf"
import RBush from "rbush"
import type { SalesPoint, TerritoryAssignmentParams } from "@/types/geo"
import type { Feature, Point, Polygon, FeatureCollection } from "geojson"

interface RBushItem {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
}

interface WorkerMessage {
  type: "ASSIGN_TERRITORIES" | "FILTER_RADIUS"
  payload: AssignTerritoriesPayload | FilterRadiusPayload
}

interface AssignTerritoriesPayload {
  points: SalesPoint[]
  params: TerritoryAssignmentParams
  allSellers: { id: number; codigo: number; nombreCompleto: string }[]
}

interface FilterRadiusPayload {
  points: SalesPoint[]
  center: [number, number]
  radiusKm: number
}

// ── Pick k distinct random seeds from actual data points ─────────────────────
function pickRandomSeeds(points: SalesPoint[], k: number): SalesPoint[] {
  const indices = new Set<number>()
  while (indices.size < k) {
    indices.add(Math.floor(Math.random() * points.length))
  }
  return Array.from(indices).map((i) => points[i])
}

// ── Build convex hull polygon from a set of points ───────────────────────────
function buildPolygon(points: SalesPoint[]): Feature<Polygon> | null {
  if (points.length < 3) return null
  const fc = turf.featureCollection(
    points.map((p) => turf.point([p.longitud, p.latitud]))
  ) as FeatureCollection<Point>
  const hull = turf.convex(fc)
  if (!hull) return null
  return turf.buffer(hull, 0.05, { units: "kilometers" }) as Feature<Polygon>
}

// ── Main message handler ──────────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data

  if (type === "ASSIGN_TERRITORIES") {
    const { points, params, allSellers } = payload as AssignTerritoriesPayload
    const { selectedSellerIds, pointsPerSeller } = params

    const k = selectedSellerIds.length
    const seeds = pickRandomSeeds(points, k)

    // Build all (pointIndex, sellerIndex, distance) pairs and sort by distance.
    // Then greedily assign: closest pair wins; each point goes to one seller only,
    // each seller is capped at pointsPerSeller.
    const pairs: { pi: number; si: number; dist: number }[] = []
    for (let pi = 0; pi < points.length; pi++) {
      for (let si = 0; si < k; si++) {
        const d =
          (points[pi].longitud - seeds[si].longitud) ** 2 +
          (points[pi].latitud - seeds[si].latitud) ** 2
        pairs.push({ pi, si, dist: d })
      }
    }
    pairs.sort((a, b) => a.dist - b.dist)

    const pointTaken = new Set<number>()
    const sellerCapacity = new Array(k).fill(pointsPerSeller)
    const sellerPoints: SalesPoint[][] = Array.from({ length: k }, () => [])

    for (const { pi, si } of pairs) {
      if (pointTaken.has(pi)) continue       // point already claimed
      if (sellerCapacity[si] <= 0) continue  // seller already full
      pointTaken.add(pi)
      sellerCapacity[si]--
      sellerPoints[si].push(points[pi])
      if (sellerCapacity.every((c) => c === 0)) break  // all sellers full
    }

    const territories = selectedSellerIds.map((sellerId, ci) => {
      const seller = allSellers.find((s) => s.id === sellerId)!
      const finalPoints = sellerPoints[ci]
      return {
        vendedorId: sellerId,
        sellerName: seller.nombreCompleto,
        points: finalPoints,
        polygon: buildPolygon(finalPoints),
      }
    })

    self.postMessage({ type: "TERRITORIES_READY", payload: territories })
    return
  }

  if (type === "FILTER_RADIUS") {
    const { points, center, radiusKm } = payload as FilterRadiusPayload

    // Build R-tree index for fast spatial queries
    const tree = new RBush<RBushItem>()
    tree.load(
      points.map((p) => ({
        minX: p.longitud,
        minY: p.latitud,
        maxX: p.longitud,
        maxY: p.latitud,
        id: p.id,
      }))
    )

    // Approximate bounding box for radius (1° ≈ 111km)
    const delta = radiusKm / 111
    const candidates = tree.search({
      minX: center[0] - delta,
      minY: center[1] - delta,
      maxX: center[0] + delta,
      maxY: center[1] + delta,
    })

    // Exact distance check on candidates
    const centerPt = turf.point(center)
    const filtered = candidates
      .map((c) => points.find((p) => p.id === c.id)!)
      .filter((p) => {
        const dist = turf.distance(centerPt, turf.point([p.longitud, p.latitud]), {
          units: "kilometers",
        })
        return dist <= radiusKm
      })

    self.postMessage({ type: "FILTER_READY", payload: filtered })
  }
}
