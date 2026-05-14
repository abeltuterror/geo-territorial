import * as fs from "fs"
import * as path from "path"

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000"
const CHUNK_SIZE = 500

async function main() {
  const geojsonPath = path.join(__dirname, "points.geojson")

  if (!fs.existsSync(geojsonPath)) {
    console.error("❌ points.geojson no encontrado. Ejecuta primero: npx ts-node data-source/export.ts")
    process.exit(1)
  }

  const collection = JSON.parse(fs.readFileSync(geojsonPath, "utf-8")) as {
    type: string
    features: unknown[]
  }

  const features = collection.features
  console.log(`📤 Enviando ${features.length} features (GeoJSON) → ${FRONTEND_URL}/api/points`)

  let sent = 0
  for (let i = 0; i < features.length; i += CHUNK_SIZE) {
    const chunk = features.slice(i, i + CHUNK_SIZE)

    const res = await fetch(`${FRONTEND_URL}/api/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "FeatureCollection", features: chunk }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status} en chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${body}`)
    }

    sent += chunk.length
    process.stdout.write(
      `\r  Enviando... ${sent}/${features.length} (${Math.round((sent / features.length) * 100)}%)`
    )
  }

  console.log(`\n✅ ${sent} features enviados exitosamente a ${FRONTEND_URL}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
