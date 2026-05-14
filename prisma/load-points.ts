import { PrismaClient } from "@prisma/client"
import * as XLSX from "xlsx"
import path from "path"

const prisma = new PrismaClient()

function parseAmount(value: unknown): number | null {
  if (value == null || value === "" || value === "-") return null
  const num = Number(value)
  return isNaN(num) ? null : num
}

function parseDate(value: unknown): Date | null {
  if (value == null || value === "" || value === "-") return null
  if (typeof value === "number") {
    // Excel date serial number
    return XLSX.SSF.parse_date_code(value) ? new Date(XLSX.SSF.format("yyyy-mm-dd", value)) : null
  }
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d
}

async function main() {
  const filePath = path.join(__dirname, "data", "puntos.xlsx")
  console.log(`📂 Leyendo: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  console.log(`📋 Hojas encontradas: ${workbook.SheetNames.join(", ")}`)

  // ── Hoja de vendedores ─────────────────────────────────────────────────────
  const sellersSheet = workbook.Sheets["Vendedores"]
  if (sellersSheet) {
    const sellersRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sellersSheet)
    console.log(`\n👥 Procesando ${sellersRaw.length} vendedores...`)

    const sellers = sellersRaw
      .filter((row) => row["CODIGO"] != null && row["APELLIDOS Y NOMBRES DEL VENDEDOR"] != null)
      .map((row) => ({
        code: Number(row["CODIGO"]),
        fullName: String(row["APELLIDOS Y NOMBRES DEL VENDEDOR"]).trim(),
      }))

    for (const s of sellers) {
      await prisma.seller.upsert({
        where: { code: s.code },
        update: { fullName: s.fullName },
        create: s,
      })
    }
    console.log(`✅ ${sellers.length} vendedores actualizados`)
  }

  // ── Hoja de puntos de venta ────────────────────────────────────────────────
  const pointsSheet = workbook.Sheets["Geo puntos"]
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(pointsSheet)
  console.log(`\n📍 Procesando ${rawRows.length} puntos de venta...`)

  // Filtrar filas sin coordenadas válidas
  const validRows = rawRows.filter((row) => {
    const lng = Number(row["Longitud"])
    const lat = Number(row["Latitud"])
    return !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0
  })

  console.log(`✅ ${validRows.length} puntos con coordenadas válidas`)

  // Insertar en chunks de 500
  const CHUNK_SIZE = 500
  let inserted = 0

  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE)

    await prisma.salesPoint.createMany({
      data: chunk.map((row) => ({
        id: String(row["Cliente"]).trim(),
        clientName: String(row["Nombre_del_cliente"] ?? row["Nombre del cliente"] ?? "").trim(),
        lastPurchaseDate: parseDate(row["Ultima_fecha_de_compra"] ?? row["Ultima fecha de compra"]),
        longitude: Number(row["Longitud"]),
        latitude: Number(row["Latitud"]),
        annualAmount: parseAmount(row["Monto_Compra_anual"] ?? row["Monto Compra anual"]),
        currency: String(row["Moneda"] ?? "S/").trim(),
      })),
      skipDuplicates: true,
    })

    inserted += chunk.length
    const pct = Math.round((inserted / validRows.length) * 100)
    process.stdout.write(`\r  Cargando... ${inserted}/${validRows.length} (${pct}%)`)
  }

  const total = await prisma.salesPoint.count()
  console.log(`\n✅ Total puntos en BD: ${total}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
