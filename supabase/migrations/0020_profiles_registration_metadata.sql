alter table public.profiles
  add column if not exists preparation_type text,
  add column if not exists purpose_of_access text,
  add column if not exists selected_plan text;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    institution,
    preparation_type,
    current_level,
    purpose_of_access,
    selected_plan,
    role,
    status,
    activated_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'institution',''),
    nullif(new.raw_user_meta_data->>'preparation_type',''),
    nullif(new.raw_user_meta_data->>'current_level',''),
    nullif(new.raw_user_meta_data->>'purpose_of_access',''),
    nullif(new.raw_user_meta_data->>'selected_plan',''),
    case
      when new.email = 'hassandarwish520@gmail.com' then 'admin'::user_role
      else 'student'::user_role
    end,
    case
      when new.email = 'hassandarwish520@gmail.com' then 'active'::user_status
      else 'pending'::user_status
    end,
    case when new.email = 'hassandarwish520@gmail.com' then now() else null end
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      institution = coalesce(excluded.institution, public.profiles.institution),
      preparation_type = coalesce(excluded.preparation_type, public.profiles.preparation_type),
      current_level = coalesce(excluded.current_level, public.profiles.current_level),
      purpose_of_access = coalesce(excluded.purpose_of_access, public.profiles.purpose_of_access),
      selected_plan = coalesce(excluded.selected_plan, public.profiles.selected_plan);

  return new;
end $$;
