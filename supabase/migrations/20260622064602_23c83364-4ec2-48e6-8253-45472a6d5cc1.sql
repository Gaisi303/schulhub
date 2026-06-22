REVOKE EXECUTE ON FUNCTION public.get_user_storage_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_storage_usage(uuid) TO service_role;

DROP POLICY IF EXISTS "Grade calculations update own" ON public.grade_calculations;
CREATE POLICY "Grade calculations update own"
  ON public.grade_calculations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Meal dismissals update own" ON public.meal_dismissals;
CREATE POLICY "Meal dismissals update own"
  ON public.meal_dismissals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Task attachments update own" ON public.task_attachments;
CREATE POLICY "Task attachments update own"
  ON public.task_attachments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Profiles delete own" ON public.profiles;
CREATE POLICY "Profiles delete own"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Downloads update own" ON storage.objects;
CREATE POLICY "Downloads update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'downloads' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'downloads' AND (storage.foldername(name))[1] = auth.uid()::text);