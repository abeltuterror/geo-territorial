"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useGeoData } from "@/lib/useGeoData"
import TerritoryPanel from "@/components/sidebar/TerritoryPanel"
import SearchBar from "@/components/map/SearchBar"
import type { Territory } from "@/types/geo"

// Deck.gl must not SSR (uses WebGL)
const GeoMap = dynamic(() => import("@/components/map/GeoMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-950">
      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
    </div>
  ),
})

export default function Home() {
  const {
    points,
    sellers,
    territories,
    filteredIds,
    isLoading,
    isProcessing,
    assignTerritories,
    clearTerritories,
    filterByRadius,
    clearFilter,
  } = useGeoData()

  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null)

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-950 gap-4">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        <p className="text-gray-400 text-sm">
          Cargando 18,763 puntos de venta...
        </p>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen flex bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <TerritoryPanel
        sellers={sellers}
        territories={territories}
        isProcessing={isProcessing}
        onAssign={assignTerritories}
        onClearTerritories={clearTerritories}
        onTerritorySelect={setSelectedTerritory}
        selectedTerritory={selectedTerritory}
      />

      {/* Map area */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-3">
          <SearchBar
            onLocationSelect={(center) => { setMapCenter(center); filterByRadius(center, 3) }}
            onClear={() => { clearFilter() }}
            isFiltered={filteredIds !== null}
          />
          {filteredIds !== null && (
            <div className="bg-blue-600/90 text-white text-xs px-3 py-2 rounded-lg backdrop-blur-sm">
              Radio 3km · {filteredIds.size.toLocaleString()} puntos
            </div>
          )}
          {isProcessing && (
            <div className="bg-gray-800/90 text-gray-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2 backdrop-blur-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Calculando territorios...
            </div>
          )}
        </div>

        <GeoMap
          points={points}
          territories={territories}
          filteredIds={filteredIds}
          center={mapCenter}
          onTerritoryClick={setSelectedTerritory}
        />
      </div>
    </div>
  )
}
