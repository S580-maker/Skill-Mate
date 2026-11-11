/* Per-account, per-tab drafts and discovery state; never store payment or auth data. */
(() => {
  const search = document.querySelector("#global-search");
  const filters = document.querySelector("#marketplace-filters");
  if (!search || !filters) return;
  const maxAge = 24 * 60 * 60 * 1000;
  let ready = false;
  let metricTimer;
  const recorded = new Set();
  const memoryAttempts = new Map();
  const memoryState = new Map();
  const key = suffix => `skillmate-journey-v1:${appUser?.id || "demo"}:${suffix}`;
  function read(suffix) {
    try {
      const item = memoryState.get(key(suffix)) || JSON.parse(sessionStorage.getItem(key(suffix)) || "null");
      return item && Date.now() - item.savedAt < maxAge ? item.value : null;
    } catch { return null; }
  }
  function store(suffix, value) {
    const item = { savedAt: Date.now(), value };
    memoryState.set(key(suffix), item);
    try { sessionStorage.setItem(key(suffix), JSON.stringify(item)); return true; }
    catch { return false; }
  }
  function remove(suffix) {
    // A tombstone also hides stale persisted data if storage access is revoked.
    memoryState.set(key(suffix), { savedAt: Date.now(), value: null });
    try { sessionStorage.removeItem(key(suffix)); } catch { /* keep the tombstone */ }
  }
  function record(event) {
    if (!ready || recorded.has(event) || navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;
    recorded.add(event);
    // Only fixed event names go to Supabase. Never send search text, scope or messages.
    try {
      if (appSupabase) Promise.resolve(appSupabase.rpc("record_marketplace_journey", { p_event: event })).catch(() => {});
    } catch { /* Optional reporting must never interrupt the user journey. */ }
  }
  function captureSearch() {
    if (!ready) return;
    const values = Object.fromEntries([...filters.elements].filter(item => item.name).map(item => [item.name, item.type === "checkbox" ? item.checked : item.value]));
    store("discovery", { query: search.value, category: selectedCategory, filters: values, expanded: !filters.hidden });
    clearTimeout(metricTimer);
    metricTimer = setTimeout(() => { if (search.value.trim()) record("search"); }, 700);
  }
  function draftKey(providerId, serviceId, agreementId = "") { return `booking:${providerId}:${serviceId}:${agreementId}`; }
  function bookingDraft(providerId, serviceId, agreementId = "") {
    const draft = read(draftKey(providerId, serviceId, agreementId));
    return draft && typeof draft === "object" ? draft : null;
  }
  function captureBooking() {
    if (!ready || !document.querySelector("#booking-modal").open) return;
    const providerId = document.querySelector("#booking-provider-id").value;
    const serviceId = document.querySelector("#booking-service").value;
    if (!providerId || !serviceId) return;
    const draft = Object.fromEntries(["date", "time", "note", "location"].map(name => [name, document.querySelector(`#booking-${name}`).value]));
    draft.locationType = document.querySelector("#booking-location-type").value;
    draft.slot = document.querySelector("#booking-slot").value;
    const agreementId = document.querySelector("#booking-negotiation-id").value;
    const saved = store(draftKey(providerId, serviceId, agreementId), draft);
    if (!agreementId) bookingDrafts.set(`${providerId}:${serviceId}`, draft);
    status(saved ? "Draft saved in this tab. Your booking has not been sent." : "Draft is kept while this page stays open. Browser storage is unavailable.");
  }
  function status(message, error = false, retry = false) {
    const region = document.querySelector("#booking-save-status");
    region.dataset.state = error ? "error" : "info";
    region.replaceChildren(document.createTextNode(message));
    if (retry) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "button button-small button-outline"; button.textContent = "Retry request";
      button.addEventListener("click", () => document.querySelector("#booking-form").requestSubmit());
      region.append(button);
    }
  }
  function bookingOpened(restored) {
    status(restored ? "Restored your draft. Review the date, price and details before sending." : navigator.onLine ? "Your request is sent only when you choose Send Booking Request." : "You are offline. You can prepare a draft; reconnect before sending.");
    record("booking_open");
  }
  function requestId(signature) {
    const saved = read("booking-attempts");
    for (const attempt of Array.isArray(saved) ? saved : []) {
      if (Array.isArray(attempt) && typeof attempt[0] === "string" && /^[0-9a-f-]{36}$/i.test(attempt[1])) memoryAttempts.set(attempt[0], attempt[1]);
    }
    if (memoryAttempts.has(signature)) return memoryAttempts.get(signature);
    const id = crypto.randomUUID();
    memoryAttempts.set(signature, id);
    if (memoryAttempts.size > 20) memoryAttempts.delete(memoryAttempts.keys().next().value);
    store("booking-attempts", [...memoryAttempts]);
    return id;
  }
  document.addEventListener("skillmate:booking-save", event => {
    if (event.detail.state === "saved") {
      const suffix = draftKey(event.detail.providerId, event.detail.serviceId, event.detail.agreementId);
      // A student may already be preparing another request while this write finishes.
      if (!event.detail.submittedDraft || JSON.stringify(read(suffix)) === JSON.stringify(event.detail.submittedDraft)) {
        remove(suffix);
        if (!event.detail.agreementId) bookingDrafts.delete(`${event.detail.providerId}:${event.detail.serviceId}`);
      }
      for (const [signature, id] of memoryAttempts) if (id === event.detail.requestId) memoryAttempts.delete(signature);
      store("booking-attempts", [...memoryAttempts]);
      record("booking_sent");
    } else if (event.detail.state === "failed") {
      if (event.detail.draftRequest && event.detail.draftRequest !== document.querySelector("#booking-modal").dataset.draftRequest) return;
      status("Your request was not confirmed as saved. Review My bookings before retrying if your connection was interrupted. Your draft is still here.", true, true);
    }
  });
  document.querySelector("#booking-form").addEventListener("input", () => captureBooking());
  document.querySelector("#booking-form").addEventListener("change", captureBooking);
  // Capture immediately before a reload or submission, including the last keystroke.
  window.addEventListener("pagehide", () => { captureSearch(); captureBooking(); });
  document.querySelector("#booking-form").addEventListener("submit", captureBooking, true);
  search.addEventListener("input", captureSearch);
  filters.addEventListener("input", captureSearch);
  filters.addEventListener("change", captureSearch);
  filters.addEventListener("reset", () => setTimeout(captureSearch, 0));
  document.addEventListener("click", event => {
    if (event.target.closest("[data-category], [data-clear-search], #marketplace-filter-trigger, #recent-view-all")) setTimeout(captureSearch, 0);
    const action = event.target.closest("[data-discovery-focus]");
    if (!action) return;
    if (action.dataset.discoveryFocus === "filters") {
      if (filters.hidden) document.querySelector("#marketplace-filter-trigger").click();
      filters.scrollIntoView({ block: "center", behavior: "auto" });
      filters.querySelector("input,select").focus({ preventScroll: true });
    } else { search.scrollIntoView({ block: "center", behavior: "auto" }); search.focus({ preventScroll: true }); }
  });
  document.addEventListener("skillmate:workspace-ready", () => {
    ready = true;
    const saved = read("discovery");
    if (saved && typeof saved.query === "string") {
      search.value = saved.query.slice(0, 200);
      if (["All", ...serviceCategories, ...window.skillmateMarketplace.popularCategories].includes(saved.category)) selectedCategory = saved.category;
      for (const field of filters.elements) {
        if (!field.name || saved.filters?.[field.name] == null) continue;
        if (field.type === "checkbox") field.checked = saved.filters[field.name] === true;
        else if (field.tagName === "SELECT") { if ([...field.options].some(option => option.value === saved.filters[field.name])) field.value = saved.filters[field.name]; }
        else field.value = String(saved.filters[field.name]).slice(0, 20);
      }
      if (saved.expanded && filters.hidden) document.querySelector("#marketplace-filter-trigger").click();
      document.querySelector("#search-clear").hidden = !search.value;
      renderServiceCategories(); renderMarketplace();
      const resume = document.querySelector("#discovery-resume");
      resume.textContent = "Your search and filters were restored for this tab.";
      resume.hidden = false;
    }
    record("discover");
  }, { once: true });
  window.addEventListener("online", () => { if (document.querySelector("#booking-modal").open) status("You are back online. Review your details before sending the request."); });
  window.addEventListener("offline", () => { captureBooking(); if (document.querySelector("#booking-modal").open) status("You are offline. Your draft is kept here; reconnect before sending.", true); });
  window.skillmateJourney = { bookingDraft, bookingOpened, record, requestId };
})();
