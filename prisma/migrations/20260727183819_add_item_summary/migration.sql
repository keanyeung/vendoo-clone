-- One-sentence product summary generated alongside the listing draft, used by
-- platform-specific copy (starting with Facebook Marketplace). Nullable so
-- existing rows remain valid; they simply have no summary until re-generated.
ALTER TABLE "Item" ADD COLUMN "summary" TEXT;