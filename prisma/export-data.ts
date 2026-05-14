import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

const prisma = new PrismaClient()

async function main() {
  console.log("📤 Exportando puntos de venta...")

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

  console.log(`📍 ${points.length} puntos encontrados`)

  const outDir = path.join(__dirname, "..", "public", "data")
  fs.mkdirSync(outDir, { recursive: true })

  // ── JSON plano ─────────────────────────────────────────────────────────────
  const jsonPath = path.join(outDir, "points.json")
  fs.writeFileSync(jsonPath, JSON.stringify(points))
  const jsonSize = (fs.statSync(jsonPath).size / 1024 / 1024).toFixed(2)
  console.log(`✅ points.json → ${jsonSize} MB`)

  // ── GeoJSON ────────────────────────────────────────────────────────────────
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

  const geojsonPath = path.join(outDir, "points.geojson")
  fs.writeFileSync(geojsonPath, JSON.stringify(geojson))
  const geojsonSize = (fs.statSync(geojsonPath).size / 1024 / 1024).toFixed(2)
  console.log(`✅ points.geojson → ${geojsonSize} MB`)

  console.log(`\n📁 Archivos en: public/data/`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
