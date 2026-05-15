"use client"

import { useMemo, useRef, useState } from "react"
import MapGL, { type MapRef } from "react-map-gl/maplibre"
import DeckGL from "@deck.gl/react"
import { ScatterplotLayer, PolygonLayer } from "@deck.gl/layers"
import type { PickingInfo } from "@deck.gl/core"
import type { SalesPoint, Territory, PendingAssignment } from "@/types/geo"
import { hexToRgb } from "@/lib/utils"
import "maplibre-gl/dist/maplibre-gl.css"

const INITIAL_VIEW = {
  longitude: -77.03,
  latitude: -12.04,
  zoom: 11,
  pitch: 0,
  bearing: 0,
}

const MAPLIBRE_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"

const SAVED_COLOR: [number, number, number, number] = [55, 60, 80, 210]

interface GeoMapProps {
  points: SalesPoint[]
  territories: Territory[]
  pendingAssignments: PendingAssignment[] | null
  filteredIds: Set<string> | null
  center?: [number, number] | null
  onPointClick?: (point: SalesPoint) => void
  onTerritoryClick?: (territory: Territory) => void
}

export default function GeoMap({
  points,
  territories,
  pendingAssignments,
  filteredIds,
  center,
  onPointClick,
  onTerritoryClick,
}: GeoMapProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const mapRef = useRef<MapRef>(null)

  const [prevCenter, setPrevCenter] = useState(center)
  if (prevCenter !== center) {
    setPrevCenter(center)
    if (center) {
      setViewState((prev) => ({ ...prev, longitude: center[0], latitude: center[1], zoom: 13 }))
    } else {
      setViewState(INITIAL_VIEW)
    }
  }

  const visiblePoints = useMemo(() => {
    if (!filteredIds) return points
    return points.filter((p) => filteredIds.has(p.id))
  }, [points, filteredIds])

  // Points that have been saved to the DB (belong to a saved territory)
  const savedPointIds = useMemo(() => {
    const ids = new Set<string>()
    territories.forEach((t) => t.puntosVenta.forEach((p) => ids.add(p.id)))
    return ids
  }, [territories])

  // Points in the current preview (not yet saved)
  const pendingColorMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    if (!pendingAssignments) return map
    pendingAssignments.forEach((a) => {
      const rgb = hexToRgb(a.color)
      a.points.forEach((p) => map.set(p.id, rgb))
    })
    return map
  }, [pendingAssignments])

  const scatterLayer = useMemo(
    () =>
      new ScatterplotLayer<SalesPoint>({
        id: "sales-points",
        data: visiblePoints,
        getPosition: (d) => [d.longitud, d.latitud],
        getFillColor: (d) => {
          if (savedPointIds.has(d.id)) return SAVED_COLOR
          const pending = pendingColorMap.get(d.id)
          if (pending) return [...pending, 220]
          return [160, 160, 160, 180]
        },
        getRadius: 40,
        radiusUnits: "meters",
        radiusMinPixels: 3,
        radiusMaxPixels: 12,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 200],
        onClick: (info: PickingInfo<SalesPoint>) => {
          if (info.object) onPointClick?.(info.object)
        },
        updateTriggers: {
          getFillColor: [savedPointIds, pendingColorMap],
        },
      }),
    [visiblePoints, savedPointIds, pendingColorMap, onPointClick]
  )

  const savedPolygonLayer = useMemo(
    () =>
      new PolygonLayer<Territory>({
        id: "territory-polygons",
        data: territories,
        getPolygon: (d) => d.geoJson.geometry.coordinates,
        getFillColor: (d) => {
          const [r, g, b] = hexToRgb(d.color)
          return [r, g, b, 40]
        },
        getLineColor: (d) => {
          const [r, g, b] = hexToRgb(d.color)
          return [r, g, b, 220]
        },
        getLineWidth: 2,
        lineWidthUnits: "pixels",
        pickable: true,
        onClick: (info: PickingInfo<Territory>) => {
          if (info.object) onTerritoryClick?.(info.object)
        },
      }),
    [territories, onTerritoryClick]
  )

  const pendingPolygonData = useMemo(
    () =>
      pendingAssignments
        ? pendingAssignments
            .filter((a) => a.polygon !== null)
            .map((a) => ({ polygon: a.polygon!, color: a.color }))
        : [],
    [pendingAssignments]
  )

  const pendingPolygonLayer = useMemo(
    () =>
      new PolygonLayer<{ polygon: GeoJSON.Feature<GeoJSON.Polygon>; color: string }>({
        id: "pending-polygons",
        data: pendingPolygonData,
        getPolygon: (d) => d.polygon.geometry.coordinates,
        getFillColor: (d) => {
          const [r, g, b] = hexToRgb(d.color)
          return [r, g, b, 60]
        },
        getLineColor: (d) => {
          const [r, g, b] = hexToRgb(d.color)
          return [r, g, b, 255]
        },
        getLineWidth: 3,
        lineWidthUnits: "pixels",
        pickable: false,
      }),
    [pendingPolygonData]
  )

  const layers = [savedPolygonLayer, pendingPolygonLayer, scatterLayer]

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof INITIAL_VIEW)}
        controller={true}
        layers={layers}
        getTooltip={({ object }: PickingInfo<SalesPoint | Territory>) => {
          if (!object) return null
          if ("nombreCliente" in object) {
            return {
              html: `<div class="text-sm font-medium">${object.nombreCliente}</div>
                     <div class="text-xs text-gray-400">${object.montoAnual != null ? `S/ ${object.montoAnual.toLocaleString()}` : "Sin importe"}</div>`,
              style: { background: "#1e1e2e", border: "1px solid #444", borderRadius: "6px", padding: "6px 10px" },
            }
          }
          return null
        }}
      >
        <MapGL
          ref={mapRef}
          mapStyle={MAPLIBRE_STYLE}
          reuseMaps
        />
      </DeckGL>
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
        {visiblePoints.length.toLocaleString()} puntos
      </div>
    </div>
  )
}
