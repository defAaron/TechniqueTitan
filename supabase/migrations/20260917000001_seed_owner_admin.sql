-- Unlock /admin for the project owner. Run this on the same Supabase project
-- Vercel uses. Email must match the signed-in Auth user (lowercased).
insert into public.app_admins (email)
values (lower('aaronsumit123@gmail.com'))
on conflict (email) do nothing;
