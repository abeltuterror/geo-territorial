export interface SalesPoint {
  id: string
  nombreCliente: string
  ultimaCompra: string | null
  longitud: number
  latitud: number
  montoAnual: number | null
  moneda: string
  territorioId: string | null
}

export interface Seller {
  id: number
  codigo: number
  nombreCompleto: string
}

export interface Territory {
  id: string
  nombre: string
  color: string
  vendedorId: number
  vendedor: Seller
  geoJson: GeoJSON.Feature<GeoJSON.Polygon>
  puntosVenta: SalesPoint[]
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
