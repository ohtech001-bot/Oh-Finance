-- Supabase grants its postgres role membership in newly-created roles with
-- SET FALSE. The API deliberately uses SET LOCAL ROLE oh_app so RLS applies.
-- Keep inheritance disabled, but allow that explicit, transaction-local switch.
GRANT oh_app TO postgres WITH INHERIT FALSE, SET TRUE;
