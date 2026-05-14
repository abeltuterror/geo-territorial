import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | null, currency = "S/") {
  if (amount == null) return "-"
  return `${currency} ${amount.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
}

const TERRITORY_COLORS = [
  "#e6194b","#3cb44b","#ffe119","#4363d8","#f58231",
  "#911eb4","#42d4f4","#f032e6","#bfef45","#fabed4",
  "#469990","#dcbeff","#9a6324","#fffac8","#800000",
  "#aaffc3","#808000","#ffd8b1","#000075","#a9a9a9",
  "#ffffff","#e6194b","#3cb44b","#ffe119","#4363d8",
  "#f58231","#911eb4","#42d4f4","#f032e6","#bfef45",
  "#fabed4","#469990","#dcbeff","#9a6324","#fffac8",
  "#800000","#aaffc3","#808000","#ffd8b1","#000075",
  "#a9a9a9","#ffffff","#e6194b","#3cb44b","#ffe119",
  "#4363d8","#f58231","#911eb4","#42d4f4","#f032e6",
  "#bfef45","#fabed4","#469990","#dcbeff","#9a6324",
  "#fffac8","#800000","#aaffc3","#808000","#ffd8b1",
  "#000075","#a9a9a9","#ffffff","#e6194b","#3cb44b",
  "#ffe119","#4363d8","#f58231","#911eb4","#42d4f4",
  "#f032e6","#bfef45","#fabed4","#469990","#dcbeff",
  "#9a6324","#fffac8","#800000","#aaffc3","#808000",
  "#ffd8b1","#000075","#a9a9a9","#ffffff","#e6194b",
  "#3cb44b","#ffe119","#4363d8","#f58231","#911eb4",
]

export function getTerritoryColor(index: number): string {
  return TERRITORY_COLORS[index % TERRITORY_COLORS.length]
}

export function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}
