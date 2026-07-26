-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('DRAFT', 'LISTED', 'SOLD');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('FB_MARKETPLACE', 'DEPOP', 'EBAY');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "photos" TEXT[],
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "size" TEXT,
    "color" TEXT,
    "condition" TEXT,
    "suggestedPrice" DECIMAL(10,2),
    "listPrice" DECIMAL(10,2) NOT NULL,
    "purchasePrice" DECIMAL(10,2) NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'LISTED',
    "soldPrice" DECIMAL(10,2),
    "soldPlatform" "Platform",
    "soldDate" TIMESTAMP(3),
    "platformFees" DECIMAL(10,2) DEFAULT 0,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE INDEX "Item_createdAt_idx" ON "Item"("createdAt");
