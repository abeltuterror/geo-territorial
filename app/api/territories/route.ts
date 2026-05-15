import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getTerritoryColor } from "@/lib/utils"

const CreateTerritoriesSchema = z.object({
  assignments: z.array(
    z.object({
      vendedorId: z.number(),
      pointIds: z.array(z.string()),
      geoJson: z.any(),
      colorIndex: z.number(),
    })
  ),
})

export async function GET() {
  try {
    const territories = await prisma.territorio.findMany({
      include: {
        vendedor: true,
        puntosVenta: {
          select: {
            id: true,
            nombreCliente: true,
            montoAnual: true,
            moneda: true,
            longitud: true,
            latitud: true,
            ultimaCompra: true,
          },
        },
      },
    })
    return NextResponse.json(territories)
  } catch (error) {
    console.error("GET /api/territories error:", error)
    return NextResponse.json({ error: "Failed to fetch territories" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { assignments } = CreateTerritoriesSchema.parse(body)

    const existingCount = await prisma.territorio.count()

    const created = await Promise.all(
      assignments.map(async (a, idx) => {
        const territory = await prisma.territorio.create({
          data: {
            vendedorId: a.vendedorId,
            nombre: `Territorio ${existingCount + idx + 1}`,
            color: getTerritoryColor(a.colorIndex),
            geoJson: a.geoJson,
          },
        })
        await prisma.puntoVenta.updateMany({
          where: { id: { in: a.pointIds } },
          data: { territorioId: territory.id },
        })
        return territory
      })
    )

    return NextResponse.json({ created: created.length }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error("POST /api/territories error:", error)
    return NextResponse.json({ error: "Failed to save territories" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await prisma.puntoVenta.updateMany({ data: { territorioId: null } })
    await prisma.territorio.deleteMany()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/territories error:", error)
    return NextResponse.json({ error: "Failed to delete territories" }, { status: 500 })
  }
}
