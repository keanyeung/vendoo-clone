-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "draftStep" TEXT;

-- CreateIndex
CREATE INDEX "Item_status_updatedAt_idx" ON "Item"("status", "updatedAt");
