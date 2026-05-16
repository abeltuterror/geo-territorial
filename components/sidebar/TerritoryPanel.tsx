"use client"

import { useMemo, useState, useCallback, useEffect } from "react"
import { createPortal } from "react-dom"
import { Users, MapPin, Zap, Trash2, ChevronDown, ChevronUp, Save, X, Layers } from "lucide-react"
import type { Seller, Territory, TerritoryAssignmentParams, PendingAssignment } from "@/types/geo"
import { cn, formatCurrency } from "@/lib/utils"

interface TerritoryPanelProps {
  sellers: Seller[]
  territories: Territory[]
  pendingAssignments: PendingAssignment[] | null
  unassignedCount: number
  isProcessing: boolean
  onAssign: (params: TerritoryAssignmentParams) => void
  onClearTerritories: () => void
  onSavePending: () => void
  onDiscardPending: () => void
  onTerritorySelect: (territory: Territory | null) => void
  selectedTerritory: Territory | null
}

export default function TerritoryPanel({
  sellers,
  territories,
  pendingAssignments,
  unassignedCount,
  isProcessing,
  onAssign,
  onClearTerritories,
  onSavePending,
  onDiscardPending,
  onTerritorySelect,
  selectedTerritory,
}: TerritoryPanelProps) {
  const [selectedSellerIds, setSelectedSellerIds] = useState<Set<number>>(new Set())
  const [pointsPerSeller, setPointsPerSeller] = useState(200)
  const [showSellers, setShowSellers] = useState(true)
  const [openBadgeSeller, setOpenBadgeSeller] = useState<number | null>(null)
  const [badgePopupPos, setBadgePopupPos] = useState<{ top: number; left: number } | null>(null)
  const handleBadgeClick = useCallback((e: React.MouseEvent, sellerId: number) => {
    e.stopPropagation()
    if (openBadgeSeller === sellerId) {
      setOpenBadgeSeller(null)
      setBadgePopupPos(null)
      return
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const popupWidth = 192
    const left = Math.min(rect.left, window.innerWidth - popupWidth - 8)
    setBadgePopupPos({ top: rect.bottom + 4, left })
    setOpenBadgeSeller(sellerId)
  }, [openBadgeSeller])

  useEffect(() => {
    if (openBadgeSeller === null) return
    const close = () => { setOpenBadgeSeller(null); setBadgePopupPos(null) }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [openBadgeSeller])

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

  // Total saved clients per seller across all rounds
  const sellerSavedTotals = useMemo(() => {
    const totals = new Map<number, number>()
    territories.forEach((t) => {
      totals.set(t.vendedorId, (totals.get(t.vendedorId) ?? 0) + t.puntosVenta.length)
    })
    return totals
  }, [territories])

  // Pending clients per seller (preview, not yet saved)
  const sellerPendingTotals = useMemo(() => {
    const totals = new Map<number, number>()
    pendingAssignments?.forEach((a) => {
      totals.set(a.vendedorId, (totals.get(a.vendedorId) ?? 0) + a.points.length)
    })
    return totals
  }, [pendingAssignments])

  // Latest territory color per seller for the dot indicator
  const sellerLatestColor = useMemo(() => {
    const colors = new Map<number, string>()
    territories.forEach((t) => colors.set(t.vendedorId, t.color))
    return colors
  }, [territories])

  // Number of saved polygons per seller
  const sellerPolygonCount = useMemo(() => {
    const counts = new Map<number, number>()
    territories.forEach((t) => {
      counts.set(t.vendedorId, (counts.get(t.vendedorId) ?? 0) + 1)
    })
    return counts
  }, [territories])

  const totalToAssign = selectedSellerIds.size * pointsPerSeller
  const exceedsAvailable = totalToAssign > unassignedCount

  const canGenerate = selectedSellerIds.size > 0 && !isProcessing && !pendingAssignments

  return (
    <aside className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-white font-semibold text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          Geo Territorial
        </h1>
        <p className="text-gray-400 text-xs mt-1">
          {sellers.length} vendedores · {territories.length} territorios guardados
          {pendingAssignments && (
            <span className="text-amber-400"> · {pendingAssignments.length} en vista previa</span>
          )}
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
            max={10000}
            value={pointsPerSeller}
            onChange={(e) => setPointsPerSeller(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs text-gray-500">
            Disponibles: <span className="text-gray-300">{unassignedCount.toLocaleString()} puntos</span>
          </div>
          <div className={cn("text-xs", exceedsAvailable ? "text-amber-400" : "text-gray-500")}>
            A asignar: {totalToAssign.toLocaleString()} puntos
            {exceedsAvailable && " (supera los disponibles)"}
          </div>
        </div>

        {/* Pending preview actions */}
        {pendingAssignments ? (
          <div className="space-y-2">
            <div className="text-xs text-amber-400 font-medium">
              Vista previa lista — {pendingAssignments.reduce((s, a) => s + a.points.length, 0).toLocaleString()} puntos calculados
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSavePending}
                disabled={isProcessing}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
                  isProcessing
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-green-700 hover:bg-green-600 text-white"
                )}
              >
                <Save className="w-4 h-4" />
                {isProcessing ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={onDiscardPending}
                disabled={isProcessing}
                className="flex items-center justify-center gap-1 px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                Descartar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleAssign}
              disabled={!canGenerate}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors",
                !canGenerate
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
                title="Limpiar todos los territorios"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
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
              const isSelected = selectedSellerIds.has(seller.id)
              const savedCount = sellerSavedTotals.get(seller.id) ?? 0
              const pendingCount = sellerPendingTotals.get(seller.id) ?? 0
              const dotColor = sellerLatestColor.get(seller.id)
              const polygonCount = sellerPolygonCount.get(seller.id) ?? 0
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
                    className="accent-blue-500 w-4 h-4 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  {dotColor && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-gray-200 text-xs font-medium truncate">
                        {seller.nombreCompleto}
                      </p>
                      {polygonCount > 0 && (
                        <span
                          className="flex items-center gap-0.5 shrink-0 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-1 py-0.5 text-[10px] font-semibold cursor-pointer"
                          onClick={(e) => handleBadgeClick(e, seller.id)}
                        >
                          <Layers className="w-2.5 h-2.5" />
                          {polygonCount}
                        </span>
                      )}
                    </div>
                    {(savedCount > 0 || pendingCount > 0) && (
                      <p className="text-gray-500 text-xs">
                        {savedCount > 0 && (
                          <span>{savedCount.toLocaleString()} guardados</span>
                        )}
                        {savedCount > 0 && pendingCount > 0 && <span> · </span>}
                        {pendingCount > 0 && (
                          <span className="text-amber-500">{pendingCount.toLocaleString()} preview</span>
                        )}
                      </p>
                    )}
                  </div>
                  <span className="text-gray-600 text-xs shrink-0">
                    #{seller.codigo}
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
                {selectedTerritory.vendedor.nombreCompleto}
              </span>
              <span className="text-gray-500 text-xs">{selectedTerritory.nombre}</span>
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
                {selectedTerritory.puntosVenta.length}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total acumulado vendedor</span>
              <span className="text-blue-400 font-medium">
                {(sellerSavedTotals.get(selectedTerritory.vendedorId) ?? 0).toLocaleString()} clientes
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Compra potencial total</span>
              <span className="text-green-400 font-medium">
                {formatCurrency(
                  selectedTerritory.puntosVenta.reduce(
                    (sum, p) => sum + (p.montoAnual ?? 0),
                    0
                  )
                )}
              </span>
            </div>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {[...selectedTerritory.puntosVenta]
                .sort((a, b) => (b.montoAnual ?? 0) - (a.montoAnual ?? 0))
                .slice(0, 50)
                .map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col py-1 border-b border-gray-800 gap-0.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 truncate max-w-37.5 text-xs">
                      {p.nombreCliente}
                    </span>
                    <span className="text-gray-500 ml-2 shrink-0 text-xs">
                      {formatCurrency(p.montoAnual, p.moneda)}
                    </span>
                  </div>
                  <span className="text-gray-600 text-[10px]">ID: {p.id}</span>
                </div>
              ))}
              {selectedTerritory.puntosVenta.length > 50 && (
                <p className="text-gray-600 text-xs text-center py-1">
                  +{selectedTerritory.puntosVenta.length - 50} más...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {openBadgeSeller !== null && badgePopupPos && (() => {
        const seller = sellers.find((s) => s.id === openBadgeSeller)
        if (!seller) return null
        const polygonCount = sellerPolygonCount.get(seller.id) ?? 0
        const savedCount = sellerSavedTotals.get(seller.id) ?? 0
        const sellerTerritories = territories.filter((t) => t.vendedorId === seller.id)
        return createPortal(
          <div
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl p-3 w-48 text-left"
            style={{ top: badgePopupPos.top, left: badgePopupPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-400 text-[10px] uppercase font-semibold mb-2">
              Resumen del vendedor
            </p>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400">Polígonos</span>
              <span className="text-white font-medium">{polygonCount}</span>
            </div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-gray-400">Total clientes</span>
              <span className="text-green-400 font-medium">{savedCount.toLocaleString()}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 space-y-1">
              {sellerTerritories.map((t) => (
                <div key={t.id} className="flex justify-between text-[10px]">
                  <span className="text-gray-300 truncate max-w-28">{t.nombre}</span>
                  <span className="text-gray-500 shrink-0 ml-2">{t.puntosVenta.length} cli.</span>
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      })()}
    </aside>
  )
}
