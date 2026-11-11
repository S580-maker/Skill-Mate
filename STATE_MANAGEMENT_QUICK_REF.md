# State Management Quick Reference

## TL;DR: Is State Managed Everywhere?

**No.** State management is **inconsistent and distributed**:

| Page | State Managed? | Pattern | Persistence |
|------|---|---------|-------------|
| Dashboard | ✓ Yes | Centralized object | localStorage + Supabase |
| Admin | Partial | DOM-based only | None |
| Auth | ✓ Yes | Form + Supabase session | sessionStorage + IndexedDB |
| Onboarding | ✓ Yes | Form + Supabase profile | Supabase only |
| Theme | ✓ Yes | Single variable | localStorage |
| Landing | ✗ No | None (static) | N/A |

---

## State by Feature

### Authentication
- **Where:** `supabase-client.js` + `auth.js`
- **State:** `window.skillmateSession`, `authMode`, OTP flags
- **Storage:** IndexedDB (Supabase), sessionStorage (OTP), HTTP cookies
- **Auto-sync:** Yes (Supabase handles refresh)

### Dashboard / User Data
- **Where:** `user.js`
- **State:** `state` object (50+ properties)
- **Storage:** localStorage (demo) or Supabase (production)
- **Auto-sync:** Manual via `refreshSupabaseState()`

### Chat / Messaging
- **Where:** `user.js` (lines 180-2000)
- **State:** In-memory Maps + Supabase Realtime
- **Storage:** localStorage cache + Supabase messages table
- **Auto-sync:** Real-time (WebSocket)

### Theme
- **Where:** `theme.js`
- **State:** `savedTheme` variable
- **Storage:** localStorage + DOM attribute
- **Auto-sync:** Manual toggle or system preference

### Admin Dashboard
- **Where:** `script.js`
- **State:** DOM element classes/attributes only
- **Storage:** None (transient)
- **Auto-sync:** N/A

### Service Form
- **Where:** `service-form.js` + shared `state` object
- **State:** Form inputs + `state.services` array
- **Storage:** localStorage via parent state
- **Auto-sync:** Manual save

---

## Storage Endpoints

### localStorage (Browser)
```javascript
localStorage.setItem('skillmate-student-demo-v1', JSON.stringify(state));
localStorage.setItem('skillmate-theme', 'dark');
localStorage.setItem('skillmate-chat-messages:user-123', JSON.stringify(messages));
localStorage.setItem('skillmate-dashboard-load-estimate-ms-v1', '5234');
```

### sessionStorage (Tab-specific)
```javascript
sessionStorage.setItem('skillmate-google-otp-pending', '1');
sessionStorage.setItem('skillmate-google-otp-active', '1');
```

### IndexedDB (Supabase SDK)
- Automatically managed by Supabase
- Stores: Session tokens, user metadata, cached queries
- Accessed via: `window.skillmateSupabase.auth`

### Supabase Tables
```sql
-- Core tables
profiles              -- User profile, skills, avatar
bookings              -- All bookings
messages              -- Chat history
conversations         -- Chat metadata
services              -- Provider service listings
price_negotiations    -- Negotiation history (if migration applied)
```

### HTTP Cookies
- `skillmate_session`: Server-side session cookie (secure, httpOnly)
- Set by: `/api/session` endpoint
- Used for: CSRF protection, server-side auth

---

## State Flow Examples

### Example 1: Making a Booking
```
User clicks "Book" button
       ↓
user.js event handler
       ↓
runAction(async () => {
  await appSupabase.from('bookings').insert(bookingData);
})
       ↓
State updates:
  - In-memory: state.bookings.push(newBooking)
  - Storage: localStorage.setItem(...) [demo only]
  - Backend: Supabase inserts to bookings table
       ↓
renderAll() called
       ↓
renderBookingList() updates UI
       ↓
Real-time subscription broadcasts to other users
       ↓
All connected clients see new booking
```

### Example 2: Changing Theme
```
User clicks theme toggle
       ↓
theme.js click handler
       ↓
document.documentElement.dataset.theme = 'dark'
localStorage.setItem('skillmate-theme', 'dark')
       ↓
CSS [data-theme="dark"] rules apply
       ↓
Meta tag <meta name="theme-color"> updates
       ↓
Button icon changes (☾ ↔ ☀)
```

### Example 3: Sending a Message
```
User types and sends message
       ↓
user.js message handler
       ↓
Optimistic update:
  - Add to chatDrafts map
  - Add to DOM immediately
  - Mark with "sending" state
       ↓
Supabase insert begins
       ↓
While sending:
  - Cache to localStorage periodically
  - Update presence markers
  - Retry if connection fails
       ↓
Backend confirms
       ↓
Update message ID
Remove from pendingOutgoingMessages
Mark as "delivered"
       ↓
Realtime subscription broadcasts
       ↓
Other tab's client receives update
```

### Example 4: Admin Viewing Bookings
```
Admin clicks "Bookings" nav
       ↓
script.js hash change handler
       ↓
showAdminView() called
       ↓
.admin-view elements toggled
  - Set hidden=true on others
  - Set hidden=false on #bookings view
       ↓
No state sync
No data fetch (assumes SSR or initial page load had data)
       ↓
Search input filters DOM
  - .querySelector('#global-search').value
  - Row.hidden = !matches
```

---

## Debug Checklist

- [ ] **Check localStorage:**
  ```js
  Object.entries(localStorage).filter(([k]) => k.includes('skillmate')).forEach(([k,v]) => console.log(k, JSON.parse(v)))
  ```

- [ ] **Check sessionStorage:**
  ```js
  Object.entries(sessionStorage).forEach(([k,v]) => console.log(k, v))
  ```

- [ ] **Check auth state:**
  ```js
  console.log(window.skillmateSession, window.skillmateSupabase?.auth.session())
  ```

- [ ] **Check dashboard state:**
  ```js
  console.log(state)  // If authenticated
  ```

- [ ] **Check theme:**
  ```js
  console.log(document.documentElement.dataset.theme)
  ```

- [ ] **Check in-memory maps:**
  ```js
  console.log({chatDrafts, bookingDrafts, messageChannels, messagePresence})
  ```

- [ ] **Verify Supabase connection:**
  ```js
  console.log(window.skillmateSupabase.channel('*').state)
  ```

- [ ] **Check for errors in console:**
  ```js
  console.error  // Any Supabase, localStorage, or fetch errors?
  ```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Data not persisting | No `saveState()` call after change | Add `saveState()` after state mutation |
| Theme not changing | localStorage cleared or permission denied | Use DOM attribute only, remove persistence |
| Messages not syncing | Realtime channel not subscribed | Check `messageChannels` Map, restart channel |
| Login not working | Session cookie missing | Check `/api/session` endpoint, clear IndexedDB |
| Admin not seeing data | DOM-based state, no data fetch | Add fetch call on page load |
| Slow performance | Too many in-memory Maps | Clear unused maps on navigation |
| OTP stuck | sessionStorage flag not cleared | Call `sessionStorage.clear()` after verify |

---

## Best Practices (As-Is)

1. **Always call `saveState()` after mutations** (dashboard only)
2. **Use `renderAll()` to sync UI** after async updates
3. **Wrap async actions in `runAction()`** for loading/error states
4. **Listen to `skillmate:auth-state-change`** events in other components
5. **Check `appSupabase` before accessing Supabase data** (might be null)
6. **Use real-time subscriptions for live updates**, not polling
7. **Clear drafts on successful send**, not before
8. **Validate on client AND server** for booking/payment operations

---

## Recommended Improvements (Priority)

1. **HIGH:** Add state versioning to localStorage (migration strategy)
2. **HIGH:** Implement global state bus for cross-page sync
3. **MEDIUM:** Move admin to use fetch + state object instead of DOM-only
4. **MEDIUM:** Add state cleanup on SPA page navigation
5. **LOW:** Consider Zustand for future refactoring
6. **LOW:** Add debug logging to all state mutations

---

## File Size Reference

| File | Lines | State Objects | Maps | Storage Keys |
|------|-------|---|---|---|
| `user.js` | 3100+ | 1 (state) | 15+ | 4 |
| `supabase-client.js` | 200+ | 2 (session, error) | 0 | 0 (IndexedDB only) |
| `auth.js` | 400+ | 6+ | 0 | 2 (sessionStorage) |
| `theme.js` | 100 | 1 | 0 | 1 |
| `script.js` | 150 | 0 (DOM-based) | 0 | 0 |
| `service-form.js` | 500+ | 1 | 0 | 1 |
| `onboarding.js` | 300+ | 1 | 1 | 0 |

---

## Further Reading

- **Analysis:** See `STATE_MANAGEMENT_ANALYSIS.md`
- **Architecture:** See `STATE_MANAGEMENT_DIAGRAMS.md`
- **Recommended Libraries:**
  - [Zustand](https://github.com/pmndrs/zustand) - Simple, lightweight state
  - [Redux](https://redux.js.org/) - Complex, well-documented
  - [Pinia](https://pinia.vuejs.org/) - If moving to Vue
  - [Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel) - Tab sync
