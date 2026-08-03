-- A null shipping cost means it was not recorded; a recorded zero means the
-- sale did not incur a shipping cost.
ALTER TABLE "Item" ADD COLUMN "shippingCost" DECIMAL(10,2);
