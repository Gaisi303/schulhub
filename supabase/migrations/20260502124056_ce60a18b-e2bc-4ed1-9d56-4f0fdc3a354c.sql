ALTER TABLE public.subject_progress ALTER COLUMN current_grade DROP NOT NULL;
ALTER TABLE public.subject_progress ALTER COLUMN current_grade DROP DEFAULT;