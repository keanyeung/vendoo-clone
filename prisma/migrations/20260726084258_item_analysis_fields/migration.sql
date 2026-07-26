-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "aiConfidence" TEXT,
ADD COLUMN     "conditionNotes" TEXT,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priceHigh" DECIMAL(10,2),
ADD COLUMN     "priceLow" DECIMAL(10,2),
ADD COLUMN     "priceReasoning" TEXT,
ADD COLUMN     "purchaseDate" TIMESTAMP(3),
ADD COLUMN     "source" TEXT;
