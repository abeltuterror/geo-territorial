-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateTable
CREATE TABLE "sellers" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_points" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "lastPurchaseDate" TIMESTAMP(3),
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "annualAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'S/',
    "territoryId" TEXT,

    CONSTRAINT "sales_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "geoJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_code_key" ON "sellers"("code");

-- CreateIndex
CREATE INDEX "sales_points_longitude_latitude_idx" ON "sales_points"("longitude", "latitude");

-- AddForeignKey
ALTER TABLE "sales_points" ADD CONSTRAINT "sales_points_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
