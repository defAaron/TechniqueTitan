# Supabase

Identity, avatars, practice scores, and the weekly coach lock for the Technique Titan project. The FastAPI process does not connect to this database. The browser uses the anon key; row-level security is what keeps one user off another user’s sessions.

Dedicated **Technique Titan** project only. Do not apply these migrations to
another app’s database (the connected calendar project with `public.accounts`
is the wrong target).

Stores **identity** (`profiles`, `app_admins`), a public **`avatars`** bucket for
profile photos, **opt-in practice progress** (`practice_sessions`,
`session_hands`), and **coach focus** (`coach_focus`, one weekly focus row per
user). Do not store analyze photos, video, or frames in Supabase. Model weights
do not go in Storage either.

What each table is for in the product:

| Table or bucket | Written by | Holds |
|---|---|---|
| `auth.users` | Supabase Auth | Email and Google identities |
| `profiles` | Trigger on signup, then the profile page | Display name |
| `avatars` | Profile page | One square JPEG per user, public bucket |
| `app_admins` | SQL you run by hand | Emails allowed to open `/admin` |
| `practice_sessions`, `session_hands` | “Add to progress” | Scores, severities, tip text, downsampled samples. No media |
| `coach_focus` | Progress page, anon key, `auth.uid() = user_id` | One lock: criterion, dates, five burden numbers |

The API’s `/v1/progress/reduce` only shapes the draft. The insert happens here, under the user JWT. Caps that protect the free 500 MB quota are in the migration (32 KB `samples`, samples cleared past the 20 newest sessions, 400 sessions per user) and again in [`technique_titan.progress`](../src/technique_titan/progress/README.md).

Apply [`migrations/20260923000004_practice_sessions.sql`](migrations/20260923000004_practice_sessions.sql),
[`migrations/20261013000005_profile_avatar.sql`](migrations/20261013000005_profile_avatar.sql),
and [`migrations/20261014000006_coach_focus.sql`](migrations/20261014000006_coach_focus.sql)
on the production project (or re-run [`bootstrap.sql`](bootstrap.sql))
after the auth migrations. Also apply
[`migrations/20261020000007_security_hardening.sql`](migrations/20261020000007_security_hardening.sql)
(already included in a full bootstrap run). It revokes `anon` and `PUBLIC`
execute on security-definer functions and re-asserts client table grants.
Signed-in users can still call `is_admin()` and `admin_list_signups()`;
non-admins are rejected inside `admin_list_signups()`. The `avatars` bucket
stays public.

Apply [`migrations/20261014000006_coach_focus.sql`](migrations/20261014000006_coach_focus.sql)
once in the Supabase SQL editor on the existing Technique Titan project (or
re-run [`bootstrap.sql`](bootstrap.sql)). Paste it yourself; the app and the API
do not apply this migration. RLS policy `coach_focus_own` requires `auth.uid() = user_id` for both
`using` and `with check`. There is no service-role insert policy. The API does
not write this table; the signed-in client upserts with the anon key. `burden`
jsonb may hold only the five numeric burden values (`wrist_height`,
`finger_curvature`, `thumb_position`, `wrist_lateral`, `hand_arch`). It is not a
place for images or analyze media. No new storage bucket.

### Free-tier storage rules (500 MB database quota)

| Cap | Value |
|---|---|
| `samples` jsonb per session | ≤ **32 KB** (API rejects larger drafts) |
| Sessions with timeline samples kept | **20** most recent per user (older `samples` cleared on save) |
| Saved sessions per user | **400** max (DB trigger; delete old rows to save more) |
| File storage | **`avatars` bucket only** (one square JPEG per user). Do not create buckets for analyze media |

Free projects also **pause after ~7 days of inactivity** and have **no automatic backups**.
Plan ops accordingly ([Supabase pricing](https://supabase.com/pricing)).

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
