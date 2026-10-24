# Skillmate setup

Skillmate runs as a Node.js/Express application. Supabase provides authentication, the database, and portfolio image storage; Express serves the app, loads configuration from `.env`, synchronizes authenticated sessions, and protects the administrator page server-side.

## 1. Create a Supabase project

Create a project, then open **Project Settings → API** and copy:

- The project URL
- The public `anon` key (sometimes labelled the publishable key)

Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The app serves the public anon/publishable key to the browser at runtime because the Supabase browser client needs it. This key is not a secret; Supabase row-level security is the data-access boundary. Never put a `service_role` key, database password, or other server secret in `.env` unless a trusted server feature explicitly needs it.

## 2. Create the database

Open the Supabase **SQL Editor**, paste the full contents of `supabase/schema.sql`, and run it once. It creates the marketplace tables, indexes, row-level security rules, database functions, notification triggers, and the public portfolio image bucket.

The schema file is an initial setup, not a repeatable migration. Do not run it a second time on the same project; use a new migration for later schema changes.

New accounts must provide a university and student ID number. The ID number is stored in the private `student_identifiers` table and is readable only by its owner and administrators. This collects and stores the number; it does not check that the number is valid or confirm current enrollment. Do not describe an account as verified based on this field alone.

Users may optionally save a hostel or campus location in **Edit profile**. It is private by default and is shared with the other participant only while a booking is confirmed. The app currently collects place names, not coordinates, so it cannot calculate distance. On an existing project, apply `supabase/migrations/20261024_user_locations.sql` once in the SQL Editor; on a new project, the main schema already includes it.

## 3. Install and run Skillmate

Install dependencies and start the Express server:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env and add your Supabase Project URL and public anon/publishable key.
npm install
npm start
```

Open `http://localhost:3000/login.html`. For development with automatic Node restarts, use `npm run dev`.

The server requires both Supabase values to be present in `.env`; it will not fall back to browser-local demo data. Check `http://localhost:3000/api/health` for server readiness.

## 4. Configure authentication

In **Authentication → URL Configuration**, set the local development URL to:

```text
http://localhost:3000
```

Add the corresponding callback URL, for example:

```text
http://localhost:3000/index.html
```

For deployment, replace these with the real HTTPS domain and callback URL. Configure email/password sign-in and decide whether email confirmation is required. If confirmation is enabled, use the email link before signing in.

## 5. Promote the first administrator

Create the intended administrator account through the app first. Then run this statement in the trusted Supabase SQL Editor, replacing the address:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id
  from auth.users
  where email = 'admin@your-university.edu'
);
```

Sign in using **Admin dashboard** from the student app or visit `login.html?next=admin`. Express validates the Supabase session and checks the profile role before returning `admin.html`; the browser also checks the role before loading dashboard data. Never assign that role from browser-side code.

## Security notes

- The browser uses only the public anon key, served from the Express environment configuration. Row-level security is the data-access boundary for browser queries.
- The administrator HTML route is not served to unauthenticated users or non-admin accounts. The server validates the Supabase access token and reads the account role using that user's token; no service-role key is needed.
- Database rules verify that bookings match an active provider service, reviews match a completed booking, and blocks apply across discovery, booking, and messaging. Leaving a group as its host cancels the group and its pending appointments.
- University suggestions are loaded from the public Hipolabs university directory, with a built-in Ghana list if the directory is unavailable. The school name can also be entered manually. The directory is for suggestions only and is not an accreditation or student-enrollment verification service.
- Deploy the Express server behind HTTPS. Set `NODE_ENV=production` so the session cookie is Secure; if a trusted reverse proxy terminates TLS, set `TRUST_PROXY=1`.
- Portfolio images are stored in a public bucket so marketplace profiles can display them. Do not upload identity documents, private photos, or other sensitive files there.
- Booking requests do not process payments. Verification requests require a human administrator to review and approve them.
- Test the schema and workflows in a disposable Supabase project before using real student data.
