import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const sellers = await prisma.vendedor.findMany({
      orderBy: { codigo: "asc" },
    })
    return NextResponse.json(sellers)
  } catch (error) {
    console.error("GET /api/sellers error:", error)
    return NextResponse.json({ error: "Failed to fetch sellers" }, { status: 500 })
  }
}
