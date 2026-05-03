-- Grade calculations history
CREATE TABLE public.grade_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  country TEXT NOT NULL,
  subject TEXT,
  title TEXT NOT NULL DEFAULT 'Berechnung',
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  result_grade NUMERIC NOT NULL,
  result_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.grade_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gc select own" ON public.grade_calculations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gc insert own" ON public.grade_calculations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gc delete own" ON public.grade_calculations FOR DELETE USING (auth.uid() = user_id);

-- Task attachments
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  storage_type TEXT NOT NULL DEFAULT 'cloud', -- 'cloud' or 'local'
  storage_path TEXT, -- path in bucket if cloud
  local_data_url TEXT, -- small previews for local (optional)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta select own" ON public.task_attachments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ta insert own" ON public.task_attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ta delete own" ON public.task_attachments FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for task attachments (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "task-attach read own" ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "task-attach insert own" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "task-attach delete own" ON storage.objects FOR DELETE
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);