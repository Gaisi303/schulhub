
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Neue Notiz',
  content TEXT NOT NULL DEFAULT '',
  subject TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notes select own" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notes insert own" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notes update own" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Notes delete own" ON public.notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_notes_updated_at
BEFORE UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_notes_user ON public.notes(user_id, updated_at DESC);

CREATE TABLE public.mindmaps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Neue Mindmap',
  subject TEXT,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mindmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mindmaps select own" ON public.mindmaps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Mindmaps insert own" ON public.mindmaps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Mindmaps update own" ON public.mindmaps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Mindmaps delete own" ON public.mindmaps FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_mindmaps_updated_at
BEFORE UPDATE ON public.mindmaps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mindmaps_user ON public.mindmaps(user_id, updated_at DESC);
