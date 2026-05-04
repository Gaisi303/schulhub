
REVOKE EXECUTE ON FUNCTION public.get_user_storage_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_storage_usage()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_storage_usage(auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_storage_usage() TO authenticated;
