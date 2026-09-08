-- A later GRANT ON ALL TABLES restored these privileges after 0002 revoked
-- them. Keep the trigger as defense in depth and restore least privilege.
REVOKE UPDATE, DELETE ON "audit_logs" FROM oh_app;
