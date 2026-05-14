import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// ── 90 Vendedores ─────────────────────────────────────────────────────────────
const SELLERS = [
  { code: 1, fullName: "CAPCHA HUAMAN ETTY YOMIT" },
  { code: 2, fullName: "DONAYRE GOMEZ MARIA ESTHER" },
  { code: 3, fullName: "FERRER MONASTERIO ANGGIE YESENIA" },
  { code: 4, fullName: "LIVISI ZORRILLA LIZZET ESTEFANY" },
  { code: 5, fullName: "HUAMANI PHOCCO EVELYN GABRIELA" },
  { code: 6, fullName: "CUCHULA MONTES LIZ MONICA" },
  { code: 7, fullName: "LAPA CORAS KAREN MEDALID" },
  { code: 8, fullName: "RUIZ CAMARENA JASSMIN ROSARIO" },
  { code: 9, fullName: "ALBIRENA SANTILLAN MONICKA ANGELITA" },
  { code: 10, fullName: "NARRO CUSQUISIBAN GELANDY ORFELINDA" },
  { code: 11, fullName: "GAMARRA CAMARGO RAQUEL GINA" },
  { code: 12, fullName: "VASQUEZ GONZALES FLOR ELITA" },
  { code: 13, fullName: "BARBOZA VERA GERALDINE ELIZABETH" },
  { code: 14, fullName: "ROMERO LUDEÑA DINA VIVIANA" },
  { code: 15, fullName: "ROMERO VARGAS ANDREA SACHI" },
  { code: 16, fullName: "LAIZA VIDAL KATERINE KARINA" },
  { code: 17, fullName: "ALBERTO OCAÑA ANA MAGDALENA" },
  { code: 18, fullName: "GUTIERREZ CUEVAS DELCY" },
  { code: 19, fullName: "HILARIO MUÑOZ JHORDAN JHON" },
  { code: 20, fullName: "GOMEZ CANCHARI YULISA" },
  { code: 21, fullName: "CHAMORRO TITO DIANA CAROLINA" },
  { code: 22, fullName: "LEON VILCA JUDITH KARINA" },
  { code: 23, fullName: "ALVAREZ PACCO ELIZABETH ANGELA" },
  { code: 24, fullName: "MAMANI MEDINA GABY LUZ" },
  { code: 25, fullName: "PARRA QUISPE JHEYDI YANIRA" },
  { code: 26, fullName: "QUISPE QUISPE ROCIO ESTHER" },
  { code: 27, fullName: "GUERRA CRUZ VALERIA FERNANDA" },
  { code: 28, fullName: "COASACA CAMACHO CECILIA GUADALUPE" },
  { code: 29, fullName: "CURIMANIA MACURI ANNIE SHARON" },
  { code: 30, fullName: "MONTALVO LAZARO YESSENIA DORIS" },
  { code: 31, fullName: "VERGARA PAREDES PAMELA" },
  // ── Vendedores 32-90: completar con la lista completa ─────────────────────
  // El usuario proveerá los registros 32-90. Placeholder hasta recibirlos:
  { code: 32, fullName: "VENDEDOR 32" },
  { code: 33, fullName: "VENDEDOR 33" },
  { code: 34, fullName: "VENDEDOR 34" },
  { code: 35, fullName: "VENDEDOR 35" },
  { code: 36, fullName: "VENDEDOR 36" },
  { code: 37, fullName: "VENDEDOR 37" },
  { code: 38, fullName: "VENDEDOR 38" },
  { code: 39, fullName: "VENDEDOR 39" },
  { code: 40, fullName: "VENDEDOR 40" },
  { code: 41, fullName: "VENDEDOR 41" },
  { code: 42, fullName: "VENDEDOR 42" },
  { code: 43, fullName: "VENDEDOR 43" },
  { code: 44, fullName: "VENDEDOR 44" },
  { code: 45, fullName: "VENDEDOR 45" },
  { code: 46, fullName: "VENDEDOR 46" },
  { code: 47, fullName: "VENDEDOR 47" },
  { code: 48, fullName: "VENDEDOR 48" },
  { code: 49, fullName: "VENDEDOR 49" },
  { code: 50, fullName: "VENDEDOR 50" },
  { code: 51, fullName: "VENDEDOR 51" },
  { code: 52, fullName: "VENDEDOR 52" },
  { code: 53, fullName: "VENDEDOR 53" },
  { code: 54, fullName: "VENDEDOR 54" },
  { code: 55, fullName: "VENDEDOR 55" },
  { code: 56, fullName: "VENDEDOR 56" },
  { code: 57, fullName: "VENDEDOR 57" },
  { code: 58, fullName: "VENDEDOR 58" },
  { code: 59, fullName: "VENDEDOR 59" },
  { code: 60, fullName: "VENDEDOR 60" },
  { code: 61, fullName: "VENDEDOR 61" },
  { code: 62, fullName: "VENDEDOR 62" },
  { code: 63, fullName: "VENDEDOR 63" },
  { code: 64, fullName: "VENDEDOR 64" },
  { code: 65, fullName: "VENDEDOR 65" },
  { code: 66, fullName: "VENDEDOR 66" },
  { code: 67, fullName: "VENDEDOR 67" },
  { code: 68, fullName: "VENDEDOR 68" },
  { code: 69, fullName: "VENDEDOR 69" },
  { code: 70, fullName: "VENDEDOR 70" },
  { code: 71, fullName: "VENDEDOR 71" },
  { code: 72, fullName: "VENDEDOR 72" },
  { code: 73, fullName: "VENDEDOR 73" },
  { code: 74, fullName: "VENDEDOR 74" },
  { code: 75, fullName: "VENDEDOR 75" },
  { code: 76, fullName: "VENDEDOR 76" },
  { code: 77, fullName: "VENDEDOR 77" },
  { code: 78, fullName: "VENDEDOR 78" },
  { code: 79, fullName: "VENDEDOR 79" },
  { code: 80, fullName: "VENDEDOR 80" },
  { code: 81, fullName: "VENDEDOR 81" },
  { code: 82, fullName: "VENDEDOR 82" },
  { code: 83, fullName: "VENDEDOR 83" },
  { code: 84, fullName: "VENDEDOR 84" },
  { code: 85, fullName: "VENDEDOR 85" },
  { code: 86, fullName: "VENDEDOR 86" },
  { code: 87, fullName: "VENDEDOR 87" },
  { code: 88, fullName: "VENDEDOR 88" },
  { code: 89, fullName: "VENDEDOR 89" },
  { code: 90, fullName: "VENDEDOR 90" },
]

async function main() {
  console.log("🌱 Iniciando seed...")

  // Upsert sellers
  console.log("👥 Insertando vendedores...")
  await prisma.$transaction(
    SELLERS.map((s) =>
      prisma.seller.upsert({
        where: { code: s.code },
        update: { fullName: s.fullName },
        create: s,
      })
    )
  )
  console.log(`✅ ${SELLERS.length} vendedores insertados`)

  // Sales points are loaded from JSON file
  // Run: npx ts-node prisma/load-points.ts to load the 18,763 points
  // Or use the /api/import endpoint with the Excel file
  const existingPoints = await prisma.salesPoint.count()
  console.log(`ℹ️  Puntos de venta existentes: ${existingPoints}`)

  if (existingPoints === 0) {
    console.log("⚠️  No hay puntos cargados. Ejecuta: npx ts-node prisma/load-points.ts")
  }

  console.log("✅ Seed completado")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
