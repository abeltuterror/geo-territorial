import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getTerritoryColor } from "@/lib/utils"

const CreateTerritoriesSchema = z.object({
  assignments: z.array(
    z.object({
      sellerId: z.number(),
      pointIds: z.array(z.string()),
      geoJson: z.any(),
      colorIndex: z.number(),
    })
  ),
})

export async function GET() {
  try {
    const territories = await prisma.territory.findMany({
      include: {
        seller: true,
        salesPoints: {
          select: {
            id: true,
            clientName: true,
            annualAmount: true,
            currency: true,
            longitude: true,
            latitude: true,
            lastPurchaseDate: true,
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

    // Clear existing territories before saving new ones
    await prisma.salesPoint.updateMany({ data: { territoryId: null } })
    await prisma.territory.deleteMany()

    const created = await Promise.all(
      assignments.map(async (a, idx) => {
        const territory = await prisma.territory.create({
          data: {
            sellerId: a.sellerId,
            name: `Territorio ${idx + 1}`,
            color: getTerritoryColor(a.colorIndex),
            geoJson: a.geoJson,
          },
        })
        await prisma.salesPoint.updateMany({
          where: { id: { in: a.pointIds } },
          data: { territoryId: territory.id },
        })
        return territory
      })
    )

    return NextResponse.json({ created: created.length }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error("POST /api/territories error:", error)
    return NextResponse.json({ error: "Failed to save territories" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await prisma.salesPoint.updateMany({ data: { territoryId: null } })
    await prisma.territory.deleteMany()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/territories error:", error)
    return NextResponse.json({ error: "Failed to delete territories" }, { status: 500 })
  }
}
