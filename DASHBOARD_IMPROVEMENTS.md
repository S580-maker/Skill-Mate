# Dashboard fixes and deployment

The student, auth, and admin styles use a minimum 12px caption size, larger main text and form controls, visible keyboard focus, and a single marketplace column on small screens. Notifications now show full updates in a paginated dialog. Reading the panel does not change read state; each update has its own explicit action. The profile-completeness card uses vanilla JavaScript, removing both React CDN downloads.

## Apply and verify

1. Apply `supabase/migrations/20261027090000_batch_conversation_messages.sql` using your normal Supabase migration process. Fresh databases also receive the function through `supabase/schema.sql`. The function runs with caller permissions and message RLS; it restricts results to the caller's memberships.
2. Deploy the updated source to Vercel. `api/health.js` provides the missing serverless endpoint; Express uses the same handler. No additional rewrite is needed alongside the existing file-based API routes.
3. Check `/api/health`: configured and reachable Auth/database services return 200; unavailable configuration or services return 503. A successful sign-in page alone does not establish backend health.
4. With an authenticated test account, check notification pagination, individual read actions, keyboard focus, mobile layouts, and chat history. Live database authorization and layout checks are still required: this environment had no connected browser or database migration session.

## Measurement

Run `node --test tests/*.test.js` for behavioral regression tests. The mocked 40-conversation fixture uses two history RPCs instead of 40 history requests. Each batch contains at most 20 conversations and preserves the newest 30 messages per conversation. Single-chat refresh and older-history pagination retain their existing queries. Without the migration, a missing-function response switches to the existing individual-query path for that page session.

Dashboard refresh now executes the shared conversation-directory query once, and overlapping refresh callers share one in-flight load. Other dashboard queries remain in place because their data feeds existing views and counters.

For real-account timing, inspect browser Performance entries named `skillmate:dashboard-refresh` and `skillmate:message-load`, alongside the Network panel. Compare equivalent accounts and network conditions before and after deploying the migration. Request-count tests establish reduced round trips; they do not establish production latency gains.
