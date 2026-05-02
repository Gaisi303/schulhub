CREATE TABLE public.exam_grades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  exam_name TEXT NOT NULL,
  grade NUMERIC NOT NULL,
  exam_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exam grades select own" ON public.exam_grades
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Exam grades insert own" ON public.exam_grades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Exam grades update own" ON public.exam_grades
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Exam grades delete own" ON public.exam_grades
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_exam_grades_updated_at
  BEFORE UPDATE ON public.exam_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_exam_grades_user_subject ON public.exam_grades(user_id, subject);