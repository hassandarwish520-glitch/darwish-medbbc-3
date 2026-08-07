-- Migration: Notes become workspace-attached.
-- Notes can now be assigned a `kind` and `category` so they organize
-- automatically inside the Library based on their source:
--   Subject Notes  → category "subject"
--   Lecture Notes  → category "lecture"
--   QBank Notes    → category "qbank" (locked mode)
--   Active QBank   → category "qbank-active"
--   Documents Notes→ category "documents"
--
-- The note body is replaced with a JSON `blocks` array (Notion-like).
-- Legacy plain-text notes are preserved under `legacy_body` for migration.
-- The Workspace stores its editor draft inside `meta.workspace` so the same
-- row owns both the note and its rich workspace.

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS kind text
    NOT NULL DEFAULT 'workspace'
    CHECK (kind IN ('workspace','legacy','imported')),
  ADD COLUMN IF NOT EXISTS category text
    NOT NULL DEFAULT 'documents'
    CHECK (category IN ('subject','lecture','qbank','qbank-active','documents')),
  ADD COLUMN IF NOT EXISTS legacy_body text,
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS notes_category_idx
  on public.notes(user_id, category, updated_at desc);

CREATE INDEX IF NOT EXISTS notes_kind_idx
  on public.notes(user_id, kind);

-- Backfill: legacy plain-text notes keep their body in `body` so existing
-- readers still work. The new `blocks` column stays empty for them.
UPDATE public.notes
  SET legacy_body = body,
      kind = 'legacy'
WHERE kind = 'workspace' AND blocks = '[]'::jsonb AND length(coalesce(body,'')) > 0;
