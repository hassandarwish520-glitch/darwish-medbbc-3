-- 0018_admin_activity_and_exam_tracking.sql
-- Track protected document activity + persist student IFOM exam dates for admin oversight.

create table if not exists public.student_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type text not null check (activity_type in (
    'pdf_view',
    'pdf_download_blocked',
    'pdf_open_blocked',
    'lesson_open',
    'exam_date_saved'
  )),
  lesson_id uuid null references public.lessons(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists student_activity_logs_user_created_idx
  on public.student_activity_logs(user_id, created_at desc);
create index if not exists student_activity_logs_type_created_idx
  on public.student_activity_logs(activity_type, created_at desc);
create index if not exists student_activity_logs_lesson_created_idx
  on public.student_activity_logs(lesson_id, created_at desc);

alter table public.student_activity_logs enable row level security;

drop policy if exists student_activity_logs_self_insert on public.student_activity_logs;
create policy student_activity_logs_self_insert
  on public.student_activity_logs for insert
  with check (user_id = auth.uid() and public.is_active());

drop policy if exists student_activity_logs_self_read on public.student_activity_logs;
create policy student_activity_logs_self_read
  on public.student_activity_logs for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists student_activity_logs_admin_delete on public.student_activity_logs;
create policy student_activity_logs_admin_delete
  on public.student_activity_logs for delete
  using (public.is_admin());

create table if not exists public.student_exam_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  exam_code text not null default 'IFOM_CSE',
  exam_date date,
  reminder_slot text,
  source text not null default 'notifications_page',
  updated_at timestamptz not null default now()
);

create index if not exists student_exam_settings_exam_date_idx
  on public.student_exam_settings(exam_date);

create or replace function public.touch_student_exam_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_exam_settings_updated_at on public.student_exam_settings;
create trigger trg_student_exam_settings_updated_at
before update on public.student_exam_settings
for each row execute function public.touch_student_exam_settings_updated_at();

alter table public.student_exam_settings enable row level security;

drop policy if exists student_exam_settings_self_read on public.student_exam_settings;
create policy student_exam_settings_self_read
  on public.student_exam_settings for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists student_exam_settings_self_upsert on public.student_exam_settings;
create policy student_exam_settings_self_upsert
  on public.student_exam_settings for insert
  with check (user_id = auth.uid() and public.is_active());

drop policy if exists student_exam_settings_self_update on public.student_exam_settings;
create policy student_exam_settings_self_update
  on public.student_exam_settings for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
