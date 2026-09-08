-- Supabase enables RLS automatically for tables created in public. This table
-- is platform-only, so give the API's explicit platform context full access.
ALTER TABLE "platform_staff_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_staff_invites" FORCE ROW LEVEL SECURITY;

CREATE POLICY platform_access ON "platform_staff_invites"
  FOR ALL
  USING (app_is_platform())
  WITH CHECK (app_is_platform());
