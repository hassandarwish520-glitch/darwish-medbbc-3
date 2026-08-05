-- Future signups should remain pending until email confirmation + admin activation.
-- Preserve role choice from signup metadata and keep institution when available.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, institution, role, status, activated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    nullif(new.raw_user_meta_data->>'institution',''),
    case
      when new.email = 'hassandarwish520@gmail.com' then 'admin'::user_role
      when lower(coalesce(new.raw_user_meta_data->>'role','student')) in ('educator','instructor') then 'educator'::user_role
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
      institution = coalesce(excluded.institution, public.profiles.institution);

  return new;
end $$;
