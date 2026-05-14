export interface SalesPoint {
  id: string
  clientName: string
  lastPurchaseDate: string | null
  longitude: number
  latitude: number
  annualAmount: number | null
  currency: string
  territoryId: string | null
}

export interface Seller {
  id: number
  code: number
  fullName: string
}

export interface Territory {
  id: string
  name: string
  color: string
  sellerId: number
  seller: Seller
  geoJson: GeoJSON.Feature<GeoJSON.Polygon>
  salesPoints: SalesPoint[]
}

export interface TerritoryAssignmentParams {
  selectedSellerIds: number[]
  pointsPerSeller: number
}

export interface PolygonInfo {
  territory: Territory
  pointCount: number
  totalAmount: number
}

export type MapProvider = "maplibre" | "google"
