create table if not exists public.medical_library_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid null references public.lessons(id) on delete set null,
  subject_slug text null,
  entry_type text not null check (entry_type in ('note', 'highlight', 'canvas', 'attachment')),
  title text null,
  body text null,
  quote text null,
  color text not null default '#facc15',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists medical_library_entries_user_idx
  on public.medical_library_entries(user_id, updated_at desc);

create index if not exists medical_library_entries_lesson_idx
  on public.medical_library_entries(lesson_id, updated_at desc);

create index if not exists medical_library_entries_subject_idx
  on public.medical_library_entries(subject_slug, updated_at desc);

create or replace function public.touch_medical_library_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_medical_library_entries_updated_at on public.medical_library_entries;
create trigger trg_medical_library_entries_updated_at
before update on public.medical_library_entries
for each row
execute function public.touch_medical_library_entries_updated_at();

alter table public.medical_library_entries enable row level security;

drop policy if exists medical_library_entries_select_own on public.medical_library_entries;
create policy medical_library_entries_select_own
on public.medical_library_entries
for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists medical_library_entries_insert_own on public.medical_library_entries;
create policy medical_library_entries_insert_own
on public.medical_library_entries
for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists medical_library_entries_update_own on public.medical_library_entries;
create policy medical_library_entries_update_own
on public.medical_library_entries
for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists medical_library_entries_delete_own on public.medical_library_entries;
create policy medical_library_entries_delete_own
on public.medical_library_entries
for delete
using (auth.uid() = user_id or public.is_admin());
