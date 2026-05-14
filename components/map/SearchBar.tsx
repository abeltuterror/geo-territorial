"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

interface SearchBarProps {
  onLocationSelect: (center: [number, number], name: string) => void
  onClear: () => void
  isFiltered: boolean
}

export default function SearchBar({ onLocationSelect, onClear, isFiltered }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [value, setValue] = useState("")
  const [hasGoogle, setHasGoogle] = useState(false)

  useEffect(() => {
    // Check if Google Maps API is loaded
    if (typeof window !== "undefined" && (window as any).google?.maps?.places) {
      setHasGoogle(true)
    }
  }, [])

  useEffect(() => {
    if (!hasGoogle || !inputRef.current) return

    autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode", "establishment"],
      componentRestrictions: { country: "pe" },
    })

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace()
      if (!place.geometry?.location) return
      const lng = place.geometry.location.lng()
      const lat = place.geometry.location.lat()
      setValue(place.name ?? place.formatted_address ?? "")
      onLocationSelect([lng, lat], place.formatted_address ?? "")
    })

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [hasGoogle, onLocationSelect])

  const handleClear = () => {
    setValue("")
    onClear()
    inputRef.current?.focus()
  }

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={
          hasGoogle
            ? "Buscar ubicación (radio 3km)..."
            : "API Key de Google Maps requerida..."
        }
        disabled={!hasGoogle}
        className="w-72 pl-9 pr-8 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {isFiltered && (
        <button
          onClick={handleClear}
          className="absolute right-2 text-gray-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
