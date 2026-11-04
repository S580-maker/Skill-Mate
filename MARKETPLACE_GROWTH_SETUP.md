# Marketplace improvements

The app now includes optional reviews, service filters, provider hours and dates off,
repeat bookings, booking progress, campus requests, private responses, moderation,
and booking reminders. Providers can see counts for requests, confirmations,
completed work, and repeat customers in My services.

## Enable for real accounts

1. In the Supabase SQL editor for this app, run
   `supabase/migrations/20261106100000_marketplace_growth.sql` after the earlier migrations.
   This removes the old review restriction and adds the new tables and functions.
   It does not delete existing bookings or reviews. Do not rerun the initial schema
   against an existing database.
2. Restart the local server, or deploy the updated app. For scheduled reminders,
   add a random server-only `CRON_SECRET` to the deployment environment. Keep the
   existing Supabase service-role key on the server. Vercel calls the protected
   reminder endpoint daily at 08:00 UTC using the configured secret.
3. If browser push is already enabled, redeploy the updated
   `supabase/functions/push-notification-webhook` relay. It now accepts booking
   reminders and request responses. Notifications still appear in the app when
   browser push is disabled.

The code does not apply SQL to the live database automatically. Until the migration
is installed, new database features show an unavailable message. Existing booking
and messaging features remain accessible. The database review restriction is only
removed when the migration is applied.

## Where to find the features

- **Discover:** price, delivery, verification, published-hours filters, and sorting.
  Published hours means the provider has a schedule; it does not promise availability today.
  The Post what you need button opens the request form directly. After publishing,
  My requests opens and shows the saved post. Failed saves keep the form details
  so the student can retry.
- **My services → Your availability:** choose a time zone, appointment length,
  working days, hours, and dates off. Students choose available slots before sending
  a booking request. Providers still confirm requests. Two pending requests can
  ask for the same time; only one individual appointment can be confirmed.
- **My bookings:** dismiss optional review reminders, use Book again, and see the
  next step. Providers can Start work, then Mark complete. Repeat bookings use the
  current listing and price and require a new date; old price agreements are not reused.
- **Campus requests:** publish a task with an optional budget and a deadline within
  30 days. Requests expire at the end of the selected date in Ghana time. Students
  on the same campus can reply once. Only the requester and responder see an offer.
  The requester can open a private chat or close the request.
- **Admin → Safety reports:** campus request reports arrive in the existing queue.
  Use Remove request to remove a reported request, then resolve or dismiss the report.

Hours are provider-wide. Existing group booking scheduling stays in its existing
request/confirmation flow. Existing confirmed group bookings block individual slots.
Pending requests are not reservations. Existing confirmed appointments retain their
agreed date and length when a provider changes their hours.

## Reminders

The daily job creates one reminder for an unanswered request older than 12 hours
and one reminder per recipient for an unstarted confirmed appointment within 24 hours.
Running the job repeatedly does not duplicate the same reminder. Notification
preferences are respected. The app also shows booking reminders while it is open.
Daily scheduling can be changed in `vercel.json`; an external scheduler can call
`GET` or `POST /api/booking-reminders` with `Authorization: Bearer <CRON_SECRET>`.

## Verification

```text
npm test
npm run test:db
npm run test:ui
```

`test:db` uses an isolated PostgreSQL engine in memory, with simulated Supabase
authentication and storage schemas. It checks the actual migration SQL, permissions,
slot conflicts, review removal, campus boundaries, private responses, moderation,
and reminder deduplication. It never connects to the live database.

Browser checks cover mobile/desktop layouts and the new flows with local fixtures.
For a live check after deployment, use two students from one campus and one student
from another campus: publish hours, book and confirm a slot, post a request, reply,
confirm response privacy, report the request, and remove it from an admin account.

For a small user trial, ask five students and five providers to complete a booking.
Record where they hesitate, requests sent, requests confirmed, work completed,
and whether they return for a second booking. Provider counts in My services are
based on actual booking records; no external analytics service was added.
