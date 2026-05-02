ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS folder TEXT;
CREATE INDEX IF NOT EXISTS idx_notes_user_folder ON public.notes(user_id, folder);