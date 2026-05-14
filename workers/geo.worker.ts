import * as turf from "@turf/turf"
import RBush from "rbush"
import type { SalesPoint, TerritoryAssignmentParams } from "@/types/geo"
import type { Feature, Point, FeatureCollection } from "geojson"

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

// ── K-means spatial clustering ────────────────────────────────────────────────
function kMeansClustering(
  points: SalesPoint[],
  k: number,
  maxIterations = 50
): number[] {
  // Farthest-point initialization: pick k real data points maximally spread apart.
  // Each new centroid is the point farthest from all existing centroids.
  // Guarantees real coordinates, no empty clusters, and good geographic spread.
  const chosen: { lng: number; lat: number }[] = []

  // Seed: point closest to the geographic mean
  const meanLng = points.reduce((s, p) => s + p.longitud, 0) / points.length
  const meanLat = points.reduce((s, p) => s + p.latitud, 0) / points.length
  let seedIdx = 0
  let seedMin = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = (points[i].longitud - meanLng) ** 2 + (points[i].latitud - meanLat) ** 2
    if (d < seedMin) { seedMin = d; seedIdx = i }
  }
  chosen.push({ lng: points[seedIdx].longitud, lat: points[seedIdx].latitud })

  // Each subsequent centroid: the point farthest from any chosen centroid
  for (let c = 1; c < k; c++) {
    let maxDist = -Infinity
    let farthestIdx = 0
    for (let i = 0; i < points.length; i++) {
      let nearestChosen = Infinity
      for (const ch of chosen) {
        const d = (points[i].longitud - ch.lng) ** 2 + (points[i].latitud - ch.lat) ** 2
        if (d < nearestChosen) nearestChosen = d
      }
      if (nearestChosen > maxDist) { maxDist = nearestChosen; farthestIdx = i }
    }
    chosen.push({ lng: points[farthestIdx].longitud, lat: points[farthestIdx].latitud })
  }

  let centroids = chosen

  let assignments = new Array(points.length).fill(0)

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = points.map((p) => {
      let minDist = Infinity
      let nearest = 0
      centroids.forEach((c, ci) => {
        const d = Math.pow(p.longitud - c.lng, 2) + Math.pow(p.latitud - c.lat, 2)
        if (d < minDist) { minDist = d; nearest = ci }
      })
      return nearest
    })

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i])
    assignments = newAssignments
    if (!changed) break

    // Recompute centroids
    centroids = Array.from({ length: k }, (_, ci) => {
      const cluster = points.filter((_, i) => assignments[i] === ci)
      if (cluster.length === 0) return centroids[ci]
      return {
        lng: cluster.reduce((s, p) => s + p.longitud, 0) / cluster.length,
        lat: cluster.reduce((s, p) => s + p.latitud, 0) / cluster.length,
      }
    })
  }

  return assignments
}

// ── Build convex hull polygon from a set of points ───────────────────────────
function buildPolygon(points: SalesPoint[]): turf.Feature<turf.Polygon> | null {
  if (points.length < 3) return null
  const fc = turf.featureCollection(
    points.map((p) => turf.point([p.longitud, p.latitud]))
  ) as FeatureCollection<Point>
  const hull = turf.convex(fc)
  if (!hull) return null
  // Buffer slightly so points on the edge are included
  return turf.buffer(hull, 0.05, { units: "kilometers" }) as turf.Feature<turf.Polygon>
}

// ── Main message handler ──────────────────────────────────────────────────────
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data

  if (type === "ASSIGN_TERRITORIES") {
    const { points, params, allSellers } = payload as AssignTerritoriesPayload
    const { selectedSellerIds, pointsPerSeller } = params

    // Use all points so K-means finds real geographic zones
    const k = selectedSellerIds.length
    const assignments = kMeansClustering(points, k)

    // Build territories with exactly pointsPerSeller contiguous points
    const territories = selectedSellerIds.map((sellerId, ci) => {
      const clusterPoints = points.filter((_, i) => assignments[i] === ci)
      const seller = allSellers.find((s) => s.id === sellerId)!

      // Centroid of this cluster
      const centroid = {
        lng: clusterPoints.reduce((s, p) => s + p.longitud, 0) / clusterPoints.length,
        lat: clusterPoints.reduce((s, p) => s + p.latitud, 0) / clusterPoints.length,
      }

      // Take the N closest points to the centroid (= geographically contiguous)
      const finalPoints = [...clusterPoints]
        .sort((a, b) => {
          const da = (a.longitud - centroid.lng) ** 2 + (a.latitud - centroid.lat) ** 2
          const db = (b.longitud - centroid.lng) ** 2 + (b.latitud - centroid.lat) ** 2
          return da - db
        })
        .slice(0, pointsPerSeller)

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
