-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateTable
CREATE TABLE "vendedores" (
    "id" SERIAL NOT NULL,
    "codigo" INTEGER NOT NULL,
    "nombre_completo" TEXT NOT NULL,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntos_venta" (
    "id" TEXT NOT NULL,
    "nombre_cliente" TEXT NOT NULL,
    "ultima_compra" TIMESTAMP(3),
    "longitud" DOUBLE PRECISION NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "monto_anual" DOUBLE PRECISION,
    "moneda" TEXT NOT NULL DEFAULT 'S/',
    "territorio_id" TEXT,

    CONSTRAINT "puntos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territorios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "vendedor_id" INTEGER NOT NULL,
    "geo_json" JSONB NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territorios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_codigo_key" ON "vendedores"("codigo");

-- CreateIndex
CREATE INDEX "puntos_venta_longitud_latitud_idx" ON "puntos_venta"("longitud", "latitud");

-- AddForeignKey
ALTER TABLE "puntos_venta" ADD CONSTRAINT "puntos_venta_territorio_id_fkey" FOREIGN KEY ("territorio_id") REFERENCES "territorios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territorios" ADD CONSTRAINT "territorios_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
