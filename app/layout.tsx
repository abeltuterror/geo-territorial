import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = {
  title: "Geo Territorial — Optimización Espacial",
  description: "Visualización y segmentación territorial de 18,763 puntos de venta",
}

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-gray-950 text-white antialiased">
        {children}
        {GMAPS_KEY && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&loading=async`}
            strategy="afterInteractive"
          />
        )}
      </body>
    </html>
  )
}
