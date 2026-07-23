-- Fix: RLS policies on profiles/user_roles/moderation_* call has_role() and
-- is_staff(), but migration 20260723103234 revoked EXECUTE on them from the
-- `authenticated` role. That made every authenticated policy evaluation throw
-- "permission denied for function has_role", so logged-in users read no roles
-- and appeared unapproved. The helpers are SECURITY DEFINER (body runs safely),
-- so `authenticated` must be allowed to CALL them. Grant execute back to
-- authenticated only (anon stays revoked — the policies are TO authenticated).

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;
