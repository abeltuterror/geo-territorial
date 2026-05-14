"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { SalesPoint, Seller, Territory, TerritoryAssignmentParams } from "@/types/geo"

interface GeoDataState {
  points: SalesPoint[]
  sellers: Seller[]
  territories: Territory[]
  filteredIds: Set<string> | null
  isLoading: boolean
  isProcessing: boolean
  error: string | null
}

export function useGeoData() {
  const workerRef = useRef<Worker | null>(null)
  const [state, setState] = useState<GeoDataState>({
    points: [],
    sellers: [],
    territories: [],
    filteredIds: null,
    isLoading: true,
    isProcessing: false,
    error: null,
  })

  // Boot worker
  useEffect(() => {
    workerRef.current = new Worker(new URL("../workers/geo.worker.ts", import.meta.url), {
      type: "module",
    })
    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data
      if (type === "TERRITORIES_READY") {
        saveTerritoriesFromWorker(payload)
      }
      if (type === "FILTER_READY") {
        const ids = new Set<string>((payload as SalesPoint[]).map((p) => p.id))
        setState((prev) => ({ ...prev, filteredIds: ids, isProcessing: false }))
      }
    }
    return () => workerRef.current?.terminate()
  }, [])

  // Initial data load
  useEffect(() => {
    async function load() {
      try {
        const [pointsRes, sellersRes, territoriesRes] = await Promise.all([
          fetch("/api/points"),
          fetch("/api/sellers"),
          fetch("/api/territories"),
        ])
        const [points, sellers, territories] = await Promise.all([
          pointsRes.json(),
          sellersRes.json(),
          territoriesRes.json(),
        ])
        setState((prev) => ({
          ...prev,
          points,
          sellers,
          territories,
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
      workerRef.current.postMessage({
        type: "ASSIGN_TERRITORIES",
        payload: {
          points: state.points,
          params,
          allSellers: state.sellers,
        },
      })
    },
    [state.points, state.sellers]
  )

  const saveTerritoriesFromWorker = useCallback(
    async (
      assignments: {
        sellerId: number
        points: SalesPoint[]
        polygon: GeoJSON.Feature<GeoJSON.Polygon> | null
      }[]
    ) => {
      const valid = assignments.filter((a) => a.polygon !== null)
      try {
        await fetch("/api/territories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignments: valid.map((a, idx) => ({
              sellerId: a.sellerId,
              pointIds: a.points.map((p) => p.id),
              geoJson: a.polygon,
              colorIndex: idx,
            })),
          }),
        })
        const res = await fetch("/api/territories")
        const territories = await res.json()
        setState((prev) => ({ ...prev, territories, isProcessing: false }))
      } catch {
        setState((prev) => ({ ...prev, isProcessing: false }))
      }
    },
    []
  )

  const clearTerritories = useCallback(async () => {
    await fetch("/api/territories", { method: "DELETE" })
    setState((prev) => ({ ...prev, territories: [] }))
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
    clearTerritories,
    filterByRadius,
    clearFilter,
  }
}
