-- 0017_flashcards_image_url_compat.sql
-- Compatibility migration for optional flashcard media.
-- Safe to run multiple times.

alter table public.flashcards
  add column if not exists image_url text;
