CREATE TYPE public.task_type AS ENUM ('homework','exam','revision','vocab','other');
ALTER TABLE public.tasks ADD COLUMN task_type public.task_type NOT NULL DEFAULT 'other';