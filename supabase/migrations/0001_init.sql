-- =========================================================
-- Darwish MedBBC — Initial Schema (RBAC + RLS + Content Tree)
-- =========================================================
create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------- ROLES ----------
create type user_role as enum ('admin','student','educator');
create type user_status as enum ('pending','active','suspended');
create type lesson_kind as enum ('html','pdf','qbank','flashcards','notes');
create type question_kind as enum ('sba','vignette','recall','application');
create type difficulty as enum ('foundation','intermediate','advanced','expert');

-- ---------- PROFILES ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  institution text,
  role user_role not null default 'student',
  status user_status not null default 'pending',
  activated_at timestamptz,
  activated_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Bootstrap: auto-activate the master admin on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, status, activated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when new.email = 'hassandarwish520@gmail.com' then 'admin'::user_role
         else 'student'::user_role end,
    case when new.email = 'hassandarwish520@gmail.com' then 'active'::user_status
         else 'pending'::user_status end,
    case when new.email = 'hassandarwish520@gmail.com' then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- CONTENT TREE ----------
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  cover_url text,
  visible boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  position int not null default 0
);

create table if not exists systems (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  title text not null,
  position int not null default 0
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references systems(id) on delete cascade,
  title text not null,
  position int not null default 0
);

create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references topics(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  title text not null,
  kind lesson_kind not null,
  storage_path text,                 -- private path in Storage
  html_body text,                    -- raw HTML for inline lessons
  meta jsonb not null default '{}',
  visible boolean not null default true,
  position int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- ENROLLMENTS ----------
create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

-- ---------- QUESTION BANK ----------
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  kind question_kind not null default 'sba',
  difficulty difficulty not null default 'intermediate',
  stem text not null,
  choices jsonb not null,            -- [{key:'A',text:'...'}]
  answer_key text not null,          -- 'A'
  explanation text,
  tags text[] not null default '{}',
  ai_generated boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  chosen text not null,
  correct boolean not null,
  time_ms int,
  created_at timestamptz not null default now()
);

-- ---------- FLASHCARDS (SM-2) ----------
create table if not exists flashcards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete set null,
  topic_id uuid references topics(id) on delete set null,
  front text not null,
  back text not null,
  tags text[] not null default '{}',
  ai_generated boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  flashcard_id uuid not null references flashcards(id) on delete cascade,
  ease numeric not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  last_grade int,
  updated_at timestamptz not null default now(),
  unique (user_id, flashcard_id)
);

-- ---------- NOTES ----------
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- BOOKMARKS ----------
create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

-- ---------- RAG EMBEDDINGS ----------
create table if not exists rag_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,         -- 'lesson' | 'question' | 'flashcard' | 'note'
  source_id uuid not null,
  content text not null,
  content_hash text not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (source_type, source_id, content_hash)
);
create index if not exists rag_chunks_embedding_idx
  on rag_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------- AI CHAT ----------
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);
create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  role text not null,                -- 'user' | 'assistant' | 'system'
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

-- ---------- HELPERS ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin' and p.status = 'active');
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.status = 'active');
$$;

-- ---------- RLS ----------
alter table profiles           enable row level security;
alter table courses            enable row level security;
alter table subjects           enable row level security;
alter table systems            enable row level security;
alter table topics             enable row level security;
alter table lessons            enable row level security;
alter table enrollments        enable row level security;
alter table questions          enable row level security;
alter table question_attempts  enable row level security;
alter table flashcards         enable row level security;
alter table flashcard_reviews  enable row level security;
alter table notes              enable row level security;
alter table bookmarks          enable row level security;
alter table rag_chunks         enable row level security;
alter table ai_conversations   enable row level security;
alter table ai_messages        enable row level security;

-- profiles
create policy "profiles self read"  on profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles self update" on profiles for update using (auth.uid() = id) with check (auth.uid() = id and role = (select role from profiles where id = auth.uid()));
create policy "profiles admin write" on profiles for update using (public.is_admin());

-- content (read: any active user; write: admin only)
create policy "courses read"  on courses  for select using (public.is_active() and visible or public.is_admin());
create policy "courses write" on courses  for all    using (public.is_admin()) with check (public.is_admin());
create policy "subjects read" on subjects for select using (public.is_active() or public.is_admin());
create policy "subjects write" on subjects for all   using (public.is_admin()) with check (public.is_admin());
create policy "systems read"  on systems  for select using (public.is_active() or public.is_admin());
create policy "systems write" on systems  for all    using (public.is_admin()) with check (public.is_admin());
create policy "topics read"   on topics   for select using (public.is_active() or public.is_admin());
create policy "topics write"  on topics   for all    using (public.is_admin()) with check (public.is_admin());
create policy "lessons read"  on lessons  for select using ((public.is_active() and visible) or public.is_admin());
create policy "lessons write" on lessons  for all    using (public.is_admin()) with check (public.is_admin());

-- enrollments
create policy "enroll self read"  on enrollments for select using (user_id = auth.uid() or public.is_admin());
create policy "enroll self create" on enrollments for insert with check (user_id = auth.uid());
create policy "enroll admin write" on enrollments for update using (public.is_admin()) with check (public.is_admin());
create policy "enroll admin delete" on enrollments for delete using (public.is_admin());

-- questions
create policy "questions read"  on questions for select using (public.is_active() or public.is_admin());
create policy "questions write" on questions for all    using (public.is_admin()) with check (public.is_admin());
create policy "attempts self"   on question_attempts for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- flashcards
create policy "flashcards read"  on flashcards for select using (public.is_active() or public.is_admin());
create policy "flashcards write" on flashcards for all    using (public.is_admin()) with check (public.is_admin());
create policy "reviews self"     on flashcard_reviews for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- notes & bookmarks
create policy "notes self"     on notes     for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bookmarks self" on bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rag & ai
create policy "rag read"  on rag_chunks for select using (public.is_active() or public.is_admin());
create policy "rag write" on rag_chunks for all    using (public.is_admin()) with check (public.is_admin());
create policy "convo self" on ai_conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "messages self" on ai_messages for all
  using (exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- ---------- STORAGE BUCKET (private) ----------
insert into storage.buckets (id, name, public)
values ('lesson-assets','lesson-assets', false)
on conflict (id) do nothing;

create policy "lesson-assets admin all"
  on storage.objects for all
  using (bucket_id = 'lesson-assets' and public.is_admin())
  with check (bucket_id = 'lesson-assets' and public.is_admin());

-- Active students can read via signed URLs only (server-side); no direct public policy.

-- ---------- RAG SEARCH FUNCTION ----------
create or replace function public.match_rag_chunks(
  query_embedding vector(1536),
  match_count int default 6
) returns table (
  id uuid, source_type text, source_id uuid, content text, similarity float
) language sql stable as $$
  select id, source_type, source_id, content,
         1 - (embedding <=> query_embedding) as similarity
  from rag_chunks
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
