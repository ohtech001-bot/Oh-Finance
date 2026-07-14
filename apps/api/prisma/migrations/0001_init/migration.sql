-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name_ar" VARCHAR(80) NOT NULL,
    "name_he" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "price_monthly" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "max_stores" INTEGER NOT NULL DEFAULT 1,
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "max_customers" INTEGER NOT NULL DEFAULT 1000,
    "max_orders_per_month" INTEGER NOT NULL DEFAULT 5000,
    "max_storage_mb" INTEGER NOT NULL DEFAULT 1024,
    "features" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(48) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "timezone" VARCHAR(48) NOT NULL DEFAULT 'Asia/Jerusalem',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "suspended_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "trial_ends_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32),
    "email" VARCHAR(254),
    "address" VARCHAR(240),
    "city" VARCHAR(80),
    "logo_url" VARCHAR(512),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ILS',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32),
    "address" VARCHAR(240),
    "city" VARCHAR(80),
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "description" VARCHAR(240),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "key" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "is_platform" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_key" VARCHAR(64) NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_key")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "user_id" UUID NOT NULL,
    "permission_key" VARCHAR(64) NOT NULL,
    "tenant_id" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id","permission_key")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "store_id" UUID,
    "branch_id" UUID,
    "role_id" UUID,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(32),
    "password_hash" VARCHAR(255) NOT NULL,
    "avatar_url" VARCHAR(512),
    "job_title" VARCHAR(80),
    "department" VARCHAR(80),
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "totp_secret" VARCHAR(255),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "recovery_codes" JSONB,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(64) NOT NULL,
    "family_id" UUID NOT NULL,
    "user_agent" VARCHAR(512),
    "ip_address" VARCHAR(64),
    "csrf_token_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" VARCHAR(64),
    "replaced_by_id" UUID,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "seq" BIGSERIAL NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(64),
    "entity_id" VARCHAR(64),
    "actor_id" UUID,
    "actor_name" VARCHAR(120),
    "actor_ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(64),
    "summary" VARCHAR(500) NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "prev_hash" CHAR(64),
    "hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plans_is_active_idx" ON "plans"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_status_idx" ON "subscriptions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "stores_tenant_id_is_active_idx" ON "stores"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "stores_tenant_id_code_key" ON "stores"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "branches_tenant_id_store_id_idx" ON "branches"("tenant_id", "store_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_store_id_code_key" ON "branches"("tenant_id", "store_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "role_permissions_tenant_id_idx" ON "role_permissions"("tenant_id");

-- CreateIndex
CREATE INDEX "user_permissions_tenant_id_idx" ON "user_permissions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_status_idx" ON "users"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "users_tenant_id_role_id_idx" ON "users"("tenant_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_hash_key" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_replaced_by_id_key" ON "sessions"("replaced_by_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_family_id_idx" ON "sessions"("family_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_seq_idx" ON "audit_logs"("tenant_id", "seq");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_action_created_at_idx" ON "audit_logs"("tenant_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_key_fkey" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

