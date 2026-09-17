-- Google JWTs often have no email claim, so is_admin() was always false.
-- Match app_admins to auth.users.email for the signed-in uid.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.app_admins a
    where a.email = lower(coalesce(
      (select u.email from auth.users u where u.id = auth.uid()),
      auth.jwt() ->> 'email',
      ''
    ))
  );
$$;

insert into public.app_admins (email) values
  (lower('aaron.dutta22@gmail.com')),
  (lower('aaronsumit123@gmail.com'))
on conflict (email) do nothing;
