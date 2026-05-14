"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

interface Prediction {
  placeId: string
  description: string
  placePrediction: any
}

interface SearchBarProps {
  onLocationSelect: (center: [number, number], name: string) => void
  onClear: () => void
  isFiltered: boolean
}

export default function SearchBar({ onLocationSelect, onClear, isFiltered }: SearchBarProps) {
  const [hasGoogle, setHasGoogle] = useState(false)
  const [input, setInput] = useState("")
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const check = () => !!(window as any).google?.maps?.places?.AutocompleteSuggestion
    if (check()) { setHasGoogle(true); return }
    const interval = setInterval(() => {
      if (check()) { setHasGoogle(true); clearInterval(interval) }
    }, 200)
    return () => clearInterval(interval)
  }, [])

  const handleInput = useCallback((value: string) => {
    setInput(value)
    if (debounce.current) clearTimeout(debounce.current)
    if (!value.trim()) { setPredictions([]); setShowDropdown(false); return }

    debounce.current = setTimeout(async () => {
      try {
        const { suggestions } = await (window as any).google.maps.places.AutocompleteSuggestion
          .fetchAutocompleteSuggestions({ input: value, includedRegionCodes: ["pe"] })
        if (suggestions?.length) {
          setPredictions(suggestions.map((s: any) => ({
            placeId: s.placePrediction.placeId,
            description: s.placePrediction.text.toString(),
            placePrediction: s.placePrediction,
          })))
          setShowDropdown(true)
        } else {
          setPredictions([])
          setShowDropdown(false)
        }
      } catch {
        setPredictions([])
        setShowDropdown(false)
      }
    }, 300)
  }, [])

  const handleSelect = useCallback(async (p: Prediction) => {
    setInput(p.description)
    setShowDropdown(false)
    setPredictions([])
    try {
      const place = p.placePrediction.toPlace()
      await place.fetchFields({ fields: ["location", "displayName"] })
      if (place.location) {
        const lat: number = place.location.lat()
        const lng: number = place.location.lng()
        onLocationSelect([lng, lat], place.displayName ?? p.description)
      }
    } catch {
      // silent — user can retry
    }
  }, [onLocationSelect])

  const handleClear = () => {
    setInput("")
    setPredictions([])
    setShowDropdown(false)
    onClear()
  }

  if (!hasGoogle) {
    return (
      <div className="w-72 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-gray-500 text-sm opacity-50 cursor-not-allowed">
        API Key de Google Maps requerida...
      </div>
    )
  }

  return (
    <div className="relative w-72">
      <div className="relative flex items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => predictions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Buscar ubicación (radio 3km)..."
          className="w-full pl-3 pr-16 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <div className="absolute right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => { if (predictions.length > 0) handleSelect(predictions[0]) }}
            className="text-gray-400 hover:text-white focus:outline-none"
            tabIndex={-1}
          >
            <Search className="w-4 h-4" />
          </button>
          {input && (
            <button onClick={handleClear} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {showDropdown && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg overflow-hidden z-50 shadow-xl">
          {predictions.map((p) => (
            <li
              key={p.placeId}
              onMouseDown={() => handleSelect(p)}
              className="px-3 py-2.5 text-sm text-gray-200 hover:bg-gray-700 cursor-pointer truncate"
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
