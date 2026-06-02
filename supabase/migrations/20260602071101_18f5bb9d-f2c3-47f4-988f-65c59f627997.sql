REVOKE EXECUTE ON FUNCTION public.admin_reset_all_points() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_points() TO service_role;