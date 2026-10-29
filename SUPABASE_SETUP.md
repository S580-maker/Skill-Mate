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

For existing projects, apply `supabase/migrations/20261026140000_profile_settings_and_support.sql` once in the SQL Editor to add profile phone/notification preferences, support tickets and their row-level security, and the profile-avatar and private support-screenshot buckets. New projects include these objects in `supabase/schema.sql`. The migration can also be applied after the initial schema if needed.

Configure `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** environment variable to enable account closure. It is optional for other app features and must never be added to browser configuration, client-side environment variables, or public source control. Set it in the local server `.env` or the hosting provider's server environment (including Vercel Functions if deployed there). Account closure anonymizes the profile and authored content, deactivates listings, removes account storage files, replaces the account email, and permanently bans sign-in.

Support contact placeholders in the Help & Support page (`support@your-domain.example` and the WhatsApp number) should be replaced with your real support contact details before launch.

New accounts must provide a university and student ID number. The ID number is stored in the private `student_identifiers` table and is readable only by its owner and administrators. This collects and stores the number; it does not check that the number is valid or confirm current enrollment. Do not describe an account as verified based on this field alone.

Users may optionally save a hostel or campus location in **Edit profile**. It is private by default and is shared with the other participant only while a booking is confirmed. The app currently collects place names, not coordinates, so it cannot calculate distance. On an existing project, apply `supabase/migrations/20261024_user_locations.sql` once in the SQL Editor; on a new project, the main schema already includes it.

On existing projects, apply `supabase/migrations/20261025_public_provider_directory.sql` once in the SQL Editor to show every active service—including administrator-owned listings—to signed-in Skillmate users. The directory remains unavailable to anonymous visitors and continues to exclude listings hidden by a block. New projects include this directory definition in `supabase/schema.sql`.

On existing projects, apply `supabase/migrations/20261025_whatsapp_style_messaging.sql` once in the SQL Editor before using the redesigned Messages page. It adds delivery and reply metadata, restricts message access and changes to conversation participants, permits recipients to update read/delivery timestamps, allows senders to delete their own messages, and adds messages to Supabase Realtime when that publication is available. The app uses `conversation_id` and `conversation_members` for recipient membership; it does not need a separate `receiver_id` column. New projects include the same fields, policies, and realtime publication setup in `supabase/schema.sql`.

For existing projects, apply `supabase/migrations/20261027090000_batch_conversation_messages.sql` after the messaging migration to enable batched message loading. Then apply `supabase/migrations/20261027120000_service_listing_details.sql` after the public provider directory migration to enable service delivery options, extended pricing, and cover images. These migrations are already included in the initial `supabase/schema.sql` for new projects. Without them, the app falls back to individual message requests and basic service details.

If an existing project reports `infinite recursion detected in policy for relation "messages"` after applying the messaging migration, apply `supabase/migrations/20261026_fix_message_rls_recursion.sql` once. It moves conversation membership, block, and reply checks into narrowly scoped security-definer functions so message policies do not recursively query the protected messages table.

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

Add this password-recovery redirect URL as well:

```text
http://localhost:3000/reset.html
```

For deployment, set the Site URL to your production HTTPS domain and add the corresponding callback URL, for example:

```text
https://your-skillmate-domain.vercel.app
https://your-skillmate-domain.vercel.app/index.html
https://your-skillmate-domain.vercel.app/login.html
https://your-skillmate-domain.vercel.app/reset.html
```

Configure email/password sign-in and decide whether email confirmation is required. If confirmation is enabled, use the email link before signing in.

## 5. Deploy to Vercel

1. Import the GitHub repository into Vercel. `vercel.json` explicitly sets the framework preset to **Other**, so Vercel uses the static assets and root `api/` functions rather than treating the local Express development server as the deployed backend. The static HTML, CSS, and JavaScript are served directly; no frontend build command or output directory is required.
2. In **Project Settings → Environment Variables**, add the following variables for Production (and Preview if you want preview deployments to connect to Supabase):

   ```text
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   ```

   Use the Supabase **Project URL** and public **anon/publishable** key. If you want account closure enabled on Vercel, also add `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** environment variable; never use it in client-side variables or frontend code. The app does not need a `PORT` variable on Vercel.
3. Deploy the project. `vercel.json` routes the runtime Supabase configuration and session endpoints to Vercel Functions, and routes `/admin.html` through a server-side administrator-role check. The admin function includes the HTML file in its deployment bundle.
4. Copy the final production domain from Vercel and add it to Supabase **Authentication → URL Configuration** as the Site URL. Add the exact production callback URLs shown above using your domain.
5. Visit the Vercel URL, create/sign in to an account, and test the main marketplace and administrator route. Promote the intended admin account using the SQL in the next section.

The repository includes Vercel configuration and does not include `.env` or local dependency files in Git. Changing Vercel environment variables requires a new deployment to take effect. Local development remains available with `npm start`.

### Configure Google sign-in

The app supports email/password and Google. Configure Google in Supabase; provider secrets never belong in browser code.

**Google (manual console setup)**

1. In Google Cloud Console, create or select a project and configure the Google Auth consent screen.
2. Create an OAuth client ID with application type **Web application**.
3. In **Authorized JavaScript origins**, add `http://localhost:3000` and your production origin, for example `https://skillmate-six.vercel.app`.
4. In **Authorized redirect URIs**, add the exact callback URL shown on the Supabase Google provider setup page. For the standard Supabase domain it is `https://<project-ref>.supabase.co/auth/v1/callback`. This is Supabase's callback, not the Skillmate URL.
5. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and paste the Google OAuth client ID and client secret. Skillmate asks Google to show an account chooser on each Google sign-in attempt.

In Supabase Authentication > URL Configuration, allow the exact local and production callback URLs for index.html and admin.html. The protected admin route still checks the account role after sign-in.

New Google users confirm their name and campus during onboarding. A photo, skills and student ID are optional; student IDs remain private and do not automatically verify an account. Email sign-up collects name and campus once and skips duplicate onboarding.

For existing projects, apply the profile onboarding and identity migrations in the order listed in the migrations directory. Run supabase/apply_settings_support.sql to repair settings, support, storage and atomic student-profile saving together. New projects use supabase/schema.sql.

The Terms and Privacy pages are drafts that require your review before publishing them as final policies.

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

## Profile settings and support setup

Existing projects: run the entire file `supabase/apply_settings_support.sql` in the trusted Supabase SQL Editor. It applies both settings/support migrations in one transaction, adds the profile save RPC, synchronizes campus identity and resets verification on campus changes, and permits cleanup of unused support screenshots. It is safe to rerun. New projects already include these definitions in `supabase/schema.sql`.

Set `SUPABASE_SERVICE_ROLE_KEY` on the local server and deployment to enable account closure. Keep it server-only. The app publishes only whether closure is configured. Without the key, closure is disabled before any account changes. Closure disables sign-in before anonymization and storage cleanup; if cleanup fails, an administrator must finish it for the user ID recorded in server logs. Never restore sign-in to a partly closed account.

Support contacts default to ezekielnyarku1@gmail.com and steveobodai@gmail.com. Override with comma-separated `SUPPORT_EMAIL`. Set `SUPPORT_WHATSAPP` to international phone digits to show WhatsApp; otherwise it stays hidden. Restart the local server or redeploy after environment changes.

The admin dashboard's Support tickets section lists the 50 oldest active tickets, supports Review/Resolve/Dismiss, and generates five-minute private screenshot links. Resolved and dismissed tickets remain in the database. Ticket submission stores a request; it does not send email. Direct email links open the user's mail app.
