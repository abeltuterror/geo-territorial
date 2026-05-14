import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

type RawPoint = Record<string, unknown>

function normalizePoint(p: RawPoint) {
  return {
    id: String(p.id),
    nombreCliente: String(p.nombreCliente ?? ""),
    ultimaCompra: p.ultimaCompra ? new Date(p.ultimaCompra as string) : null,
    longitud: Number(p.longitud),
    latitud: Number(p.latitud),
    montoAnual: p.montoAnual != null ? Number(p.montoAnual) : null,
    moneda: String(p.moneda ?? "S/"),
    territorioId: (p.territorioId as string | null) ?? null,
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    let rows: RawPoint[]

    if (body?.type === "FeatureCollection" && Array.isArray(body.features)) {
      // GeoJSON FeatureCollection
      rows = body.features.map((f: { geometry: { coordinates: number[] }; properties: RawPoint }) => ({
        ...f.properties,
        longitud: f.geometry.coordinates[0],
        latitud: f.geometry.coordinates[1],
      }))
    } else if (Array.isArray(body?.points)) {
      // { points: PuntoVenta[] }
      rows = body.points
    } else {
      return NextResponse.json(
        { error: "Se esperaba { points: [] } o un GeoJSON FeatureCollection" },
        { status: 400 }
      )
    }

    if (rows.length === 0) {
      return NextResponse.json({ inserted: 0 })
    }

    await prisma.puntoVenta.createMany({
      data: rows.map(normalizePoint),
      skipDuplicates: true,
    })

    return NextResponse.json({ inserted: rows.length })
  } catch (error) {
    console.error("POST /api/points error:", error)
    return NextResponse.json({ error: "Error al importar puntos" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format")

    const points = await prisma.puntoVenta.findMany({
      select: {
        id: true,
        nombreCliente: true,
        ultimaCompra: true,
        longitud: true,
        latitud: true,
        montoAnual: true,
        moneda: true,
        territorioId: true,
      },
      orderBy: { id: "asc" },
    })

    const headers = {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    }

    if (format === "geojson") {
      const geojson = {
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [p.longitud, p.latitud],
          },
          properties: {
            id: p.id,
            nombreCliente: p.nombreCliente,
            ultimaCompra: p.ultimaCompra,
            montoAnual: p.montoAnual,
            moneda: p.moneda,
            territorioId: p.territorioId,
          },
        })),
      }
      return NextResponse.json(geojson, { headers })
    }

    return NextResponse.json(points, { headers })
  } catch (error) {
    console.error("GET /api/points error:", error)
    return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 })
  }
}
