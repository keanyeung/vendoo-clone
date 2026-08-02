-- CreateTable
CREATE TABLE "ItemPosting" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPosting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemPosting_itemId_idx" ON "ItemPosting"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPosting_itemId_platform_key" ON "ItemPosting"("itemId", "platform");

-- AddForeignKey
ALTER TABLE "ItemPosting" ADD CONSTRAINT "ItemPosting_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

