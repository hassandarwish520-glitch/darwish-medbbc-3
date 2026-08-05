-- 0014_questions_video_url.sql
-- Add video_url column to questions table for video explanation support

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL;

-- Index for quick filtering of questions that have videos
CREATE INDEX IF NOT EXISTS questions_video_url_idx
  ON public.questions(id)
  WHERE video_url IS NOT NULL;
