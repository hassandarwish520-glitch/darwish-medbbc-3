-- 0013_ifom_library.sql
-- IFOM Library: student-owned items (image questions, ultrashot, flashcards, notes)
-- and a storage policy extension to allow active students to upload images.

CREATE TABLE IF NOT EXISTS public.ifom_library (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('image_question','ultrashot','flashcard','note')),
  subject      TEXT NOT NULL DEFAULT 'General',

  -- Shared text fields
  title        TEXT,                    -- question stem / note title / flashcard front
  body         TEXT,                    -- explanation / note body / flashcard back
  hint         TEXT,                    -- extra hint (ultrashot answer)

  -- MCQ choices (image_question only)
  choices      JSONB,                   -- [{key:"A",text:"..."}, ...]
  answer_key   TEXT,

  -- Image attachment (any type)
  image_path   TEXT,
  image_caption TEXT,

  tags         TEXT[] DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.ifom_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ifom_library_select_own"
  ON public.ifom_library FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "ifom_library_insert_active"
  ON public.ifom_library FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "ifom_library_update_own"
  ON public.ifom_library FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "ifom_library_delete_own"
  ON public.ifom_library FOR DELETE
  USING (user_id = auth.uid());

-- Index for fast per-user list
CREATE INDEX IF NOT EXISTS ifom_library_user_idx ON public.ifom_library(user_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_ifom_library_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_ifom_library_updated_at ON public.ifom_library;
CREATE TRIGGER trg_ifom_library_updated_at
  BEFORE UPDATE ON public.ifom_library
  FOR EACH ROW EXECUTE FUNCTION public.set_ifom_library_updated_at();
