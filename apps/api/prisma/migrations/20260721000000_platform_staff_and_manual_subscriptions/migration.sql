-- Platform staff invitations, first-login password enforcement, and manual billing.
CREATE TYPE "PlatformRole" AS ENUM ('GENERAL_MANAGER', 'MANAGER', 'EMPLOYEE');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

ALTER TABLE "users"
  ADD COLUMN "date_of_birth" DATE,
  ADD COLUMN "identity_number" VARCHAR(32),
  ADD COLUMN "platform_role" "PlatformRole",
  ADD COLUMN "email_verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users"
SET "platform_role" = 'GENERAL_MANAGER',
    "email_verified_at" = COALESCE("password_changed_at", "created_at")
WHERE "is_super_admin" = true;

ALTER TABLE "subscriptions"
  ADD COLUMN "agreed_monthly_amount" DECIMAL(18,4),
  ADD COLUMN "paid_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "payment_status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'UNPAID';

UPDATE "subscriptions" s
SET "agreed_monthly_amount" = p."price_monthly"
FROM "plans" p
WHERE p."id" = s."plan_id";

ALTER TABLE "subscriptions"
  ALTER COLUMN "agreed_monthly_amount" SET NOT NULL;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_billing_amounts_valid"
  CHECK (
    "agreed_monthly_amount" >= 0
    AND "paid_amount" >= 0
    AND "paid_amount" <= "agreed_monthly_amount"
    AND (("payment_status" = 'UNPAID' AND "paid_amount" = 0)
      OR ("payment_status" = 'PAID' AND "paid_amount" = "agreed_monthly_amount")
      OR ("payment_status" = 'PARTIAL' AND "paid_amount" > 0 AND "paid_amount" < "agreed_monthly_amount"))
  );

CREATE TABLE "platform_staff_invites" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(254) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "phone" VARCHAR(10) NOT NULL,
  "date_of_birth" DATE NOT NULL,
  "identity_number" VARCHAR(32) NOT NULL,
  "job_title" VARCHAR(80) NOT NULL,
  "platform_role" "PlatformRole" NOT NULL,
  "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
  "verification_code_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_staff_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_staff_invites_email_key" ON "platform_staff_invites"("email");
CREATE INDEX "platform_staff_invites_expires_at_idx" ON "platform_staff_invites"("expires_at");
