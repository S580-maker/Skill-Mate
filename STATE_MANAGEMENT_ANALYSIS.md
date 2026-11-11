# Skill-Mate State Management Analysis

**Date:** November 11, 2026  
**Status:** Website state management is **inconsistent and partially implemented**

---

## Executive Summary

Skill-Mate uses **vanilla JavaScript without a centralized state-management framework**. State management varies significantly across pages:

- **Student Dashboard** (`index.html`): Has a comprehensive `state` object with localStorage/Supabase persistence
- **Admin Console** (`admin.html`): Uses local script variables with DOM-based state
- **Auth Pages** (`login.html`, `onboarding.html`): Manage state through Supabase sessions and form inputs
- **Landing Page** (`landing.html`): Minimal state—mostly static with transient UI interactions
- **Theme**: Centralized localStorage persistence (`skillmate-theme`)
- **Auth Session**: Managed globally via Supabase client

**Result:** State management exists everywhere but **is not consistent or cohesive**.

---

## Detailed Breakdown by Page

### 1. **Student Dashboard** (`index.html`) — Comprehensive State ✓

**File:** `user.js` (lines 1-3100+)

#### State Structure
```javascript
const storageKey = "skillmate-student-demo-v1";
let state = loadState();

const defaultState = {
  mode: "find",
  activePage: "home",
  bookings: [],
  groups: [],
  saved: [],
  services: [],
  messages: [],
  portfolio: [],
  reports: [],
  blocked: [],
  reviews: [],
  profile: { name, bio, email, location, verified, ... }
};
```

#### State Persistence Layers
1. **localStorage** (demo mode): Persists entire state JSON
   - Key: `skillmate-student-demo-v1`
   - Loaded at startup: `loadState()` (line 465)
   - Saved on changes: `saveState()` (line 476)

2. **Supabase** (authenticated mode): Live data from backend
   - Fetched via `refreshSupabaseState()` (line 2139)
   - Loaded via `loadSupabaseState()` (line 2224)
   - Uses RPC calls and direct table queries

3. **sessionStorage** (transient): OTP and temporary auth states
   - `skillmate-google-otp-pending`
   - `skillmate-google-otp-active`

4. **In-Memory Maps**: Drafts, pending messages, negotiations
   - `chatDrafts` (Map)
   - `bookingDrafts` (Map)
   - `pendingOutgoingMessages` (Map)
   - `priceNegotiations` (Map)

#### Navigation & Page Management
- Hash-based routing: `#home`, `#bookings`, `#messages`, etc.
- Page state tracked in `state.activePage`
- `showPage(page)` function triggers renders (line 2984)
- History managed via `window.history.pushState()`
- Scroll position cached: `pageScrollPosition` Map

#### Rendering
- Central `renderAll()` function (line 2004) orchestrates all UI updates
- Calls specialized render functions:
  - `renderMarketplace()` — service listings
  - `renderBookingList()` — user bookings
  - `renderConversations()` — chat history with real-time sync
  - `renderEarnings()` — provider earnings
  - `renderListings()` — provider's own services
  - `renderPortfolio()` — provider's portfolio items

#### Real-Time Sync
- **Message Channels** (Supabase Realtime): `messageChannels` Map
- **Presence Tracking**: `messagePresence` Map
- **Retry Logic**: `messageChannelRetryTimers`, `messageChannelRetryAttempts`
- **Connection Status Timers**: `messageConnectionStatusTimers`

**State Management Pattern:** Hybrid — localStorage for demo, Supabase for production; central state object; specialized sub-state maps for transient data.

---

### 2. **Admin Console** (`admin.html`) — Distributed State ✗

**File:** `script.js` (lines 1-150)

#### State Structure
```javascript
const sidebar = document.querySelector("#sidebar");
const menuToggle = document.querySelector("#menu-toggle");
const globalSearch = document.querySelector("#global-search");
let toastTimer;
```

#### State Management Pattern
- **No centralized state object**
- State is **DOM-based**: element attributes, classes, visibility
- UI state stored in:
  - Element `classList` (e.g., `sidebar.classList.toggle("open")`)
  - Element `hidden` attribute (e.g., `view.hidden = view !== current`)
  - Element `dataset` (e.g., `node.dataset.state = "error"`)

#### Specific State Management Points
1. **Navigation**: `window.location.hash` + `showAdminView()` (line 14)
2. **Search**: `globalSearch.value` — query stored in input element
3. **Toast Notifications**: `toastTimer` — setTimeout handle only
4. **Sidebar**: Classes toggled directly on DOM nodes
5. **Data Exports**: In-memory CSV generation (no persistence)

#### Page View Management
```javascript
const adminViews = [...document.querySelectorAll(".admin-view")];
function showAdminView() {
  const hash = window.location.hash.slice(1) || "overview";
  const view = document.getElementById(hash);
  adminViews.forEach((item) => { item.hidden = item !== view; });
}
window.addEventListener("hashchange", showAdminView);
```

**State Management Pattern:** DOM-centric; no JavaScript state objects; transient UI state in element properties.

---

### 3. **Auth Pages** (`login.html`, `onboarding.html`, `reset.html`)

#### Login Page (`auth.js`, lines 1-400+)

**State Structure**
```javascript
let authMode = "signin";
let authSubmitting = false;
let authRedirectStarted = false;
let googleOtpStarted = false;
let sessionOtpStarted = false;
let sessionCheckStarted = false;
let otpCountdownTimer = null;
```

**Persistence:**
- **sessionStorage**: OTP flags
  - `skillmate-google-otp-pending`
  - `skillmate-google-otp-active`
- **Form inputs**: Email, password (no persistence between page reloads)
- **Supabase Session**: Managed globally by supabase-client.js
  - Stored in browser's IndexedDB by Supabase SDK
  - Accessible via `window.skillmateSession`

**Temporary State:**
- Countdown timers: `otpCountdownTimer`
- OTP input state: In DOM inputs (line ~e137)
- Error messages: In `#auth-message` element (line e160)

#### Onboarding Page (`onboarding.js`, lines 1-300+)

**State Structure**
```javascript
const selectedSkills = new Map();
let currentUser = null;
let existingAvatarUrl = "";
let previewUrl = "";
```

**Persistence:**
- **Supabase Database**: Profile saved to `profiles` table on form submit
  - `full_name`, `university`, `skills`, `avatar_url`, `onboarding_completed`
- **In-Memory Map**: Skills selection during form editing
- **Form Inputs**: Name, campus, photo file
- **Cloudinary**: Avatar image upload

**State Management Pattern:** Form-driven; Map for local skill selection; Supabase for persistence.

---

### 4. **Theme Management** (`theme.js`) — Centralized ✓

**File:** `theme.js` (lines 1-100+)

#### State Structure
```javascript
const storageKey = "skillmate-theme";
let savedTheme = null;
try {
  const storedTheme = localStorage.getItem(storageKey);
  if (storedTheme === "dark" || storedTheme === "light") savedTheme = storedTheme;
}
```

#### Persistence
- **localStorage**: `skillmate-theme` = `"dark"` or `"light"`
- **System Preference Fallback**: Uses `prefers-color-scheme` media query
- **DOM Attribute**: `document.documentElement.dataset.theme = "dark" | "light"`

#### Synchronization
- Reads on page load
- Listens to theme toggle buttons: `[data-theme-toggle]`
- Updates all buttons: `[data-theme-icon]`
- Updates meta tag: `<meta name="theme-color">`

**State Management Pattern:** Dual-layer — localStorage + system preference; single source of truth in DOM attribute.

---

### 5. **Supabase Client** (`supabase-client.js`) — Global Auth State

**File:** `supabase-client.js` (lines 1-200+)

#### Global State
```javascript
window.skillmateSupabase = createClient(projectUrl.origin, anonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});
window.skillmateSession = null;
```

#### State Persistence
- **Browser's IndexedDB** (Supabase SDK handles automatically)
  - Session tokens
  - Refresh tokens
  - User metadata
- **sessionStorage** (Supabase SDK option): Used for session detection in URLs
- **localStorage** (Supabase SDK option): Used if persistSession = true

#### Global Events
```javascript
window.skillmateSupabase.auth.onAuthStateChange((event, session) => {
  window.skillmateSession = session;
  window.dispatchEvent(new CustomEvent("skillmate:auth-state-change", {
    detail: { event, session }
  }));
});
```

#### Global Functions
- `window.skillmateRestoreSession()` — Get stored session
- `window.skillmateSignOut()` — Clear session
- `window.syncSkillmateServerSession(session)` — Server-side sync
- `window.clearExpiredSkillmateSession()` — Logout on expired token

**State Management Pattern:** Global singleton; Supabase SDK handles persistence; custom events for state changes.

---

### 6. **Landing Page** (`landing.html`, `landing.js`) — Minimal State

**File:** `landing.js` (lines 1-100)

**State Structure**
```javascript
const menu = document.querySelector(".menu-toggle");
const nav = document.querySelector("#main-nav");
const mobile = window.matchMedia("(max-width: 800px)");
const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
```

**Transient UI State Only**
- Menu open/closed: Toggle class `is-open`
- Active FAQ question: `details[open]` native HTML
- Intersection Observer state: In closure scope

**No Persistence:** No localStorage, no sessionStorage, no IndexedDB.

**State Management Pattern:** DOM-centric; transient UI state; no persistence.

---

### 7. **Chat/Messaging** (in `user.js`) — Specialized Sub-State

**File:** `user.js` (lines 180-2139)

#### State Structures
```javascript
const chatDrafts = new Map();                          // Draft messages
const chatNegotiationServiceSelection = new Map();    // Service selection state
const conversationsOpeningNegotiation = new Set();    // Conversations in negotiation mode
const pendingOutgoingMessages = new Map();            // Unsent messages
const sendingMessageIds = new Set();                  // In-flight message IDs
const messageChannels = new Map();                    // Realtime subscriptions
const messagePresence = new Map();                    // User presence
const hiddenMessageIds = new Set();                   // Hidden/deleted messages
const readUpdatesInProgress = new Set();              // Pending read receipts
const conversationMessageRefreshes = new Set();       // Refresh timers
const conversationMessageRefreshTimes = new Map();    // Last refresh timestamp
```

#### Persistence Layers
1. **localStorage**: Chat message cache
   - Key: `skillmate-chat-messages:${userId}`
   - Synced via `cacheConversationMessages()` (line 182)
   - Loaded via `loadCachedConversationMessages()` (line 169)

2. **Supabase**: Full message history
   - Fetched via RPC: `recent_conversation_messages()`
   - Direct table query: `messages` table
   - Metadata: `delivered_at`, `reply_to`, `read_at`

3. **sessionStorage**: OTP state
4. **IndexedDB**: Supabase Realtime subscriptions

#### Message Sync Logic
- Batch message loads: `loadConversationMessagePages()` (line 212)
- Fallback logic for missing RPC/columns: `batchMessagesAvailable`, `messageMetadataAvailable`
- Merge pending: `mergePendingMessages()` reconciles pending + synced
- Optimistic updates: In-memory state updates before server confirmation
- Retry logic: `messageChannelRetryTimers`, `messageChannelRetryAttempts`

**State Management Pattern:** Hybrid — Map-based local state, localStorage cache, Supabase Realtime sync, optimistic updates.

---

### 8. **Service Form** (`service-form.js`)

**File:** `service-form.js` (lines 1-500+)

#### State Structure
```javascript
function showFeedback(message, state = "error") {
  feedback.dataset.state = state;  // "error", "success", "info"
  // ...
}

// Service list state
localStorage.setItem(storageKey, JSON.stringify({ ...state, services: nextServices }));
```

#### Persistence
- **localStorage**: Entire service state (user.js shared state)
- **Supabase**: Services table for persistence

**State Management Pattern:** Form-driven; DOM-based feedback state; localStorage/Supabase for data persistence.

---

### 9. **Marketplace Growth** (`marketplace-growth.js`)

**File:** `marketplace-growth.js` (lines 1-700+)

#### State Structure
```javascript
try { 
  localStorage.setItem(demoKey, JSON.stringify({ schedules, requests, responses })); 
}
const data = JSON.parse(localStorage.getItem(demoKey) || "{}");
```

#### Demo State (localStorage)
- Schedule requests
- Price negotiations
- Responses

#### Production State (Supabase)
- Booking statuses
- Message history

**State Management Pattern:** localStorage for demo data; Supabase for production.

---

## State Persistence Summary Table

| Layer | Pages Using | Mechanism | Scope |
|-------|-------------|-----------|-------|
| **localStorage** | Dashboard, Theme, Chat, Services, Marketplace | JSON serialization | Per-origin |
| **sessionStorage** | Auth pages, OTP flows | String flags | Per-tab |
| **IndexedDB** | Supabase client | Supabase SDK | Per-origin |
| **DOM Attributes** | Admin, Theme, All pages | CSS classes, data-* | Runtime only |
| **In-Memory Maps** | Dashboard (chat, drafts) | JavaScript Map objects | Runtime only |
| **Supabase Realtime** | Dashboard messages | WebSocket subscriptions | Real-time sync |
| **URL Hash** | All SPA pages | Browser history | Navigation state |
| **Server Session Cookie** | All auth pages | HTTP-only cookie | Secure backend |

---

## Architecture Issues & Gaps

### ✗ **No Global State Framework**
- No Redux, Vuex, Pinia, Zustand, or equivalent
- State spread across multiple files and patterns
- Difficult to trace state changes across pages

### ✗ **Inconsistent Patterns**
- Dashboard: Centralized state object
- Admin: DOM-centric, no JS state
- Landing: Minimal, transient only
- Auth: Form-driven + Supabase

### ✗ **No Shared Cross-Page State**
- Dashboard state doesn't automatically sync to Admin
- Theme loads independently on each page
- Auth session changes don't propagate to all pages (uses custom events only)

### ✗ **localStorage Not Cleared on Logout**
- Dashboard state persists across user sessions
- OTP flags remain in sessionStorage
- No "logout" hook to clear user-specific data

### ✗ **No State Versioning**
- localStorage keys are hardcoded (`"skillmate-student-demo-v1"`)
- No migration strategy if schema changes
- Old cached data could break new features

### ✗ **Race Conditions**
- Multiple async state updates (Supabase, localStorage, real-time)
- No locking mechanism for concurrent modifications
- Chat draftsduplicate requests possible

### ✗ **Memory Leaks**
- Multiple Maps holding references indefinitely
- No cleanup on page navigation (within SPA)
- Timer handles stored but not always cleared

---

## Recommendations

### 1. **Adopt a State Management Library** (If scaling)
```javascript
// Option A: Zustand (lightweight)
import create from 'zustand';
const useAppStore = create((set) => ({
  user: null,
  bookings: [],
  setUser: (user) => set({ user }),
  setBookings: (bookings) => set({ bookings })
}));

// Option B: Redux (if complex)
// Option C: Pinia (if considering Vue later)
```

### 2. **Unify Persistence Layers**
```javascript
// Create a single persistence abstraction
class StateManager {
  constructor() {
    this.storage = new Map(); // In-memory
    this.listeners = new Set();
  }
  
  setState(path, value) {
    this.storage.set(path, value);
    this.persist(path, value);
    this.notifyListeners(path);
  }
  
  persist(path, value) {
    // Route to localStorage, sessionStorage, or Supabase
    if (path.startsWith('auth.')) {
      sessionStorage.setItem(`skillmate-${path}`, JSON.stringify(value));
    } else if (path.startsWith('user.')) {
      localStorage.setItem(`skillmate-${path}`, JSON.stringify(value));
    } else if (path.startsWith('supabase.')) {
      this.syncToSupabase(path, value);
    }
  }
  
  notifyListeners(path) {
    this.listeners.forEach(cb => cb(path));
  }
}
```

### 3. **Implement Global State Bus**
```javascript
// All pages subscribe to auth changes
window.addEventListener('skillmate:auth-change', (e) => {
  // Clear user-specific state
  // Refresh page data
  // Reset draft state
});

// All pages sync on logout
window.skillmateSignOut = async () => {
  // Clear state
  await clearAllLocalStorage();
  await clearAllInMemoryState();
  window.dispatchEvent(new CustomEvent('skillmate:signed-out'));
};
```

### 4. **Establish Clear Data Flow**
```
User Action
    ↓
Component Handler
    ↓
State Update (single source of truth)
    ↓
Persist Layer Decision (localStorage/Supabase/sessionStorage)
    ↓
Broadcast Change Event
    ↓
UI Re-render
```

### 5. **Add State Debugging Tools**
```javascript
// Log all state changes
const stateHistory = [];
function setState(key, value) {
  stateHistory.push({ key, value, timestamp: Date.now() });
  if (stateHistory.length > 100) stateHistory.shift();
  // Send to monitoring service
}
```

### 6. **Cleanup on Navigation**
```javascript
// In SPA page changes
function showPage(page) {
  // Clear old page state
  chatDrafts.clear();
  bookingDrafts.clear();
  messageChannels.forEach(channel => channel.unsubscribe());
  
  // Load new page state
  renderAll();
}
```

---

## Conclusion

**Skill-Mate's state management exists but is NOT consistent "everywhere."** Instead:

1. **Different pages use different patterns** (centralized, DOM-centric, form-driven)
2. **Persistence is ad-hoc** (localStorage, sessionStorage, IndexedDB, Supabase, in-memory)
3. **No cross-page synchronization** (auth events are custom, theme is isolated)
4. **Scaling challenges** ahead if more features are added

**For a production app serving thousands of students, a unified state-management approach is strongly recommended.**
