-- Reduce auto-seeded subjects to a small core set; let users add the rest
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  subj TEXT;
  subjects TEXT[] := ARRAY['Mathematik','Deutsch','Englisch'];
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  FOREACH subj IN ARRAY subjects LOOP
    INSERT INTO public.subject_progress (user_id, subject, current_grade) VALUES (NEW.id, subj, 3.0);
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Ensure unique (user_id, subject) so we can upsert when re-adding
CREATE UNIQUE INDEX IF NOT EXISTS subject_progress_user_subject_uniq
  ON public.subject_progress (user_id, subject);

-- Track grade changes over time for the trend chart
CREATE TABLE IF NOT EXISTS public.grade_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  grade NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Grade history select own"
  ON public.grade_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Grade history insert own"
  ON public.grade_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Grade history delete own"
  ON public.grade_history FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS grade_history_user_recorded_idx
  ON public.grade_history (user_id, recorded_at);