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
  allSellers: { id: number; code: number; fullName: string }[]
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
  // Initialize centroids by spreading across the point set
  const step = Math.floor(points.length / k)
  let centroids = Array.from({ length: k }, (_, i) => ({
    lng: points[i * step].longitude,
    lat: points[i * step].latitude,
  }))

  let assignments = new Array(points.length).fill(0)

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each point to nearest centroid
    const newAssignments = points.map((p) => {
      let minDist = Infinity
      let nearest = 0
      centroids.forEach((c, ci) => {
        const d = Math.pow(p.longitude - c.lng, 2) + Math.pow(p.latitude - c.lat, 2)
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
        lng: cluster.reduce((s, p) => s + p.longitude, 0) / cluster.length,
        lat: cluster.reduce((s, p) => s + p.latitude, 0) / cluster.length,
      }
    })
  }

  return assignments
}

// ── Build convex hull polygon from a set of points ───────────────────────────
function buildPolygon(points: SalesPoint[]): turf.Feature<turf.Polygon> | null {
  if (points.length < 3) return null
  const fc = turf.featureCollection(
    points.map((p) => turf.point([p.longitude, p.latitude]))
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

    const totalNeeded = selectedSellerIds.length * pointsPerSeller
    const workingPoints = points.slice(0, Math.min(totalNeeded, points.length))

    // Cluster points into N groups (one per seller)
    const k = selectedSellerIds.length
    const assignments = kMeansClustering(workingPoints, k)

    // Build territories
    const territories = selectedSellerIds.map((sellerId, ci) => {
      const clusterPoints = workingPoints.filter((_, i) => assignments[i] === ci)
      const polygon = buildPolygon(clusterPoints)
      const seller = allSellers.find((s) => s.id === sellerId)!

      return {
        sellerId,
        sellerName: seller.fullName,
        points: clusterPoints,
        polygon,
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
        minX: p.longitude,
        minY: p.latitude,
        maxX: p.longitude,
        maxY: p.latitude,
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
        const dist = turf.distance(centerPt, turf.point([p.longitude, p.latitude]), {
          units: "kilometers",
        })
        return dist <= radiusKm
      })

    self.postMessage({ type: "FILTER_READY", payload: filtered })
  }
}
