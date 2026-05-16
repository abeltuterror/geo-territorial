"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SalesPoint, Seller, Territory, TerritoryAssignmentParams, PendingAssignment } from "@/types/geo"
import { getTerritoryColor } from "@/lib/utils"

interface GeoDataState {
  points: SalesPoint[]
  sellers: Seller[]
  territories: Territory[]
  pendingAssignments: PendingAssignment[] | null
  filteredIds: Set<string> | null
  isLoading: boolean
  isProcessing: boolean
  error: string | null
}

export function useGeoData() {
  const workerRef = useRef<Worker | null>(null)
  const pendingRef = useRef<PendingAssignment[] | null>(null)
  const [state, setState] = useState<GeoDataState>({
    points: [],
    sellers: [],
    territories: [],
    pendingAssignments: null,
    filteredIds: null,
    isLoading: true,
    isProcessing: false,
    error: null,
  })

  useEffect(() => {
    pendingRef.current = state.pendingAssignments
  }, [state.pendingAssignments])

  useEffect(() => {
    workerRef.current = new Worker(new URL("../workers/geo.worker.ts", import.meta.url), {
      type: "module",
    })
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data
      if (type === "TERRITORIES_READY") {
        setState((prev) => {
          // Persist colors: vendors with saved territories keep their existing color
          const vendorColorMap = new Map<number, string>()
          prev.territories.forEach((t) => vendorColorMap.set(t.vendedorId, t.color))

          let nextColorIndex = prev.territories.length
          const pending: PendingAssignment[] = (
            payload as {
              vendedorId: number
              sellerName: string
              points: SalesPoint[]
              polygon: GeoJSON.Feature<GeoJSON.Polygon> | null
            }[]
          ).map((a) => {
            const existingColor = vendorColorMap.get(a.vendedorId)
            if (existingColor) {
              return { ...a, colorIndex: -1, color: existingColor }
            }
            const colorIndex = nextColorIndex++
            return { ...a, colorIndex, color: getTerritoryColor(colorIndex) }
          })
          return { ...prev, pendingAssignments: pending, isProcessing: false }
        })
      }
      if (type === "FILTER_READY") {
        const ids = new Set<string>((payload as SalesPoint[]).map((p) => p.id))
        setState((prev) => ({ ...prev, filteredIds: ids, isProcessing: false }))
      }
    }
    return () => workerRef.current?.terminate()
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const [pointsRes, sellersRes, territoriesRes] = await Promise.all([
          fetch("/api/points"),
          fetch("/api/sellers"),
          fetch("/api/territories"),
        ])
        const [pointsData, sellersData, territoriesData] = await Promise.all([
          pointsRes.json(),
          sellersRes.json(),
          territoriesRes.json(),
        ])
        setState((prev) => ({
          ...prev,
          points: Array.isArray(pointsData) ? pointsData : [],
          sellers: Array.isArray(sellersData) ? sellersData : [],
          territories: Array.isArray(territoriesData) ? territoriesData : [],
          isLoading: false,
        }))
      } catch {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Error cargando datos",
        }))
      }
    }
    load()
  }, [])

  const assignTerritories = useCallback(
    (params: TerritoryAssignmentParams) => {
      if (!workerRef.current) return
      setState((prev) => ({ ...prev, isProcessing: true }))
      // Only pass unassigned points so saved points are excluded from new rounds
      const unassignedPoints = state.points.filter((p) => p.territorioId === null)
      workerRef.current.postMessage({
        type: "ASSIGN_TERRITORIES",
        payload: {
          points: unassignedPoints,
          params,
          allSellers: state.sellers,
        },
      })
    },
    [state.points, state.sellers]
  )

  const savePendingTerritories = useCallback(async () => {
    const pendingAssignments = pendingRef.current
    if (!pendingAssignments) return
    setState((prev) => ({ ...prev, isProcessing: true }))
    const valid = pendingAssignments.filter((a) => a.polygon !== null)
    try {
      await fetch("/api/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: valid.map((a) => ({
            vendedorId: a.vendedorId,
            pointIds: a.points.map((p) => p.id),
            geoJson: a.polygon,
            color: a.color,
          })),
        }),
      })
      const savedPointIds = new Set(valid.flatMap((a) => a.points.map((p) => p.id)))
      const territoriesRes = await fetch("/api/territories")
      const territoriesData = await territoriesRes.json()
      setState((prev) => ({
        ...prev,
        points: prev.points.map((p) =>
          savedPointIds.has(p.id) ? { ...p, territorioId: "__saved__" } : p
        ),
        territories: Array.isArray(territoriesData) ? territoriesData : prev.territories,
        pendingAssignments: null,
        isProcessing: false,
      }))
    } catch {
      setState((prev) => ({ ...prev, isProcessing: false }))
    }
  }, [])

  const discardPending = useCallback(() => {
    setState((prev) => ({ ...prev, pendingAssignments: null }))
  }, [])

  const clearTerritories = useCallback(async () => {
    await fetch("/api/territories", { method: "DELETE" })
    setState((prev) => ({
      ...prev,
      territories: [],
      pendingAssignments: null,
      points: prev.points.map((p) => ({ ...p, territorioId: null })),
    }))
  }, [])

  const filterByRadius = useCallback(
    (center: [number, number], radiusKm: number) => {
      if (!workerRef.current) return
      setState((prev) => ({ ...prev, isProcessing: true }))
      workerRef.current.postMessage({
        type: "FILTER_RADIUS",
        payload: { points: state.points, center, radiusKm: radiusKm },
      })
    },
    [state.points]
  )

  const clearFilter = useCallback(() => {
    setState((prev) => ({ ...prev, filteredIds: null }))
  }, [])

  return {
    ...state,
    assignTerritories,
    savePendingTerritories,
    discardPending,
    clearTerritories,
    filterByRadius,
    clearFilter,
  }
}
