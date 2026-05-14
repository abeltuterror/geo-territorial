"use client"

import { useState } from "react"
import { Users, MapPin, Zap, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import type { Seller, Territory, TerritoryAssignmentParams } from "@/types/geo"
import { cn, formatCurrency } from "@/lib/utils"

interface TerritoryPanelProps {
  sellers: Seller[]
  territories: Territory[]
  isProcessing: boolean
  onAssign: (params: TerritoryAssignmentParams) => void
  onClearTerritories: () => void
  onTerritorySelect: (territory: Territory | null) => void
  selectedTerritory: Territory | null
}

export default function TerritoryPanel({
  sellers,
  territories,
  isProcessing,
  onAssign,
  onClearTerritories,
  onTerritorySelect,
  selectedTerritory,
}: TerritoryPanelProps) {
  const [selectedSellerIds, setSelectedSellerIds] = useState<Set<number>>(new Set())
  const [pointsPerSeller, setPointsPerSeller] = useState(200)
  const [showSellers, setShowSellers] = useState(true)

  const toggleSeller = (id: number) => {
    setSelectedSellerIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedSellerIds(new Set(sellers.map((s) => s.id)))
  const clearAll = () => setSelectedSellerIds(new Set())

  const handleAssign = () => {
    if (selectedSellerIds.size === 0) return
    onAssign({
      selectedSellerIds: Array.from(selectedSellerIds),
      pointsPerSeller,
    })
  }

  return (
    <aside className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-white font-semibold text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          Geo Territorial
        </h1>
        <p className="text-gray-400 text-xs mt-1">
          {sellers.length} vendedores · {territories.length} territorios activos
        </p>
      </div>

      {/* Assignment config */}
      <div className="p-4 border-b border-gray-700 space-y-3">
        <h2 className="text-gray-200 text-sm font-medium">Asignación automática</h2>

        <div>
          <label className="text-gray-400 text-xs mb-1 block">
            Clientes por vendedor
          </label>
          <input
            type="number"
            min={1}
            max={1000}
            value={pointsPerSeller}
            onChange={(e) => setPointsPerSeller(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="text-xs text-gray-500">
          Total a asignar: {(selectedSellerIds.size * pointsPerSeller).toLocaleString()} puntos
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAssign}
            disabled={selectedSellerIds.size === 0 || isProcessing}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
              selectedSellerIds.size === 0 || isProcessing
                ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            <Zap className="w-4 h-4" />
            {isProcessing ? "Procesando..." : "Generar territorios"}
          </button>
          {territories.length > 0 && (
            <button
              onClick={onClearTerritories}
              className="px-3 py-2 rounded-md bg-red-900/40 hover:bg-red-900/70 text-red-400 transition-colors"
              title="Limpiar territorios"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Seller list */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-800 sticky top-0 bg-gray-900 border-b border-gray-700"
          onClick={() => setShowSellers((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-200 text-sm font-medium">
              Vendedores ({selectedSellerIds.size}/{sellers.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); selectAll() }}
              className="text-xs text-blue-400 hover:text-blue-300 px-1"
            >
              Todos
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); clearAll() }}
              className="text-xs text-gray-500 hover:text-gray-400 px-1"
            >
              Ninguno
            </button>
            {showSellers ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </div>

        {showSellers && (
          <ul className="divide-y divide-gray-800">
            {sellers.map((seller) => {
              const territory = territories.find((t) => t.sellerId === seller.id)
              const isSelected = selectedSellerIds.has(seller.id)
              return (
                <li
                  key={seller.id}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                    isSelected ? "bg-blue-900/30" : "hover:bg-gray-800"
                  )}
                  onClick={() => toggleSeller(seller.id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSeller(seller.id)}
                    className="accent-blue-500 w-4 h-4 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {territory && (
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: territory.color }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-200 text-xs font-medium truncate">
                      {seller.fullName}
                    </p>
                    {territory && (
                      <p className="text-gray-500 text-xs">
                        {territory.salesPoints.length} clientes
                      </p>
                    )}
                  </div>
                  <span className="text-gray-600 text-xs flex-shrink-0">
                    #{seller.code}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Territory detail panel */}
      {selectedTerritory && (
        <div className="border-t border-gray-700 bg-gray-850 max-h-64 overflow-y-auto">
          <div className="p-3 flex items-center justify-between sticky top-0 bg-gray-900 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedTerritory.color }}
              />
              <span className="text-white text-sm font-medium">
                {selectedTerritory.seller.fullName}
              </span>
            </div>
            <button
              onClick={() => onTerritorySelect(null)}
              className="text-gray-500 hover:text-gray-300 text-xs"
            >
              ✕
            </button>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Clientes encerrados</span>
              <span className="text-white font-medium">
                {selectedTerritory.salesPoints.length}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Compra potencial total</span>
              <span className="text-green-400 font-medium">
                {formatCurrency(
                  selectedTerritory.salesPoints.reduce(
                    (sum, p) => sum + (p.annualAmount ?? 0),
                    0
                  )
                )}
              </span>
            </div>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {selectedTerritory.salesPoints.slice(0, 50).map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between text-xs py-1 border-b border-gray-800"
                >
                  <span className="text-gray-300 truncate max-w-[140px]">
                    {p.clientName}
                  </span>
                  <span className="text-gray-500 ml-2 flex-shrink-0">
                    {formatCurrency(p.annualAmount)}
                  </span>
                </div>
              ))}
              {selectedTerritory.salesPoints.length > 50 && (
                <p className="text-gray-600 text-xs text-center py-1">
                  +{selectedTerritory.salesPoints.length - 50} más...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
