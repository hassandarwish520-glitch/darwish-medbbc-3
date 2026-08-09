-- 0022_device_security_tracking.sql
-- Device registration, device-limit enforcement telemetry, and admin security audit trail.

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_key text not null,
  device_type text not null check (device_type in ('mobile', 'tablet', 'laptop')),
  platform text,
  browser text,
  user_agent text,
  label text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_ip text,
  is_active boolean not null default true,
  meta jsonb not null default '{}'::jsonb,
  unique(user_id, device_key)
);

create index if not exists user_devices_user_last_seen_idx
  on public.user_devices(user_id, last_seen_at desc);
create index if not exists user_devices_type_idx
  on public.user_devices(device_type);

alter table public.user_devices enable row level security;

drop policy if exists user_devices_self_read on public.user_devices;
create policy user_devices_self_read
  on public.user_devices for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_devices_self_insert on public.user_devices;
create policy user_devices_self_insert
  on public.user_devices for insert
  with check (user_id = auth.uid() and public.is_active());

drop policy if exists user_devices_self_update on public.user_devices;
create policy user_devices_self_update
  on public.user_devices for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'device_registered',
    'device_limit_blocked',
    'admin_new_device_login',
    'admin_file_download'
  )),
  device_key text,
  device_type text check (device_type in ('mobile', 'tablet', 'laptop')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists security_events_user_created_idx
  on public.security_events(user_id, created_at desc);
create index if not exists security_events_type_created_idx
  on public.security_events(event_type, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists security_events_admin_read on public.security_events;
create policy security_events_admin_read
  on public.security_events for select
  using (public.is_admin());

drop policy if exists security_events_self_insert on public.security_events;
create policy security_events_self_insert
  on public.security_events for insert
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists security_events_admin_delete on public.security_events;
create policy security_events_admin_delete
  on public.security_events for delete
  using (public.is_admin());

notify pgrst, 'reload schema';
