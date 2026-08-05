-- Add session persistence fields to quiz_sessions_ext
alter table public.quiz_sessions_ext
  add column if not exists status text not null default 'active',
  add column if not exists current_index int not null default 0,
  add column if not exists answers_json jsonb not null default '{}'::jsonb,
  add column if not exists question_ids text[] not null default '{}'::text[],
  add column if not exists seconds_elapsed int not null default 0,
  add column if not exists score_pct int,
  add column if not exists completed_at timestamptz;

-- status: 'active' | 'suspended' | 'complete'
comment on column public.quiz_sessions_ext.status is 'active = in progress, suspended = paused/navigated away, complete = finished';
comment on column public.quiz_sessions_ext.answers_json is 'map of question_id -> { chosen, correct }';
comment on column public.quiz_sessions_ext.question_ids is 'ordered list of question IDs for this session';
