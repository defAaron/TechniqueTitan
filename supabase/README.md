# Technique Titan — Supabase Auth

Dedicated **Technique Titan** project only. Do not apply these migrations to
another app’s database (the connected calendar project with `public.accounts`
is the wrong target).

This project stores **identity only** (profiles, admin list). Analysis results
are **not** persisted yet — Phase 3b will add session tables when progress
tracking ships ([`docs/ROADMAP.md`](../docs/ROADMAP.md)).

## Create the project

1. [supabase.com](https://supabase.com) → **New project** (name e.g. `technique-titan`).
2. Copy **Project URL** and the **anon / publishable** key into `web/.env.local`
   (see [`web/.env.example`](../web/.env.example)). Production: the same two
   values on Vercel, then **redeploy**. URL and key must be from this project
   (the JWT payload `ref` must match the hostname). Paste the key as one line
   with no quotes. Never put the **service_role** key in `web/` or Vercel
   frontend env.
3. Run [`bootstrap.sql`](bootstrap.sql) once in the SQL editor (creates `profiles`,
   `app_admins`, triggers, admin emails, and backfills Google signups). Or run
   the files in [`migrations/`](migrations/) in order. If you only `insert into
   app_admins` and the table does not exist, create the schema first.

## Auth URLs

Dashboard → **Authentication** → **URL configuration**:

| Setting | Value |
|---|---|
| Site URL | `https://technique-titan.vercel.app` |
| Redirect URLs | `http://localhost:5173/auth/callback` |
| | `https://technique-titan.vercel.app/auth/callback` |

Do **not** leave Site URL as `http://localhost:3000` (Supabase’s Next.js default). If the confirm
link is not in Redirect URLs, GoTrue sends the user there and the token shows
`otp_expired` / “Email link is invalid or has expired”. After changing URLs,
resend confirmation and use only the new email.

## Email

Enable the Email provider. Keep confirmations **on** in production. Users who
sign up with email will see a “check your inbox” message until they confirm.

Local testing: you can disable confirmations on a non-production project, or
use the Inbucket/Mailpit inbox shown in the Auth settings.

## Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
   **Create credentials** → **OAuth client ID** → application type **Web**.
2. Authorized redirect URI (Supabase, not the app):

   `https://<project-ref>.supabase.co/auth/v1/callback`

3. Dashboard → **Authentication** → **Providers** → **Google**: paste Client ID
   and Client Secret, enable the provider.

## Admin stats (`/admin`)

After you create an account and confirm it, add that exact sign-in email
(lowercased) to `app_admins`. The **Admin** nav link stays hidden until this
row exists on the same project Vercel uses:

```sql
insert into public.app_admins (email) values
  (lower('aaron.dutta22@gmail.com')),
  (lower('aaronsumit123@gmail.com'))
on conflict (email) do nothing;
```

You must be **signed in as one of those emails**. The Admin link is per session, not
global. Google tokens often omit `email` in the JWT — run
[`20260917000003_is_admin_from_auth_users.sql`](migrations/20260917000003_is_admin_from_auth_users.sql)
so `is_admin()` uses `auth.users.email`. Do not combine that with a `profiles`
backfill in the same SQL editor run: if the backfill errors, Postgres rolls back
the admin insert too.

Then refresh a signed-in tab (or sign out and back in). `/admin` is also
gated by `is_admin()` — a hidden link is not security. If you signed up with
a different address, insert that email instead. The table and `is_admin()`
function come from the previous migration; run that first if the insert fails.

The in-app **Admin** link and signup counts are gated by `is_admin()` (JWT email
vs `app_admins`). Do not treat a hidden nav link as security. `/admin` lists
`auth.users` (via `admin_list_signups()` after the backfill migration). If a
Google account is missing, run
[`20260917000002_admin_list_signups.sql`](migrations/20260917000002_admin_list_signups.sql)
on that project and refresh `/admin`. Two Google logins with the **same email**
are one Auth user, not two rows.
