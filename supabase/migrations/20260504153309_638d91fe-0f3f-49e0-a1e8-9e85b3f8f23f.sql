
CREATE OR REPLACE FUNCTION public.get_user_storage_usage(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT COALESCE(SUM(file_size), 0)
    FROM public.task_attachments
    WHERE user_id = _user_id AND storage_type = 'cloud'
  ), 0)
  + COALESCE((
    SELECT COALESCE(SUM( (metadata->>'size')::bigint ), 0)
    FROM storage.objects
    WHERE bucket_id IN ('task-attachments','downloads')
      AND (storage.foldername(name))[1] = _user_id::text
  ), 0);
$$;
