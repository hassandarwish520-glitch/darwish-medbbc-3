alter table public.questions add column if not exists image_path text;
alter table public.questions add column if not exists image_caption text;

alter table public.notes add column if not exists meta jsonb not null default '{}'::jsonb;
alter table public.notes add column if not exists updated_at timestamptz not null default now();

update public.notes
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

create unique index if not exists notes_user_lesson_unique_idx on public.notes(user_id, lesson_id);

create or replace function public.touch_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
before update on public.notes
for each row execute function public.touch_notes_updated_at();
