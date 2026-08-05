ALTER TABLE "orders"
  ADD COLUMN "credit_applied_amount" DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_credit_applied_non_negative"
  CHECK ("credit_applied_amount" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_credit_applied_within_paid"
  CHECK ("credit_applied_amount" <= "paid_amount");
