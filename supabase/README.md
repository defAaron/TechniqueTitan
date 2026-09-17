# Technique Titan — Supabase Auth

Dedicated **Technique Titan** project only. Do not apply these migrations to
another app’s database (the connected calendar project with `public.accounts`
is the wrong target).

## Create the project

1. [supabase.com](https://supabase.com) → **New project** (name e.g. `technique-titan`).
2. Copy **Project URL** and the **anon / publishable** key into `web/.env.local`
   (see [`web/.env.example`](../web/.env.example)). Never put the **service_role**
   key in `web/` or Vercel frontend env.
3. Run [`migrations/20260917000000_profiles_and_signup_stats.sql`](migrations/20260917000000_profiles_and_signup_stats.sql)
   in the SQL editor (or `supabase db push` after `supabase link`).

## Auth URLs

Dashboard → **Authentication** → **URL configuration**:

| Setting | Value |
|---|---|
| Site URL | `https://technique-titan.vercel.app` |
| Redirect URLs | `http://localhost:5173/auth/callback` |
| | `https://technique-titan.vercel.app/auth/callback` |

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

After you create an account and confirm it:

```sql
insert into public.app_admins (email) values ('you@example.com');
```

The in-app **Admin** link and signup counts are gated by `is_admin()` (JWT email
vs `app_admins`). Do not treat a hidden nav link as security.
