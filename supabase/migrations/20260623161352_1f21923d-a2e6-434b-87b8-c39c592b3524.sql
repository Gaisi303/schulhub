
-- Extend task_type enum with private-area values
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'appointment';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'meeting';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'errand';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'health';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'household';
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'personal';

-- saved_links: allow tips (without URL) and store AI/text content
ALTER TABLE public.saved_links ALTER COLUMN url DROP NOT NULL;
ALTER TABLE public.saved_links ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'link';
ALTER TABLE public.saved_links ADD COLUMN IF NOT EXISTS content text;
ALTER TABLE public.saved_links
  ADD CONSTRAINT saved_links_kind_check
  CHECK (kind IN ('link','tip'));
