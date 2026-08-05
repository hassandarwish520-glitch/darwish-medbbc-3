-- Open signup: keep the owner email as admin, activate everyone else immediately.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, status, activated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    case when new.email = 'hassandarwish520@gmail.com' then 'admin'::user_role
         when coalesce(new.raw_user_meta_data->>'role','student') = 'educator' then 'educator'::user_role
         else 'student'::user_role end,
    case when new.email = 'hassandarwish520@gmail.com' then 'active'::user_status else 'active'::user_status end,
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      status = excluded.status,
      activated_at = excluded.activated_at;
  return new;
end $$;

update public.profiles
set status = 'active', activated_at = coalesce(activated_at, now())
where status = 'pending';
