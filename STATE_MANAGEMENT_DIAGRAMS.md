# State Management Architecture Diagram

## Current State Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SKILL FLEX STATE LAYERS                  │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: USER INTERACTION
├─ Landing Page (landing.html)
│  └─ Transient UI only (menu, FAQ toggles)
│     └─ NO persistence
│
├─ Auth Pages (login.html, onboarding.html)
│  ├─ Form inputs (email, password, name)
│  ├─ sessionStorage (OTP flags)
│  └─ Supabase Auth (session in IndexedDB)
│
├─ Student Dashboard (index.html)
│  ├─ Centralized state object
│  ├─ localStorage (demo mode)
│  ├─ Supabase (production mode)
│  └─ In-memory Maps (chat, drafts, presence)
│
└─ Admin Console (admin.html)
   ├─ DOM-based state (classes, attributes)
   └─ NO JavaScript state object

LAYER 2: STORAGE MECHANISMS
├─ localStorage ("skillflex-*" keys)
│  ├─ skillflex-student-demo-v1 (dashboard state)
│  ├─ skillflex-theme (light/dark)
│  ├─ skillflex-chat-messages:${userId} (message cache)
│  └─ skillflex-dashboard-load-estimate-ms-v1
│
├─ sessionStorage ("skillflex-*" flags)
│  ├─ skillflex-google-otp-pending
│  ├─ skillflex-google-otp-active
│  └─ skillflex-theme-transition
│
├─ IndexedDB (Supabase SDK managed)
│  ├─ Session tokens
│  ├─ Refresh tokens
│  └─ User metadata
│
└─ In-Memory State (Runtime only)
   ├─ chatDrafts (Map)
   ├─ bookingDrafts (Map)
   ├─ pendingOutgoingMessages (Map)
   ├─ messageChannels (Map)
   ├─ messagePresence (Map)
   └─ priceNegotiations (Map)

LAYER 3: BACKEND SYNC
├─ Supabase Realtime (WebSocket)
│  ├─ Message delivery
│  ├─ User presence
│  └─ Booking updates
│
├─ Supabase REST API
│  ├─ Fetch bookings
│  ├─ Sync profile
│  ├─ Load services
│  └─ Store messages
│
└─ HTTP Endpoints (/api/*)
   ├─ /api/session (server-side auth)
   ├─ /api/auth/session-otp
   ├─ /api/auth/google-2fa
   └─ /api/admin-observability
```

---

## Data Persistence Comparison

```
┌────────────────────┬──────────────┬────────────┬───────────────────┐
│ Page/Feature       │ Persistence  │ Scope      │ Sync Method       │
├────────────────────┼──────────────┼────────────┼───────────────────┤
│ Dashboard          │ localStorage │ Demo only  │ Manual saveState()│
│                    │ Supabase     │ Auth users │ refreshSupabase() │
│                    │ sessionStor. │ OTP temp   │ Flag-based        │
├────────────────────┼──────────────┼────────────┼───────────────────┤
│ Chat/Messaging     │ localStorage │ Cache      │ Optimistic + sync │
│                    │ Supabase     │ Live       │ Realtime WS       │
│                    │ In-Memory    │ Drafts     │ On send           │
├────────────────────┼──────────────┼────────────┼───────────────────┤
│ Theme              │ localStorage │ Per-site   │ Event listener    │
│                    │ System pref  │ Fallback   │ Media query       │
├────────────────────┼──────────────┼────────────┼───────────────────┤
│ Auth Session       │ IndexedDB    │ Per-tab    │ Auto-refresh      │
│                    │ HTTP Cookie  │ Secure     │ Server validation  │
├────────────────────┼──────────────┼────────────┼───────────────────┤
│ Admin Console      │ DOM classes  │ Runtime    │ None (transient)  │
├────────────────────┼──────────────┼────────────┼───────────────────┤
│ Landing Page       │ None         │ None       │ N/A               │
└────────────────────┴──────────────┴────────────┴───────────────────┘
```

---

## State Update Flow (Dashboard Example)

```
User Action (e.g., click "Save booking")
         ↓
Event Handler (onclick)
         ↓
runAction() wrapper
  ├─ Show loading indicator
  ├─ Disable submit button
  └─ Execute async action
         ↓
appSupabase.from("bookings").insert(...)
         ↓
Backend Response
  ├─ Success → Update in-memory state
  │          → Call saveState() → localStorage
  │          → Call renderAll() → DOM update
  │          → Show success toast
  │
  └─ Error  → Rollback optimistic update
            → Show error toast
            → Keep user input
         ↓
UI Re-renders with new state
         ↓
Realtime subscription receives broadcast
         ↓
Auto-update other connected clients
```

---

## Cross-Page State Sync (Current)

```
PAGE A (Dashboard)              PAGE B (Admin)              PAGE C (Landing)
  ↓                              ↓                            ↓
[Load state]                   [Load state]                [No state]
  ├─ localStorage               ├─ DOM only                   └─ Static
  ├─ Supabase                   └─ No JS objects
  └─ In-memory Maps
         ↓
[Auth Change Event]
  └─ window:skillflex:auth-state-change
         ↓
All pages listen (if subscribed)
         ↓
PAGE A: Updates bookings        PAGE B: No effect           PAGE C: No effect
PAGE A: Clears chat drafts      PAGE B: No effect           PAGE C: No effect
```

**Problem:** No guaranteed state sync across pages within SPA.

---

## Recommended Unified Architecture

```
┌──────────────────────────────────────────────────────────┐
│              UNIFIED STATE MANAGEMENT LAYER              │
│  (Recommended: Zustand or Redux for simplicity)          │
└──────────────────────────────────────────────────────────┘
                            ↑
                            │
            ┌───────────────┼───────────────┐
            ↓               ↓               ↓
     [localStorage]   [sessionStorage]  [Supabase]
     (Long-term)      (Temp, OTP)       (Backend)
             ↓               ↓               ↓
             └───────────────┼───────────────┘
                             ↓
                     [Persistence Layer]
                    (Routes to appropriate store)
                             ↓
    ┌────────────────────────┼────────────────────────┐
    ↓                        ↓                        ↓
[Landing]           [Dashboard]              [Admin]
Minimal state       Comprehensive state      DOM state
                    + Realtime sync          + Persistence
                                            shim
```

---

## Key Issues & Solutions

```
ISSUE 1: No Global State Framework
CURRENT: Scattered state across files
IMPACT:  Hard to debug, race conditions possible
FIX:     Use Zustand or Redux

ISSUE 2: Inconsistent Persistence
CURRENT: Different patterns per page
IMPACT:  Confusing for developers, bugs in sync
FIX:     Single persistence adapter

ISSUE 3: No Cross-Page Sync
CURRENT: Auth changes don't update all pages automatically
IMPACT:  User might see stale data in different tabs
FIX:     Broadcast Channel API or Zustand subscribers

ISSUE 4: Memory Leaks
CURRENT: Maps never cleared, timers persist
IMPACT:  Slow SPA experience over time
FIX:     Add cleanup on page navigation

ISSUE 5: No State Versioning
CURRENT: localStorage keys hardcoded
IMPACT:  Schema changes break cached data
FIX:     Implement migration strategy
```

---

## File Reference Map

```
State Management Files:
├─ user.js (Main state holder for dashboard)
│  ├─ loadState() - Load from localStorage
│  ├─ saveState() - Persist to localStorage
│  ├─ refreshSupabaseState() - Sync from backend
│  ├─ loadSupabaseState() - Fetch all user data
│  ├─ renderAll() - Trigger all UI updates
│  └─ In-memory Maps (chat, drafts, etc.)
│
├─ supabase-client.js (Global auth state)
│  ├─ window.skillflexSupabase (Supabase client)
│  ├─ window.skillflexSession (Current session)
│  ├─ onAuthStateChange() (Auth listener)
│  ├─ window.syncSkillflexServerSession() (Sync to backend)
│  └─ window.skillflexSignOut() (Logout)
│
├─ theme.js (Theme state)
│  ├─ localStorage.skillflex-theme
│  ├─ document.documentElement.dataset.theme
│  └─ System preference fallback
│
├─ auth.js (Auth page state)
│  ├─ authMode, authSubmitting, etc.
│  ├─ sessionStorage OTP flags
│  └─ Form input elements
│
├─ onboarding.js (Onboarding state)
│  ├─ selectedSkills (Map)
│  ├─ Form inputs
│  └─ Supabase profile sync
│
├─ script.js (Admin state - DOM-based)
│  └─ Element classes and attributes only
│
├─ landing.js (Landing page - minimal state)
│  └─ Menu open/close only
│
├─ service-form.js (Service listing state)
│  └─ Form inputs + localStorage
│
└─ marketplace-growth.js (Growth features)
   ├─ localStorage demo data
   └─ Supabase production data
```

---

## Testing State Management

To verify state consistency:

```javascript
// Test 1: Check localStorage contents
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('skillflex-')) {
    console.log(`${key}:`, localStorage.getItem(key));
  }
});

// Test 2: Check sessionStorage
Object.keys(sessionStorage).forEach(key => {
  if (key.startsWith('skillflex-')) {
    console.log(`${key}:`, sessionStorage.getItem(key));
  }
});

// Test 3: Check in-memory state
console.log('Dashboard state:', state);
console.log('Chat drafts:', chatDrafts);
console.log('Booking drafts:', bookingDrafts);

// Test 4: Check Supabase session
console.log('Auth session:', window.skillflexSession);

// Test 5: Verify cross-page sync
// Navigate to different page, then back
// Check if state persisted correctly
```

---

## Summary Matrix

```
┌──────────────────┬────────────────┬──────────────┬──────────────┐
│ Category         │ Current State  │ Consistency  │ Scalability  │
├──────────────────┼────────────────┼──────────────┼──────────────┤
│ Persistence      │ Multiple       │ ✗ Low        │ ✗ Hard       │
│ Sync             │ Ad-hoc         │ ✗ Low        │ ✗ Risky      │
│ Cross-page       │ Custom events  │ ✗ Manual     │ ✗ Brittle    │
│ Real-time        │ Supabase WS    │ ✓ Good       │ ✓ Good       │
│ Testing          │ Difficult      │ ✗ Hard       │ ✗ Slow       │
│ Developer DX     │ Confusing      │ ✗ Low        │ ✗ Error-prone│
└──────────────────┴────────────────┴──────────────┴──────────────┘
```
