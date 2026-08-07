-- 0016_flashcards_deck.sql
-- Upgrade flashcards table with rich card sections + personal attitude (bookmark / wrong) + spaced-repetition audit
-- Safe to run multiple times (NO-OP if column already exists).

-- Rich card content ------------------------------------------------
alter table flashcards
  add column if not exists section text,
  add column if not exists high_yield text,
  add column if not exists clinical_pearl text,
  add column if not exists memory_tip text,
  add column if not exists references text[] default '{}',
  add column if not exists difficulty text default 'medium',
  add column if not exists xp_reward int default 5,
  add column if not exists source text;

-- Per-user personal state -----------------------------------------
create table if not exists flashcard_state (
  user_id uuid not null references profiles(id) on delete cascade,
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  bookmarked boolean not null default false,
  incorrect_count int not null default 0,
  last_seen_at timestamptz,
  streak_correct int not null default 0,
  primary key (user_id, flashcard_id)
);
alter table flashcard_state enable row level security;
drop policy if exists "flashcard_state self" on flashcard_state;
create policy "flashcard_state self" on flashcard_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Session summary log (analytics) ---------------------------------
create table if not exists flashcard_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  again int not null default 0,
  hard int not null default 0,
  good int not null default 0,
  easy int not null default 0,
  total int not null default 0,
  xp int not null default 0,
  duration_seconds int default 0
);
alter table flashcard_sessions enable row level security;
drop policy if exists "flashcard_sessions self" on flashcard_sessions;
create policy "flashcard_sessions self" on flashcard_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Mark triggered when a flashcard is exported / started
-- pre-existing RLS policies on flashcards still allow reads, no change required.
