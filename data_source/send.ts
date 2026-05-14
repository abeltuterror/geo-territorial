import * as fs from "fs"
import * as path from "path"

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000"
const CHUNK_SIZE = 500

async function main() {
  const jsonPath = path.join(__dirname, "points.json")

  if (!fs.existsSync(jsonPath)) {
    console.error("❌ points.json no encontrado. Ejecuta primero: npx ts-node data-source/export.ts")
    process.exit(1)
  }

  const points = JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as unknown[]
  console.log(`📤 Enviando ${points.length} puntos → ${FRONTEND_URL}/api/points`)

  let sent = 0
  for (let i = 0; i < points.length; i += CHUNK_SIZE) {
    const chunk = points.slice(i, i + CHUNK_SIZE)

    const res = await fetch(`${FRONTEND_URL}/api/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: chunk }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status} en chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${body}`)
    }

    sent += chunk.length
    process.stdout.write(
      `\r  Enviando... ${sent}/${points.length} (${Math.round((sent / points.length) * 100)}%)`
    )
  }

  console.log(`\n✅ ${sent} puntos enviados exitosamente a ${FRONTEND_URL}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
