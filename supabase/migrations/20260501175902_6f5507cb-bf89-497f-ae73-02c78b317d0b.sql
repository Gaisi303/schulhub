
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by owner" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Enums
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.task_status AS ENUM ('open', 'in_progress', 'done');

-- Tasks
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  due_date DATE NOT NULL,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tasks select own" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tasks insert own" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tasks update own" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Tasks delete own" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_tasks_user ON public.tasks(user_id);
CREATE INDEX idx_tasks_due ON public.tasks(user_id, due_date);

-- Subject progress
CREATE TABLE public.subject_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  current_grade NUMERIC(2,1) NOT NULL DEFAULT 3.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject)
);
ALTER TABLE public.subject_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Progress select own" ON public.subject_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Progress insert own" ON public.subject_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Progress update own" ON public.subject_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Progress delete own" ON public.subject_progress FOR DELETE USING (auth.uid() = user_id);

-- Meal dismissals (one per ISO week start date)
CREATE TABLE public.meal_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start)
);
ALTER TABLE public.meal_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Meal select own" ON public.meal_dismissals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Meal insert own" ON public.meal_dismissals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Meal delete own" ON public.meal_dismissals FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_progress_updated BEFORE UPDATE ON public.subject_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + seed subjects on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  subj TEXT;
  subjects TEXT[] := ARRAY['Mathematik','Deutsch','Englisch','Geschichte','Biologie','Physik','Chemie','Informatik','Geografie','Religion','Musik','Sport'];
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  FOREACH subj IN ARRAY subjects LOOP
    INSERT INTO public.subject_progress (user_id, subject, current_grade) VALUES (NEW.id, subj, 3.0);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
