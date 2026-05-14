import * as XLSX from "xlsx"
import * as fs from "fs"
import * as path from "path"

function parseAmount(value: unknown): number | null {
  if (value == null || value === "" || value === "-") return null
  const num = Number(value)
  return isNaN(num) ? null : num
}

function parseDate(value: unknown): string | null {
  if (value == null || value === "" || value === "-") return null
  if (typeof value === "number") {
    return XLSX.SSF.parse_date_code(value) ? XLSX.SSF.format("yyyy-mm-dd", value) : null
  }
  const d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d.toISOString()
}

async function main() {
  const xlsxPath = path.join(__dirname, "..", "prisma", "data", "puntos.xlsx")
  console.log(`📂 Leyendo: ${xlsxPath}`)

  const workbook = XLSX.readFile(xlsxPath)
  const sheet = workbook.Sheets["Geo puntos"]
  if (!sheet) throw new Error('Hoja "Geo puntos" no encontrada')

  const rows = (XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]).filter((r) => {
    const lng = Number(r["Longitud"])
    const lat = Number(r["Latitud"])
    return !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0
  })

  console.log(`📍 ${rows.length} puntos válidos`)

  const points = rows.map((r) => ({
    id: String(r["Cliente"]).trim(),
    nombreCliente: String(r["Nombre_del_cliente"] ?? r["Nombre del cliente"] ?? "").trim(),
    ultimaCompra: parseDate(r["Ultima_fecha_de_compra"] ?? r["Ultima fecha de compra"]),
    longitud: Number(r["Longitud"]),
    latitud: Number(r["Latitud"]),
    montoAnual: parseAmount(r["Monto_Compra_anual"] ?? r["Monto Compra anual"]),
    moneda: String(r["Moneda"] ?? "S/").trim(),
    territorioId: null,
  }))

  const outDir = path.join(__dirname)

  // ── JSON plano ─────────────────────────────────────────────────────────────
  const jsonPath = path.join(outDir, "points.json")
  fs.writeFileSync(jsonPath, JSON.stringify(points))
  const jsonMB = (fs.statSync(jsonPath).size / 1024 / 1024).toFixed(2)
  console.log(`✅ points.json     → ${jsonMB} MB`)

  // ── GeoJSON ────────────────────────────────────────────────────────────────
  const geojson = {
    type: "FeatureCollection",
    features: points.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.longitud, p.latitud] },
      properties: {
        id: p.id,
        nombreCliente: p.nombreCliente,
        ultimaCompra: p.ultimaCompra,
        montoAnual: p.montoAnual,
        moneda: p.moneda,
        territorioId: null,
      },
    })),
  }

  const geojsonPath = path.join(outDir, "points.geojson")
  fs.writeFileSync(geojsonPath, JSON.stringify(geojson))
  const geojsonMB = (fs.statSync(geojsonPath).size / 1024 / 1024).toFixed(2)
  console.log(`✅ points.geojson  → ${geojsonMB} MB`)

  console.log(`\n⚠️  Producción: estos archivos pesan ~${jsonMB}-${geojsonMB} MB por petición.`)
  console.log(`   Con 500k puntos superarías 100 MB — necesitarás vector tiles o paginación.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
