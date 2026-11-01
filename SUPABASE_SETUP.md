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

For existing projects, apply `supabase/migrations/20261101090000_student_id_verification.sql` once to enable student ID photo verification. New projects include it in `supabase/schema.sql`. The migration closes any older email-only pending requests so students can resubmit an ID photo. ID photos are stored in a private Supabase Storage bucket, not in database rows; only the photo path and request metadata are stored in the database. Students can upload JPG, PNG, or WebP files up to 5 MB. Administrators can view photos through short-lived signed links, and the app deletes the photo after the request is approved or rejected. Storage usage still applies while a photo is awaiting review.

For existing projects, apply `supabase/migrations/20261102090000_otp_session_verification.sql` after the email OTP and student ID verification migrations, immediately before deploying the matching application code. New projects include the same OTP session protections in `supabase/schema.sql`. During rollout, existing sessions without proof will be asked to complete one email code after the app update; once verified, a persistent session remains usable without another code until that Supabase session ends. The migration enforces the check through database row-level security, Storage policies, views, and server routes. It skips optional tables that are not installed; if it reports skipping `support_tickets`, apply the profile settings/support migration above, then rerun the OTP migration to protect that table.

Configure `SUPABASE_SERVICE_ROLE_KEY` as a **server-only** environment variable for email OTP challenge/session storage and account closure. It must never be added to browser configuration, client-side environment variables, or public source control. Set it in the local server `.env` or the hosting provider's server environment (including Vercel Functions if deployed there). Account closure anonymizes the profile and authored content, deactivates listings, removes account storage files, replaces the account email, and permanently bans sign-in.

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
http://localhost:3000/login.html
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

### Email two-factor sign-in and signup

Email/password sign-in and password recovery require a six-digit email code. Account creation also starts with a six-digit code; the server creates the confirmed Supabase account only after the code is accepted. Recovery codes must be accepted before the server allows a new password to be set. Apply `supabase/migrations/20261029150000_email_login_2fa.sql` once in the Supabase SQL Editor. The migration creates a private, short-lived challenge table and a one-time verification function; do not grant browser roles access to that table.

Set these server-only environment variables locally and on Vercel:

- `SUPABASE_SERVICE_ROLE_KEY` for private challenge storage. It must never be exposed to browser code.
- `AUTH_OTP_SECRET` with at least 32 random characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; keep the same value across deployments so pending codes remain verifiable.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` for your mail provider. Use the provider's submission host and a verified sender address. `SMTP_SECURE=true` is normally used with port 465; port 587 normally uses `false`.

Codes expire after 10 minutes, can be resent after 30 seconds up to five times per challenge, and allow at most five guesses. Google sign-in also requires this email code after Google authenticates the account; the Skillmate app session is not established until the code is verified.

## 5. Deploy to Vercel

1. Import the GitHub repository into Vercel. `vercel.json` explicitly sets the framework preset to **Other**, so Vercel uses the static assets and root `api/` functions rather than treating the local Express development server as the deployed backend. The API routes share `api/[...path].js` (with the protected admin page as a separate function), keeping the project under Vercel Hobby's serverless-function limit. The static HTML, CSS, and JavaScript are served directly; no frontend build command or output directory is required.
2. In **Project Settings → Environment Variables**, add the following variables for Production (and Preview if you want preview deployments to connect to Supabase):

   ```text
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
   AUTH_OTP_SECRET=your-generated-random-secret
   SMTP_HOST=your-smtp-host
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-smtp-username
   SMTP_PASS=your-smtp-password
   SMTP_FROM=Skillmate <no-reply@your-domain.example>
   VAPID_PUBLIC_KEY=your-vapid-public-key
   VAPID_PRIVATE_KEY=your-vapid-private-key
   VAPID_SUBJECT=mailto:admin@your-domain.example
   PUSH_DISPATCH_SECRET=your-random-webhook-secret
   ```

  Use the Supabase **Project URL** and public **anon/publishable** key. Keep the service role key, OTP secret, and SMTP credentials server-only; never use them in client-side variables or frontend code. The app does not need a `PORT` variable on Vercel.
3. Deploy the project. `vercel.json` routes the runtime Supabase configuration and session endpoints to Vercel Functions, and routes `/admin.html` through a server-side administrator-role check. The admin function includes the HTML file in its deployment bundle.
4. Copy the final production domain from Vercel and add it to Supabase **Authentication → URL Configuration** as the Site URL. Add the exact production callback URLs shown above using your domain.
5. Visit the Vercel URL, create/sign in to an account, and test the main marketplace and administrator route. Promote the intended admin account using the SQL in the next section.

The repository includes Vercel configuration and does not include `.env` or local dependency files in Git. Changing Vercel environment variables requires a new deployment to take effect. Local development remains available with `npm start`.

### Browser notifications when users are away

Browser push alerts work on supported browsers over HTTPS (localhost is allowed for development). They are opt-in per device: users enable them from **Profile & Settings → Notifications**, and can disable each device there. Booking and message push alerts still respect each user's **Booking updates** and **Messages** preferences. Push message bodies are generic so message contents are not exposed on a locked screen.

1. Apply `supabase/migrations/20261102100000_web_push_notifications.sql` in the Supabase SQL Editor. This creates a private subscription table; browser roles have no access to it.
2. Generate a VAPID key pair with `npx web-push generate-vapid-keys`. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` on the Skillmate server. `VAPID_SUBJECT` must be a contact URI such as `mailto:admin@your-domain.edu` or an HTTPS URL. Only the public key is sent to browsers.
3. Generate a new random secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Do not reuse the value previously shared in chat; treat it as exposed. Set the new value as `PUSH_DISPATCH_SECRET` in `.env` locally, in Vercel, and in Supabase Edge Function Secrets. Redeploy Vercel after updating it. Keep this secret server-only.
4. Install the Supabase CLI if needed. On Windows with Scoop, open PowerShell and run:

   ```powershell
   scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
   scoop install supabase
   ```

   Then, from the Skillmate repository root, link the project and deploy the Edge Function:

   ```powershell
   supabase login
   supabase link --project-ref your-project-ref
   supabase functions deploy push-notification-webhook
   ```

   The project's `supabase/config.toml` disables the gateway's JWT check because database webhooks use a Supabase API secret key instead of a user JWT. The Edge Function's `withSupabase({ auth: "secret" })` check still validates the key.
5. In Supabase Dashboard, go to **Edge Functions → Secrets** and add these secrets:

   | Name | Value |
   |---|---|
   | `PUSH_DISPATCH_SECRET` | Exactly the same new value set on the Skillmate server/Vercel |
   | `PUSH_DISPATCH_URL` | `https://your-domain/api/push-dispatch` |

   Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` as Vercel/server environment variables too. Do not put VAPID private keys or the dispatch secret in browser code.
6. In Supabase, open **Database → Webhooks → Create a new webhook** and choose **Supabase Edge Functions**. Select `push-notification-webhook`, choose table `public.notifications`, and select **INSERT only**. Under **HTTP Headers**, choose **Add secret key** and select the project's **default** secret key. This authenticates Supabase's request to the Edge Function; the function then uses the separate `PUSH_DISPATCH_SECRET` to authenticate with the Skillmate server. Save the webhook. The function accepts only valid booking/message notification inserts.
7. Sign in on a supported browser, open **Profile & Settings → Notifications**, and choose **Enable on this device**. Allow notifications in the browser prompt. Test by creating a booking request or sending a message from another account. Repeat on each device/browser that should receive alerts.

The app stores only the push endpoint and encryption keys needed to deliver notifications. Account closure explicitly removes the user's subscriptions; stale browser subscriptions are also removed when a push provider reports them expired. The Edge Function checks its webhook secret and forwards only valid booking/message notification inserts; the server checks a separate relay secret before delivery.

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
- Student ID photos use a separate private bucket; only administrators can read them. Review a request promptly so its photo can be deleted and storage usage minimized.
- Booking requests do not process payments. Verification requests require a human administrator to review and approve them.
- Test the schema and workflows in a disposable Supabase project before using real student data.

## Profile settings and support setup

Existing projects: run the entire file `supabase/apply_settings_support.sql` in the trusted Supabase SQL Editor. It applies both settings/support migrations in one transaction, adds the profile save RPC, synchronizes campus identity and resets verification on campus changes, and permits cleanup of unused support screenshots. It is safe to rerun. New projects already include these definitions in `supabase/schema.sql`.

Set `SUPABASE_SERVICE_ROLE_KEY` on the local server and deployment to enable account closure. Keep it server-only. The app publishes only whether closure is configured. Without the key, closure is disabled before any account changes. Closure disables sign-in before anonymization and storage cleanup; if cleanup fails, an administrator must finish it for the user ID recorded in server logs. Never restore sign-in to a partly closed account.

Support contacts default to ezekielnyarku1@gmail.com and steveobodai@gmail.com. Override with comma-separated `SUPPORT_EMAIL`. Set `SUPPORT_WHATSAPP` to international phone digits to show WhatsApp; otherwise it stays hidden. Restart the local server or redeploy after environment changes.

The admin dashboard's Support tickets section lists the 50 oldest active tickets, supports Review/Resolve/Dismiss, and generates five-minute private screenshot links. Resolved and dismissed tickets remain in the database. Ticket submission stores a request; it does not send email. Direct email links open the user's mail app.
