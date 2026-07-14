-- DropIndex
DROP INDEX "audit_logs_tenant_seq_key";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);
