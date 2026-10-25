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

On existing projects, apply `supabase/migrations/20261025_public_provider_directory.sql` once in the SQL Editor to show every active service—including administrator-owned listings—to signed-in Skillmate users. The directory remains unavailable to anonymous visitors and continues to exclude listings hidden by a block. New projects include this directory definition in `supabase/schema.sql`.

On existing projects, apply `supabase/migrations/20261025_whatsapp_style_messaging.sql` once in the SQL Editor before using the redesigned Messages page. It adds delivery and reply metadata, restricts message access and changes to conversation participants, permits recipients to update read/delivery timestamps, allows senders to delete their own messages, and adds messages to Supabase Realtime when that publication is available. The app uses `conversation_id` and `conversation_members` for recipient membership; it does not need a separate `receiver_id` column. New projects include the same fields, policies, and realtime publication setup in `supabase/schema.sql`.

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

   Use the Supabase **Project URL** and public **anon/publishable** key. Do not add a service-role key. The app does not need a `PORT` variable on Vercel.
3. Deploy the project. `vercel.json` routes the runtime Supabase configuration and session endpoints to Vercel Functions, and routes `/admin.html` through a server-side administrator-role check. The admin function includes the HTML file in its deployment bundle.
4. Copy the final production domain from Vercel and add it to Supabase **Authentication → URL Configuration** as the Site URL. Add the exact production callback URLs shown above using your domain.
5. Visit the Vercel URL, create/sign in to an account, and test the main marketplace and administrator route. Promote the intended admin account using the SQL in the next section.

The repository includes Vercel configuration and does not include `.env` or local dependency files in Git. Changing Vercel environment variables requires a new deployment to take effect. Local development remains available with `npm start`.

### Configure Google and Apple sign-in

The login page uses Supabase Auth's browser OAuth redirect flow. The existing Google button is `#google-signin`; Apple is `#apple-signin`. OAuth provider credentials stay in Supabase and are never added to `.env` or browser code.

**Google (manual console setup)**

1. In Google Cloud Console, create or select a project and configure the Google Auth consent screen.
2. Create an OAuth client ID with application type **Web application**.
3. In **Authorized JavaScript origins**, add `http://localhost:3000` and your production origin, for example `https://skillmate-six.vercel.app`.
4. In **Authorized redirect URIs**, add the exact callback URL shown on the Supabase Google provider setup page. For the standard Supabase domain it is `https://<project-ref>.supabase.co/auth/v1/callback`. This is Supabase's callback, not the Skillmate URL.
5. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and paste the Google OAuth client ID and client secret. Skillmate asks Google to show an account chooser on each Google sign-in attempt.

**Apple (manual Apple Developer and Supabase setup; requires Apple Developer Program membership)**

1. In Apple Developer **Certificates, Identifiers & Profiles → Identifiers**, create a primary **App ID** for your app and enable the **Sign in with Apple** capability.
2. Create a **Services ID** for web sign-in. Enable **Sign in with Apple**, associate it with the primary App ID, and configure its web domain and return URL. In **Domains and Subdomains**, enter your Supabase project host (`<project-ref>.supabase.co`, without `https://` or a path). In **Return URLs**, enter the exact callback shown in Supabase's Apple provider settings (standard format: `https://<project-ref>.supabase.co/auth/v1/callback`).
3. In Apple Developer **Keys**, create a key with **Sign in with Apple** enabled and associate it with the primary App ID. Download its `.p8` private key once and store it securely.
4. In Supabase **Authentication → Sign In / Providers → Apple**, enable Apple. Enter the Services ID as the provider client ID and configure the Apple client-secret JWT. Generate/sign that JWT using the Apple Team ID, Key ID, and `.p8` private key, following the fields/instructions shown in the Supabase provider form.
5. In Supabase **Authentication → URL Configuration → Redirect URLs**, allow `http://localhost:3000/index.html`, `http://localhost:3000/admin.html`, `https://skillmate-six.vercel.app/index.html`, and `https://skillmate-six.vercel.app/admin.html`. Replace the example production host with your actual Vercel domain. Set the Site URL to that production origin.

Apple's web OAuth flow does **not** return a user's full name. Apple exposes the name only on the first authorization through its native/Sign in with Apple JS flows; this web redirect implementation cannot capture that one-time value. Skillmate therefore asks new social-login users to enter or confirm their name in the existing onboarding form and saves it to `profiles.full_name`. Apple's private-relay addresses are kept as Supabase returns them; the app does not validate or rewrite them as university emails.

For web-based Apple OAuth, schedule a reminder to rotate the Apple client-secret JWT every six months using the same `.p8` key, Team ID, Key ID, and Services ID. Keep the `.p8` key private.

This is a browser web app, so Google and Apple use full-page redirects; no iOS/Android URL schemes or deep links are needed. Supabase returns users to the allowed `redirectTo` page after OAuth. If the user starts from **Admin dashboard**, the app returns to the protected admin route; admin role checks still apply.

The app reads its Supabase project URL and public anon/publishable key from server environment configuration. The local `.env` format is:

```dotenv
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Set the same two values in Vercel **Project Settings → Environment Variables** for the environments you deploy. Never use a service-role key here. For exact provider behavior, see the Supabase guides for [Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) and [Apple](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple).

**Session helpers available to existing UI code**

The Supabase client restores its persisted session on page load. `window.skillmateSession` exposes the current session, and the `skillmate:auth-state-change` event reports changes. Call `await window.skillmateRestoreSession()` to read the restored session, or `await window.skillmateSignOut()` to sign out and clear the secure server cookie.

**Common OAuth errors**

- `redirect_uri_mismatch`: the Google/Apple console callback must exactly match Supabase's callback URL. Separately, add the Skillmate return page (`localhost` or your Vercel domain) to Supabase's redirect allow list.
- `invalid_client`: check that the provider is enabled and its client ID/secret belongs to the same Google/Apple project and Supabase provider configuration.
- Google selects the wrong account: sign out of Skillmate, then choose the intended Google account in the Google account chooser. The email typed into Skillmate's email/password field does not choose the Google identity.
- Apple name is blank: expected for web OAuth. Apple does not return a full name through this redirect flow; ask the user to enter it in onboarding. A returning Apple user will not resend first-authorization details.
- Apple relay email: `privaterelay.appleid.com` addresses are valid Apple relay addresses and are stored as returned; do not reject or rewrite them.

On existing projects, apply `supabase/migrations/20261025_profile_onboarding.sql` and then `supabase/migrations/20261025120000_social_onboarding.sql` once each in the SQL Editor, in that order. The first adds the profile `skills` and `onboarding_completed` columns and updates the new-user trigger for OAuth accounts. The second provides a secure function that saves the student ID only in the private `student_identifiers` table. Existing profiles are marked as already onboarded. New Google and Apple accounts must enter their name, university or campus, and student ID number before continuing; profile photos and skills are optional. Other accounts can skip the optional onboarding step. New projects include the function in `supabase/schema.sql`.

The Terms and Privacy pages are marked **Draft, pending review** and contain placeholders. Replace and approve their text before publishing them as final policies.

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
