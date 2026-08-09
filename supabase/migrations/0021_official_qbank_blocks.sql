-- 0021_official_qbank_blocks.sql
-- Classify qbank lessons as "official" NBME/UWorld-style fixed blocks.

UPDATE public.lessons
SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
  'is_official_block', true,
  'block_kind', 'official',
  'fixed_block', true
)
WHERE kind = 'qbank'
  AND title IN (
    'Cardiology Block 1 (35 Questions)',
    'Cardiology Block 2 (35 Questions)',
    'Cardiology Block 3 (21 Questions)'
  );

UPDATE public.questions q
SET tags = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    CASE
      WHEN q.tags IS NULL OR cardinality(q.tags) = 0 THEN ARRAY['Official','FixedBlock']::text[]
      ELSE q.tags || ARRAY['Official','FixedBlock']::text[]
    END
  ) AS t
)
WHERE q.lesson_id IN (
  SELECT id FROM public.lessons
  WHERE kind = 'qbank'
    AND title IN (
      'Cardiology Block 1 (35 Questions)',
      'Cardiology Block 2 (35 Questions)',
      'Cardiology Block 3 (21 Questions)'
    )
)
AND NOT ('Official' = ANY(COALESCE(q.tags, ARRAY[]::text[])));

CREATE INDEX IF NOT EXISTS idx_lessons_official_block
  ON public.lessons ((meta->>'is_official_block'))
  WHERE kind = 'qbank';

NOTIFY pgrst, 'reload schema';
