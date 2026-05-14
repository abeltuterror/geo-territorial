import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Geo Territorial — Optimización Espacial",
  description: "Visualización y segmentación territorial de 18,763 puntos de venta",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-gray-950 text-white antialiased">{children}</body>
    </html>
  )
}
