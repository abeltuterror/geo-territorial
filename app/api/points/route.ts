import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
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

    return NextResponse.json(points, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (error) {
    console.error("GET /api/points error:", error)
    return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 })
  }
}
