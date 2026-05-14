"use client"

import { useMemo, useRef, useState } from "react"
import MapGL, { type MapRef } from "react-map-gl/maplibre"
import DeckGL from "@deck.gl/react"
import { ScatterplotLayer, PolygonLayer } from "@deck.gl/layers"
import type { PickingInfo } from "@deck.gl/core"
import type { SalesPoint, Territory } from "@/types/geo"
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

interface GeoMapProps {
  points: SalesPoint[]
  territories: Territory[]
  filteredIds: Set<string> | null
  onPointClick?: (point: SalesPoint) => void
  onTerritoryClick?: (territory: Territory) => void
}

export default function GeoMap({
  points,
  territories,
  filteredIds,
  onPointClick,
  onTerritoryClick,
}: GeoMapProps) {
  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const mapRef = useRef<MapRef>(null)

  const visiblePoints = useMemo(() => {
    if (!filteredIds) return points
    return points.filter((p) => filteredIds.has(p.id))
  }, [points, filteredIds])

  // Build a lookup: pointId -> color from territory
  const territoryColorMap = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    territories.forEach((t) => {
      const rgb = hexToRgb(t.color)
      t.salesPoints.forEach((sp) => map.set(sp.id, rgb))
    })
    return map
  }, [territories])

  const scatterLayer = useMemo(
    () =>
      new ScatterplotLayer<SalesPoint>({
        id: "sales-points",
        data: visiblePoints,
        getPosition: (d) => [d.longitude, d.latitude],
        getFillColor: (d) => {
          const color = territoryColorMap.get(d.id)
          return color ? [...color, 220] : [160, 160, 160, 180]
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
          getFillColor: [territoryColorMap],
        },
      }),
    [visiblePoints, territoryColorMap, onPointClick]
  )

  const polygonLayer = useMemo(
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

  const layers = [polygonLayer, scatterLayer]

  return (
    <div className="relative w-full h-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as typeof INITIAL_VIEW)}
        controller={true}
        layers={layers}
        getTooltip={({ object }: PickingInfo<SalesPoint | Territory>) => {
          if (!object) return null
          if ("clientName" in object) {
            return {
              html: `<div class="text-sm font-medium">${object.clientName}</div>
                     <div class="text-xs text-gray-400">${object.annualAmount != null ? `S/ ${object.annualAmount.toLocaleString()}` : "Sin importe"}</div>`,
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
      {/* Point counter */}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
        {visiblePoints.length.toLocaleString()} puntos
      </div>
    </div>
  )
}
