
-- Area enum: school vs private
DO $$ BEGIN
  CREATE TYPE public.app_area AS ENUM ('school', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add area + important to tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS area public.app_area NOT NULL DEFAULT 'school',
  ADD COLUMN IF NOT EXISTS important boolean NOT NULL DEFAULT false;

-- Add area to notes
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS area public.app_area NOT NULL DEFAULT 'school';

-- Add area to chat_sessions so school Lern-AI and private Haushalts-AI are separated
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS area public.app_area NOT NULL DEFAULT 'school';

-- Saved links table for the "Links" tab in the private area
CREATE TABLE IF NOT EXISTS public.saved_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area public.app_area NOT NULL DEFAULT 'private',
  url text NOT NULL,
  title text,
  description text,
  summary text,
  tags text[] NOT NULL DEFAULT '{}',
  favicon text,
  folder text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_links TO authenticated;
GRANT ALL ON public.saved_links TO service_role;
ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own links" ON public.saved_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own links" ON public.saved_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own links" ON public.saved_links
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own links" ON public.saved_links
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_saved_links_updated_at
  BEFORE UPDATE ON public.saved_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_saved_links_user ON public.saved_links(user_id, created_at DESC);
