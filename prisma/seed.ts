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
    return XLSX.SSF.parse_date_code(value) ? new Date(XLSX.SSF.format("yyyy-mm-dd", value)) : null
  }
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d
}

async function main() {
  const filePath = path.join(__dirname, "data", "puntos.xlsx")
  console.log(`📂 Leyendo: ${filePath}`)

  const workbook = XLSX.readFile(filePath)
  console.log(`📋 Hojas: ${workbook.SheetNames.join(", ")}`)

  // ── Vendedores ────────────────────────────────────────────────────────────
  const sellersSheet = workbook.Sheets["Vendedores"]
  if (!sellersSheet) throw new Error('Hoja "Vendedores" no encontrada en puntos.xlsx')

  const sellers = (XLSX.utils.sheet_to_json(sellersSheet) as Record<string, unknown>[])
    .filter((r) => r["CODIGO"] != null && r["APELLIDOS Y NOMBRES DEL VENDEDOR"] != null)
    .map((r) => ({
      codigo: Number(r["CODIGO"]),
      nombreCompleto: String(r["APELLIDOS Y NOMBRES DEL VENDEDOR"]).trim(),
    }))

  console.log(`\n👥 Insertando ${sellers.length} vendedores...`)
  await prisma.$transaction(
    sellers.map((s) =>
      prisma.vendedor.upsert({
        where: { codigo: s.codigo },
        update: { nombreCompleto: s.nombreCompleto },
        create: s,
      })
    )
  )
  console.log(`✅ ${sellers.length} vendedores insertados`)

  // ── Puntos de venta ───────────────────────────────────────────────────────
  const pointsSheet = workbook.Sheets["Geo puntos"]
  if (!pointsSheet) throw new Error('Hoja "Geo puntos" no encontrada en puntos.xlsx')

  const validRows = (XLSX.utils.sheet_to_json(pointsSheet) as Record<string, unknown>[]).filter(
    (r) => {
      const lng = Number(r["Longitud"])
      const lat = Number(r["Latitud"])
      return !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0
    }
  )
  console.log(`\n📍 ${validRows.length} puntos con coordenadas válidas`)

  const CHUNK_SIZE = 500
  let inserted = 0
  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE)
    await prisma.puntoVenta.createMany({
      data: chunk.map((r) => ({
        id: String(r["Cliente"]).trim(),
        nombreCliente: String(r["Nombre_del_cliente"] ?? r["Nombre del cliente"] ?? "").trim(),
        ultimaCompra: parseDate(r["Ultima_fecha_de_compra"] ?? r["Ultima fecha de compra"]),
        longitud: Number(r["Longitud"]),
        latitud: Number(r["Latitud"]),
        montoAnual: parseAmount(r["Monto_Compra_anual"] ?? r["Monto Compra anual"]),
        moneda: String(r["Moneda"] ?? "S/").trim(),
      })),
      skipDuplicates: true,
    })
    inserted += chunk.length
    process.stdout.write(`\r  Cargando... ${inserted}/${validRows.length} (${Math.round((inserted / validRows.length) * 100)}%)`)
  }

  const total = await prisma.puntoVenta.count()
  console.log(`\n✅ Total puntos en BD: ${total}`)
  console.log("✅ Seed completado")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
