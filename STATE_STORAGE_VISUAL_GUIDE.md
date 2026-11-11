# State Storage Mechanisms - Visual Guide

## Browser Storage Hierarchy

```
                    USER'S BROWSER
    ┌────────────────────────────────────────────┐
    │                                            │
    │  ┌──────────────────────────────────────┐  │
    │  │    localStorage (Persistent)         │  │
    │  ├──────────────────────────────────────┤  │
    │  │ • Per-origin (survives browser close)│  │
    │  │ • 5-10MB limit                       │  │
    │  │ • HTTP & HTTPS separate stores       │  │
    │  │ • Accessible from all tabs           │  │
    │  │ • Keys:                              │  │
    │  │   - skillmate-student-demo-v1        │  │
    │  │   - skillmate-theme                  │  │
    │  │   - skillmate-chat-messages:id       │  │
    │  │   - skillmate-dashboard-load-est-v1  │  │
    │  └──────────────────────────────────────┘  │
    │                                            │
    │  ┌──────────────────────────────────────┐  │
    │  │   sessionStorage (Tab-Specific)      │  │
    │  ├──────────────────────────────────────┤  │
    │  │ • Per-tab (clears on close)          │  │
    │  │ • 5-10MB limit (same as localStorage)│  │
    │  │ • Used for temporary flags only      │  │
    │  │ • Keys:                              │  │
    │  │   - skillmate-google-otp-pending     │  │
    │  │   - skillmate-google-otp-active      │  │
    │  └──────────────────────────────────────┘  │
    │                                            │
    │  ┌──────────────────────────────────────┐  │
    │  │  IndexedDB (Supabase Managed)        │  │
    │  ├──────────────────────────────────────┤  │
    │  │ • Per-origin (persistent)            │  │
    │  │ • Quota (GB range)                   │  │
    │  │ • Async API                          │  │
    │  │ • Structured data (JSON-like)        │  │
    │  │ • Used for:                          │  │
    │  │   - Auth tokens (access, refresh)    │  │
    │  │   - User metadata                    │  │
    │  │   - Realtime subscriptions (cached)  │  │
    │  └──────────────────────────────────────┘  │
    │                                            │
    │  ┌──────────────────────────────────────┐  │
    │  │   In-Memory (Runtime Only)           │  │
    │  ├──────────────────────────────────────┤  │
    │  │ • Lost on page refresh               │  │
    │  │ • Isolated per tab                   │  │
    │  │ • Unlimited size                     │  │
    │  │ • Variables:                         │  │
    │  │   - state (dashboard)                │  │
    │  │   - chatDrafts (Map)                 │  │
    │  │   - bookingDrafts (Map)              │  │
    │  │   - messageChannels (Map)            │  │
    │  │   - messagePresence (Map)            │  │
    │  │   - priceNegotiations (Map)          │  │
    │  │   - pendingOutgoingMessages (Map)    │  │
    │  └──────────────────────────────────────┘  │
    │                                            │
    └────────────────────────────────────────────┘
                          │
                          │ Network Requests
                          ↓
    ┌────────────────────────────────────────────┐
    │        HTTP Cookies (Secure)               │
    ├────────────────────────────────────────────┤
    │ • skillmate_session (httpOnly, Secure)    │
    │ • Path: /                                  │
    │ • Domain: localhost (dev) / domain (prod)  │
    │ • SameSite: lax                            │
    │ • Sent with every request                 │
    └────────────────────────────────────────────┘
                          │
                          │ Server Validates
                          ↓
            ┌──────────────────────────┐
            │   BACKEND (server.js)    │
            ├──────────────────────────┤
            │ • Supabase Database      │
            │ • Session validation     │
            │ • Rate limiting          │
            └──────────────────────────┘
```

---

## Data Persistence Timeline

### Timeline 1: User Opens Dashboard (First Visit)

```
Timeline: First Page Load
─────────────────────────────────────────

T0:  User navigates to /index.html
     └─ Browser loads HTML/CSS/JS

T1:  DOMContentLoaded fires
     ├─ theme.js runs
     │  └─ Checks localStorage.skillmate-theme
     │     └─ If found: set document.dataset.theme
     │     └─ Else: use system preference
     │
     └─ supabase-client.js runs
        └─ Initializes window.skillmateSupabase
           └─ Checks IndexedDB for session tokens
              └─ If found: restore session
              └─ Else: user is logged out

T2:  user.js runs (deferred script)
     ├─ Calls loadState()
     │  └─ Checks localStorage.skillmate-student-demo-v1
     │     └─ If found (demo): use cached state
     │     └─ Else: use defaultState
     │
     └─ If authenticated:
        └─ Calls refreshSupabaseState()
           └─ Fetches from Supabase:
              ├─ User profile from profiles table
              ├─ Bookings from bookings table
              ├─ Services from services table
              ├─ Messages (cached subset)
              └─ ...other data
           └─ Updates in-memory state
           └─ Calls renderAll()

T3:  UI Renders
     ├─ Dashboard with user data
     ├─ Active page set to #home
     └─ Real-time subscriptions established
        ├─ Message channel
        ├─ Presence markers
        └─ Booking updates
```

### Timeline 2: User Makes a Booking

```
Timeline: User Books a Service
────────────────────────────────────

T0:  User fills booking form and clicks "Book"
     └─ onclick handler fires

T1:  runAction() wrapper starts
     ├─ Show: "Saving your booking…"
     ├─ Disable: Submit button
     └─ In-memory state: add to state.bookings (optimistic)

T2:  Async action starts
     ├─ appSupabase.from('bookings').insert({...})
     │  └─ HTTP POST to Supabase REST API
     │     └─ Server validates request
     │        └─ Checks session cookie
     │           └─ /api/session verified it
     │
     └─ Backend processes:
        ├─ Insert into bookings table
        ├─ Trigger webhook (if configured)
        └─ Update booking_count in profiles

T3:  Response returns
     ├─ Success:
     │  ├─ Update: state.bookings with server ID
     │  ├─ Call: saveState() → localStorage
     │  │         (demo mode only)
     │  ├─ Call: renderAll() → UI updates
     │  ├─ Broadcast: Realtime event to other users
     │  │  └─ Other clients receive update in messageChannels
     │  ├─ Show: "Booking confirmed"
     │  └─ Redirect: to #bookings view
     │
     └─ Error:
        ├─ Show: "Booking failed: [error message]"
        ├─ Rollback: optimistic state update
        ├─ Keep: user input in form
        └─ Log: to console for debugging

T4:  Other Tabs See Update
     └─ Real-time broadcast received
        ├─ messageChannels subscription fires
        ├─ New client state: refreshSupabaseState()
        ├─ localStorage: NOT updated (Supabase is source)
        └─ UI: renderAll() updates dashboard
```

### Timeline 3: User Sends a Chat Message

```
Timeline: Send Message in Chat
────────────────────────────────────

T0:  User types in message input
     └─ No state change yet
        (Just DOM input value)

T1:  User hits Send button
     └─ onclick handler fires

T2:  Optimistic Update
     ├─ Create message object:
     │  ├─ id: temporary UUID
     │  ├─ sender_id: appUser.id
     │  ├─ body: user's text
     │  ├─ created_at: now
     │  └─ delivered_at: null
     │
     ├─ In-Memory Update:
     │  ├─ chat = state.messages.find(id)
     │  ├─ chat.messages.push(optimisticMessage)
     │  ├─ conversationMessageRefreshes.add(chatId)
     │  └─ renderConversations() → Show message immediately
     │
     └─ localStorage Cache:
        └─ cacheConversationMessages(state.messages)
           └─ localStorage.setItem('skillmate-chat-messages:userId', ...)

T3:  Backend Request Starts
     ├─ appSupabase.from('messages').insert({...})
     │  └─ HTTP POST to /rest/v1/messages
     │     └─ Server validates:
     │        ├─ Session token
     │        ├─ User permissions
     │        └─ Message content
     │
     └─ Storing in messages table:
        ├─ id: server-generated UUID
        ├─ conversation_id: existing ID
        ├─ sender_id: from token
        ├─ body: user's text
        ├─ created_at: server timestamp
        ├─ read_at: null
        ├─ delivered_at: null
        └─ reply_to: null

T4:  Response Returns
     ├─ Success:
     │  ├─ Replace: temp ID with server ID
     │  ├─ Update: message.created_at with server time
     │  ├─ Set: message.delivered_at = now
     │  ├─ Remove: from pendingOutgoingMessages Map
     │  ├─ Re-sort: conversation by created_at
     │  ├─ Save: updated cache to localStorage
     │  └─ Mark: sendingMessageIds.delete(tempId)
     │
     └─ Error:
        ├─ Log: to pendingOutgoingMessages (retry queue)
        ├─ Show: "Not sent" indicator
        ├─ Retry: on next connection or user action
        └─ Keep: in chatDrafts for editing

T5:  Realtime Broadcast
     └─ Database trigger fires
        ├─ Realtime subscription: `public.messages`
        ├─ All connected clients receive: {type: 'INSERT', ...message}
        ├─ Other client's renderConversations()
        └─ Their UI shows message from sender

T6:  Delivery Confirmation
     └─ After INSERT, trigger updates:
        └─ messages.delivered_at = now
           ├─ Realtime broadcast: {type: 'UPDATE', id, ...}
           └─ Chat UI updates: Remove "sending" indicator
              └─ Show: ✓ Delivered
```

---

## Storage Capacity Reference

```
┌──────────────────┬──────────┬──────────┬────────────────┐
│ Storage Type     │ Capacity │ Scope    │ Persistence    │
├──────────────────┼──────────┼──────────┼────────────────┤
│ localStorage     │ 5-10 MB  │ Origin   │ Until cleared  │
│ sessionStorage   │ 5-10 MB  │ Tab      │ Until tab close│
│ IndexedDB        │ 50 MB+   │ Origin   │ Until cleared  │
│ Cookies          │ 4 KB     │ Domain   │ Until expires  │
│ Cache API        │ Variable │ Origin   │ Until cleared  │
│ In-Memory (Maps) │ Unlimited│ Tab      │ Until refresh  │
└──────────────────┴──────────┴──────────┴────────────────┘

* Browser quota for IndexedDB may vary (50 MB - GB depending on browser & storage)
* Exceeding quota doesn't error; browser asks for permission or uses least-recently-used eviction
* HTTP/HTTPS are separate origins (separate storage)
* Private browsing mode: All storage cleared on window close
```

---

## Concurrent Access Scenarios

### Scenario 1: Same User, Multiple Tabs

```
TAB A (Dashboard)          TAB B (Admin)          TAB C (Landing)
   ↓                           ↓                        ↓
Load from storage         Load from storage      No state
   │                           │
   ├─ localStorage      ┌──────┴──────────┐
   ├─ IndexedDB    (shared storage)       ↓
   ├─ In-memory state   │                DOM only
   │                    ↓
   ├─ Real-time WS    Different state!
   └─ Session (shared)  └──────┬──────────┘
                                │
Problem:                     No sync ✗
Tab A updates booking
  ├─ Backend updates
  ├─ Tab A localStorage ✓
  ├─ Tab A in-memory ✓
  └─ Tab B: STALE DATA ✗
     (doesn't refresh)

Solution: Use Broadcast Channel API
  Tab A: window.broadcastChannel.postMessage({type: 'booking:update'})
  Tab B: listener.onmessage = (e) => refreshSupabaseState()
  Tab C: ignored (no state)
```

### Scenario 2: Session Expires Mid-Action

```
User Action (T0):
  ├─ Click "Book"
  └─ Supabase token is valid

Network Request (T1-T2):
  ├─ POST to /messages
  └─ Takes 2 seconds

Session Expires (T1.5):
  ├─ IndexedDB tokens invalidated
  ├─ HTTP-only cookie expires
  └─ Refresh token also expired (user gone 24+ hours)

Response Arrives (T2):
  ├─ 401 Unauthorized
  ├─ Error caught by supabase-client.js
  └─ window.clearExpiredSkillmateSession()
     ├─ Sign out locally
     ├─ Clear IndexedDB
     ├─ Clear localStorage (dashboard state)
     └─ Redirect: to login.html

Result:
  ├─ User sees "Sign in required"
  ├─ Any unsent messages: LOST (not in pendingOutgoingMessages)
  └─ User state: CLEARED
```

---

## Debug Storage Contents

```javascript
// Print all localStorage entries
console.table(
  Object.entries(localStorage)
    .filter(([k]) => k.includes('skillmate'))
    .reduce((obj, [k, v]) => ({
      ...obj,
      [k]: v.length > 100 ? v.slice(0, 100) + '...' : v
    }), {})
);

// Print all sessionStorage entries
console.table(Object.entries(sessionStorage));

// Print current auth state
console.log('Session:', {
  user: window.skillmateSession?.user,
  expiresAt: window.skillmateSession?.expires_at,
  expiresIn: window.skillmateSession?.expires_in
});

// Print dashboard state (if authenticated)
console.log('State:', {
  bookings: state?.bookings?.length,
  messages: state?.messages?.length,
  services: state?.services?.length,
  profile: state?.profile
});

// Print real-time channels
console.log('Real-time:', {
  channels: messageChannels.size,
  presence: messagePresence.size,
  subscriptions: Array.from(messageChannels.keys())
});

// Check IndexedDB contents (Supabase)
window.skillmateSupabase.auth.getSession()
  .then(({ data, error }) => console.log('Session:', data.session, 'Error:', error));
```

---

## Performance Impact

```
Storage Type          Read Speed    Write Speed    Impact
─────────────────────────────────────────────────────────
In-Memory            <1ms          <1ms           Fast ✓
localStorage         1-5ms         5-20ms         Moderate
sessionStorage       1-5ms         5-20ms         Moderate
IndexedDB            5-50ms        10-100ms       Slow
Supabase REST        100-500ms     200-1000ms     Very Slow
Supabase Realtime    <100ms        Real-time      Good

Optimization:
  1. Use in-memory for current page state
  2. Batch writes to localStorage (not on every keystroke)
  3. Use Supabase Realtime for live updates (not polling)
  4. Implement debouncing for draft saves
  5. Lazy-load data (fetch on demand, not all at once)
```
