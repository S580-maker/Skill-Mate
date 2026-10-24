# Skillmate setup

Skillmate runs locally as a Node.js/Express application and can be deployed to Vercel with serverless API functions. Supabase provides authentication, the database, and portfolio image storage. Both hosting options load configuration from server-side environment variables, synchronize authenticated sessions, and protect the administrator page server-side.

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

For deployment, set the Site URL to your production HTTPS domain and add the corresponding callback URL, for example:

```text
https://your-skillmate-domain.vercel.app
https://your-skillmate-domain.vercel.app/index.html
https://your-skillmate-domain.vercel.app/login.html
```

Configure email/password sign-in and decide whether email confirmation is required. If confirmation is enabled, use the email link before signing in.

## 5. Deploy to Vercel

1. Import the GitHub repository into Vercel and leave the framework preset as **Other**. The static HTML, CSS, and JavaScript are served directly; no frontend build command or output directory is required.
2. In **Project Settings → Environment Variables**, add the following variables for Production (and Preview if you want preview deployments to connect to Supabase):

   ```text
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   ```

   Use the Supabase **Project URL** and public **anon/publishable** key. Do not add a service-role key. The app does not need a `PORT` variable on Vercel.
3. Deploy the project. `vercel.json` routes the runtime Supabase configuration and session endpoints to Vercel Functions, and routes `/admin.html` through a server-side administrator-role check. The admin function includes the HTML file in its deployment bundle.
4. Copy the final production domain from Vercel and add it to Supabase **Authentication → URL Configuration** as the Site URL. Add the exact production callback URLs shown above using your domain.
5. Visit the Vercel URL, create/sign in to an account, and test the main marketplace and administrator route. Promote the intended admin account using the SQL in the next section.

The repository includes Vercel configuration and does not include `.env` or local dependency files in Git. Changing Vercel environment variables requires a new deployment to take effect. Local development remains available with `npm start`.

## 6. Promote the first administrator

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

Sign in using **Admin dashboard** from the student app or visit `login.html?next=admin`. The Express server locally and the Vercel function in production validate the Supabase session and check the profile role before returning `admin.html`; the browser also checks the role before loading dashboard data. Never assign that role from browser-side code.

## Security notes

- The browser uses only the public anon key, served from Express locally or the Vercel configuration function in production. Row-level security is the data-access boundary for browser queries.
- The administrator HTML route is not served to unauthenticated users or non-admin accounts. Express locally and the Vercel function validate the Supabase access token and read the account role using that user's token; no service-role key is needed.
- Database rules verify that bookings match an active provider service, reviews match a completed booking, and blocks apply across discovery, booking, and messaging. Leaving a group as its host cancels the group and its pending appointments.
- University suggestions are loaded from the public Hipolabs university directory, with a built-in Ghana list if the directory is unavailable. The school name can also be entered manually. The directory is for suggestions only and is not an accreditation or student-enrollment verification service.
- Deploy the Express server behind HTTPS. Set `NODE_ENV=production` so the session cookie is Secure; if a trusted reverse proxy terminates TLS, set `TRUST_PROXY=1`.
- Portfolio images are stored in a public bucket so marketplace profiles can display them. Do not upload identity documents, private photos, or other sensitive files there.
- Booking requests do not process payments. Verification requests require a human administrator to review and approve them.
- Test the schema and workflows in a disposable Supabase project before using real student data.
