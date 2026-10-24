const storageKey = "skillmate-student-demo-v1";
const sidebar = document.querySelector("#sidebar");
const menuToggle = document.querySelector("#menu-toggle");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");
function closeSidebar(restoreFocus = false) {
  sidebar.classList.remove("open");
  document.body.classList.remove("sidebar-open");
  sidebarBackdrop.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  if (restoreFocus) menuToggle.focus();
}
const seedProviders = [
  { id: "daniel", name: "Daniel Owusu", initials: "DO", campus: "University of Ghana", course: "Computer Science · Level 300", category: "Tech help", service: "Laptop clean & tune-up", description: "A proper clean, fan check and a little tune-up to get your laptop running smoothly again.", price: 45, rating: 4.9, reviews: 28, bookings: 74, color: "blue", verified: true, available: "Today · 2 spots left", groups: true, portfolio: ["Laptop refresh", "Student tech clinic"] },
  { id: "akosua", name: "Akosua Appiah", initials: "AA", campus: "University of Ghana", course: "Business · Level 200", category: "Hair & beauty", service: "Braids & protective styling", description: "Neat, comfortable braids in my Legon hostel studio. Bring a friend and book together.", price: 120, rating: 5.0, reviews: 19, bookings: 51, color: "rose", verified: true, available: "Tomorrow · 3 spots left", groups: true, portfolio: ["Knotless braids", "Protective twists"] },
  { id: "nana", name: "Nana Adu", initials: "NA", campus: "University of Ghana", course: "Visual Arts · Level 400", category: "Design", service: "Posters, logos & social graphics", description: "Fresh visuals for student businesses, clubs and events. Two revisions included.", price: 80, rating: 4.8, reviews: 32, bookings: 63, color: "violet", verified: true, available: "Available this week", groups: false, portfolio: ["Campus concert poster", "Club identity kit"] },
  { id: "michael", name: "Michael Frimpong", initials: "MF", campus: "University of Ghana", course: "Mathematics · Level 400", category: "Tutoring", service: "Calculus & statistics tutoring", description: "Friendly, patient one-to-one sessions. First 10 minutes are a free fit check.", price: 65, rating: 4.9, reviews: 41, bookings: 86, color: "mint", verified: true, available: "Today · 4 spots left", groups: true, portfolio: ["Exam prep study group", "Calculus revision"] },
  { id: "efua", name: "Efua Boateng", initials: "EB", campus: "University of Ghana", course: "Hospitality · Level 300", category: "Food", service: "Homemade lunch boxes", description: "Fresh, filling Ghanaian lunch boxes, made to order and ready near campus.", price: 35, rating: 4.7, reviews: 17, bookings: 43, color: "peach", verified: true, available: "Weekdays · Pre-order", groups: true, portfolio: ["Jollof lunch box", "Waakye Friday"] },
  { id: "kojo", name: "Kojo Asare", initials: "KA", campus: "University of Ghana", course: "Information Studies · Level 200", category: "Tech help", service: "Phone & laptop setup", description: "New laptop setup, software installs, data transfer and phone troubleshooting.", price: 55, rating: 4.8, reviews: 14, bookings: 29, color: "sky", verified: true, available: "Available this week", groups: false, portfolio: ["New laptop setup", "Phone data transfer"] },
];
const seedGroups = [
  { id: "group-1", providerId: "daniel", service: "Laptop clean & tune-up", title: "Laptop clean-up crew", host: "Ama Mensah", date: "2026-10-26", capacity: 5, joined: 3, price: 38, status: "Open" },
  { id: "group-2", providerId: "akosua", service: "Braids & protective styling", title: "Braids together, save together", host: "Efua Boateng", date: "2026-10-28", capacity: 4, joined: 2, price: 105, status: "Open" },
  { id: "group-3", providerId: "michael", service: "Calculus & statistics tutoring", title: "Stats midterm study session", host: "Yaw Asante", date: "2026-10-27", capacity: 4, joined: 3, price: 50, status: "Open" },
];
const serviceCategories = [
  "Tech help",
  "Hair & beauty",
  "Tutoring",
  "Design",
  "Food",
  "Cleaning",
  "Photography",
  "Fashion & tailoring",
  "Fitness & wellness",
  "Writing & editing",
  "Events & entertainment",
  "Errands & delivery",
  "Repairs",
  "Appliance repair",
  "Bike repair",
  "Clothing alterations",
  "Home maintenance",
  "Laundry",
  "Moving help",
  "Other",
];
const categoryIcons = {
  "Tech help": "⌘",
  "Hair & beauty": "✂",
  Tutoring: "▤",
  Design: "✎",
  Food: "⌁",
  Cleaning: "✧",
  Photography: "▣",
  "Fashion & tailoring": "◇",
  "Fitness & wellness": "↗",
  "Writing & editing": "✐",
  "Events & entertainment": "♫",
  "Errands & delivery": "➜",
  Repairs: "⚒",
  "Appliance repair": "⚒",
  "Bike repair": "⚒",
  "Clothing alterations": "◇",
  "Home maintenance": "⚒",
  Laundry: "✧",
  "Moving help": "➜",
};
const defaultState = {
  mode: "find",
  activePage: "home",
  bookings: [
    { id: "booking-demo-1", providerId: "daniel", service: "Laptop clean & tune-up", price: 45, date: "2026-10-26", time: "10:30 AM", status: "Confirmed", type: "Individual", note: "Laptop fan has been getting noisy.", reviewed: false, demo: true },
    { id: "booking-demo-2", providerId: "michael", service: "Calculus & statistics tutoring", price: 65, date: "2026-10-28", time: "2:00 PM", status: "Pending", type: "Individual", note: "Going over probability before our quiz.", reviewed: false, demo: true },
    { id: "booking-demo-6", providerId: "akosua", service: "Braids & protective styling", price: 120, date: "2026-10-20", time: "1:30 PM", status: "Completed", type: "Group booking", note: "Booked with two friends from my hall.", reviewed: false, demo: true },
    { id: "booking-demo-3", providerId: "alex", service: "Event posters & social graphics", price: 80, date: "2026-10-27", time: "1:00 PM", status: "Pending", type: "Individual", customer: "Priya Nair", note: "Flyer for the campus film night.", reviewed: false, demo: true },
    { id: "booking-demo-4", providerId: "alex", service: "Laptop setup & troubleshooting", price: 55, date: "2026-10-29", time: "11:00 AM", status: "Confirmed", type: "Individual", customer: "Kofi Mensah", note: "Need help installing my new laptop.", reviewed: false, demo: true },
    { id: "booking-demo-5", providerId: "alex", service: "Event posters & social graphics", price: 80, date: "2026-10-20", time: "3:00 PM", status: "Completed", type: "Individual", customer: "Ama Boateng", reviewed: false, demo: true },
  ],
  groups: seedGroups,
  joinedGroups: [],
  saved: ["akosua", "nana"],
  services: [
    { id: "alex-design", title: "Event posters & social graphics", category: "Design", price: 80, description: "Clean, eye-catching visuals for campus events and student businesses.", groups: false, active: true },
    { id: "alex-tech", title: "Laptop setup & troubleshooting", category: "Tech help", price: 55, description: "Friendly help with laptop setup, software installs and common tech issues.", groups: true, active: true },
  ],
  messages: [
    { id: "chat-daniel", providerId: "daniel", messages: [{ sender: "Daniel Owusu", text: "Hi Alex! Happy to help with the fan clean. Is your laptop a Windows machine or a Mac?", time: "Yesterday" }] },
    { id: "chat-nana", providerId: "nana", messages: [{ sender: "You", text: "Could you make the poster in the club’s purple and gold colours?", time: "Yesterday" }, { sender: "Nana Adu", text: "Absolutely! Send the event details when you're ready.", time: "9:42 AM" }] },
  ],
  portfolio: [{ id: "work-1", title: "Freshers week event poster", description: "Designed a poster and social graphics for a student society launch." }],
  reports: [],
  blocked: [],
  reviews: [],
  profile: { name: "Alex Morgan", bio: "Graphic designer and laptop fixer who loves helping fellow students.", email: "alex.m@ug.edu.gh", location: "", verified: true },
};
let state = loadState();
const appSupabase = window.skillmateSupabase;
let appUser = null;
let connectedProviders = [];
let connectedServices = [];
let selectedCategory = "All";
let activeConversationId = null;
let activeBookingFilter = "all";
let toastTimer;
let pendingActionCount = 0;
let activityRefreshInProgress = false;
const pendingProviderSaves = new Set();
const ownProviderId = () => appUser?.id || "alex";
const isOwnBooking = (booking) => booking.providerId === ownProviderId();

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch (error) {
    console.error("Could not load the Skillmate demo state.", error);
    return structuredClone(defaultState);
  }
}
function saveState() {
  if (appSupabase) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save the Skillmate demo state.", error);
    showToast("Your browser could not save this change. Check available storage.");
  }
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
function getProvider(id) {
  if (appSupabase) {
    if (id === appUser?.id) {
      return {
        id: appUser.id, name: state.profile.name,
        initials: state.profile.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
        campus: state.profile.university, course: state.profile.course || "Student provider",
        category: "Other", verified: state.profile.verified, color: "blue",
        description: state.profile.bio || "Student on Skillmate", service: "", price: 0, rating: 0, reviews: 0,
        bookings: 0, available: "Ask about availability", groups: false, portfolio: [],
      };
    }
    const provider = connectedProviders.find((item) => item.id === id);
    if (provider) return provider;
    const conversation = state.messages.find((item) => item.providerId === id);
    if (conversation) {
      const name = conversation.name || "Student";
      return { id, name, initials: initialsFor(name), campus: "Skillmate student", course: "Student", category: "Other", verified: false, color: "sky" };
    }
    const booking = state.bookings.find((item) => item.id === id || `customer:${item.id}` === id);
    if (booking && id.startsWith("customer:")) {
      const name = booking.customer || "Student";
      return { id, name, initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(), campus: "Skillmate student", course: "Student", category: "Other", verified: false, color: "sky" };
    }
  }
  if (id === ownProviderId()) return {
    id: ownProviderId(), name: state.profile.name, initials: state.profile.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
    campus: "University of Ghana", course: "Graphic designer · Laptop fixer", category: "Design", verified: state.profile.verified,
  };
  if (id.startsWith("customer:")) {
    const booking = state.bookings.find((item) => item.id === id.slice("customer:".length));
    const name = booking?.customer || "Student";
    return {
      id, name, initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      campus: "University of Ghana", course: "Student", category: "Other", verified: false, color: "sky",
    };
  }
  return seedProviders.find((provider) => provider.id === id);
}
function providerServices(providerId) {
  if (appSupabase) return connectedServices.filter((service) => service.providerId === providerId && service.active);
  return providerId === ownProviderId()
    ? state.services.filter((service) => service.active)
    : seedProviders.filter((provider) => provider.id === providerId).map((provider) => ({
      id: `${provider.id}-service`, title: provider.service, category: provider.category,
      price: provider.price, description: provider.description, groups: provider.groups,
    }));
}
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3000);
}
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal && !modal.open) modal.showModal();
}
function closeModal(element) {
  element.closest("dialog").close();
}
function currency(amount) {
  return `GH₵ ${Number(amount).toLocaleString("en-GH")}`;
}
function getCategoryIcon(category) {
  return categoryIcons[category] || "✦";
}
function renderServiceCategories() {
  const strip = document.querySelector("#category-strip");
  const currentCategory = serviceCategories.includes(selectedCategory) ? selectedCategory : "All";
  selectedCategory = currentCategory;
  strip.innerHTML = ["All", ...serviceCategories].map((category) => `
    <button class="category-chip ${category === currentCategory ? "selected" : ""}" data-category="${escapeHTML(category)}" type="button" aria-pressed="${category === currentCategory}">
      ${getCategoryIcon(category)} <span>${category === "All" ? "Everything" : escapeHTML(category)}</span>
    </button>`).join("");

  const select = document.querySelector("#service-category");
  const selectedValue = serviceCategories.includes(select.value) ? select.value : serviceCategories[0];
  select.replaceChildren(...serviceCategories.map((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    option.selected = category === selectedValue;
    return option;
  }));
}
function providerReviewSummary(provider) {
  const reviews = state.reviews.filter((review) => review.providerId === provider.id);
  const totalReviews = provider.reviews + reviews.length;
  const totalRating = provider.rating * provider.reviews + reviews.reduce((sum, review) => sum + review.rating, 0);
  return { rating: totalReviews ? (totalRating / totalReviews).toFixed(1) : "New", count: totalReviews };
}
function renderMarketplace(targetId = "marketplace-grid", providers = appSupabase ? connectedProviders : seedProviders) {
  const target = document.getElementById(targetId);
  if (!target) return;
  const query = document.querySelector("#global-search").value.trim();
  const matching = providers.filter((provider) => {
    if (appUser && provider.id === appUser.id) return false;
    if (state.blocked.includes(provider.id)) return false;
    if (selectedCategory !== "All" && provider.category !== selectedCategory) return false;
    return window.skillmateSmartSearch.matches(provider, query);
  });
  const visible = query
    ? matching.sort((left, right) => {
      const normalizedQuery = window.skillmateSmartSearch.normalize(query);
      const score = (provider) => {
        const service = window.skillmateSmartSearch.normalize(provider.service);
        const category = window.skillmateSmartSearch.normalize(provider.category);
        const name = window.skillmateSmartSearch.normalize(provider.name);
        return (service.includes(normalizedQuery) ? 3 : 0)
          + (category.includes(normalizedQuery) ? 2 : 0)
          + (name.includes(normalizedQuery) ? 1 : 0);
      };
      return score(right) - score(left);
    })
    : matching;
  if (targetId === "marketplace-grid") {
    const status = document.querySelector("#search-status");
    status.hidden = !query;
    status.textContent = query
      ? `${visible.length} ${visible.length === 1 ? "service" : "services"} found. Search also understands related skills and small typos.`
      : "";
  }
  target.innerHTML = visible.length ? visible.map((provider) => `
    <article class="provider-card">
      <div class="provider-card-cover cover-${escapeHTML(provider.color)}"><span class="cover-symbol">${getCategoryIcon(provider.category)}</span><button class="save-button ${state.saved.includes(provider.id) ? "is-saved" : ""}" type="button" data-save="${escapeHTML(provider.id)}" aria-label="${state.saved.includes(provider.id) ? "Remove saved provider" : "Save provider"}">${state.saved.includes(provider.id) ? "♥" : "♡"}</button></div>
      <div class="provider-card-body">
        <div class="provider-card-person"><span class="provider-avatar avatar-${escapeHTML(provider.color)}">${escapeHTML(provider.initials)}</span>        <span><strong>${escapeHTML(provider.name)}</strong><small>${provider.verified ? '<i class="verified-dot">✓</i> Campus verified' : escapeHTML(provider.campus)}</small></span><span class="rating">★ ${providerReviewSummary(provider).rating}<small> (${providerReviewSummary(provider).count})</small></span></div>
        <p class="service-category">${escapeHTML(provider.category)}</p><h3>${escapeHTML(provider.service)}</h3><p class="provider-description">${escapeHTML(provider.description)}</p>
        <div class="provider-card-footer"><span class="price">${currency(provider.price)} <small>/ session</small></span><span class="card-actions"><button type="button" class="icon-button card-message" data-message="${escapeHTML(provider.id)}" aria-label="Message ${escapeHTML(provider.name)}">▤</button><button type="button" class="button button-small button-primary" data-book="${escapeHTML(provider.id)}">Request booking</button></span></div>
        <div class="provider-card-tools"><button type="button" data-profile="${escapeHTML(provider.id)}">View provider details <span aria-hidden="true">→</span></button></div>
      </div>
    </article>`).join("") : `<div class="empty-card"><span>⌕</span><strong>No services found</strong><small>Try another search or choose a different category.</small></div>`;
}
function renderSearchSuggestions() {
  const target = document.querySelector("#search-suggestions");
  const query = globalSearch.value.trim();
  if (!document.body.classList.contains("search-open") || window.skillmateSmartSearch.normalize(query).length < 2) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }

  const providers = appSupabase ? connectedProviders : seedProviders;
  const matches = providers
    .filter((provider) => (!appUser || provider.id !== appUser.id)
      && !state.blocked.includes(provider.id)
      && (selectedCategory === "All" || provider.category === selectedCategory)
      && window.skillmateSmartSearch.matches(provider, query))
    .slice(0, 6);

  target.innerHTML = matches.length
    ? `<p class="search-suggestions-heading">Suggested services</p>${matches.map((provider) => `
      <button class="search-suggestion" type="button" data-search-suggestion="${escapeHTML(provider.service)}">
        <span class="search-suggestion-icon" aria-hidden="true">${getCategoryIcon(provider.category)}</span>
        <span class="search-suggestion-copy"><strong>${escapeHTML(provider.service)}</strong><small>${escapeHTML(provider.category)} · ${escapeHTML(provider.name)}</small></span>
        <span class="search-suggestion-arrow" aria-hidden="true">↗</span>
      </button>`).join("")}`
    : `<p class="search-suggestions-empty">No matching services yet. Try a broader skill or category.</p>`;
  target.hidden = false;
}
function renderGroups() {
  const target = document.querySelector("#group-grid");
  const groups = state.groups.filter((group) => ["Open", "Full"].includes(group.status) && !state.blocked.includes(group.providerId));
  target.innerHTML = groups.length ? groups.map((group) => {
    const provider = getProvider(group.providerId);
    const joined = appSupabase ? Boolean(group.joinedByMe) : state.joinedGroups.includes(group.id);
    const full = group.joined >= group.capacity;
    const percent = Math.min(100, group.joined / group.capacity * 100);
    return `<article class="group-card"><div class="group-card-heading"><span class="group-icon">${getCategoryIcon(provider?.category || "Other")}</span><span class="group-open">${full ? "Almost full" : "Open to join"}</span></div><h3>${escapeHTML(group.title)}</h3><p>${escapeHTML(group.service)} <span>· hosted by ${escapeHTML(group.host)}</span></p><div class="group-date">◷ ${formatDate(group.date)}</div><div class="group-progress"><span style="width:${percent}%"></span></div><div class="group-seats"><span>${group.joined} of ${group.capacity} students joined</span><strong>${currency(group.price)} <small>/ person</small></strong></div><button class="button ${joined ? "button-joined" : "button-outline"} group-join" type="button" data-join-group="${escapeHTML(group.id)}" ${full && !joined ? "disabled" : ""}>${joined ? "✓ You’re in — leave group" : full ? "Group is full" : "Join group · save together"}</button><button class="group-message-link" type="button" data-message="${escapeHTML(group.providerId)}">Ask ${escapeHTML(provider?.name || "provider")} a question</button></article>`;
  }).join("") : '<div class="empty-card"><strong>No open groups yet</strong><small>Start one and invite students on your campus.</small></div>';
}
function formatDate(dateString) {
  if (!dateString) return "Date to be arranged";
  return new Date(`${dateString}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseLocalAppointment(dateValue, timeValue) {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeParts = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateParts || !timeParts) return null;
  const [, year, month, day] = dateParts.map(Number);
  const [, hour, minute] = timeParts.map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const appointment = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (appointment.getFullYear() !== year || appointment.getMonth() !== month - 1
    || appointment.getDate() !== day || appointment.getHours() !== hour || appointment.getMinutes() !== minute) {
    return null;
  }
  return appointment;
}
function renderBookingList(targetId, list, options = {}) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = list.length ? list.map((booking) => {
    const provider = getProvider(booking.providerId);
    const status = booking.status;
    const providerView = options.provider || isOwnBooking(booking);
    const actions = providerView
      ? `${booking.status === "Pending" ? `<button class="button button-small button-primary" data-decision="Confirmed" data-booking-id="${escapeHTML(booking.id)}">Accept</button><button class="button button-small button-outline" data-decision="Declined" data-booking-id="${escapeHTML(booking.id)}">Decline</button>` : booking.status === "Confirmed" ? `<button class="button button-small button-outline" data-decision="Completed" data-booking-id="${escapeHTML(booking.id)}">Mark complete</button>` : `<span class="status status-${status.toLowerCase()}">${escapeHTML(status)}</span>`}<button class="subtle-button" data-message="customer:${escapeHTML(booking.id)}">Message student</button>`
      : `${status === "Completed" && !booking.reviewed ? `<button class="button button-small button-outline" data-review="${escapeHTML(booking.id)}">Leave a review</button>` : `<span class="status status-${status.toLowerCase()}">${escapeHTML(status)}</span>`}${!booking.groupId && ["Pending", "Confirmed"].includes(status) ? `<button class="subtle-button" data-decision="Cancelled" data-booking-id="${escapeHTML(booking.id)}">Cancel booking</button>` : ""}`;
    const location = status === "Confirmed" && booking.otherLocation
      ? `<div class="booking-location"><strong>${providerView ? "Customer" : "Provider"}’s hostel or campus: ${escapeHTML(booking.otherLocation)}</strong><small>Shared for this confirmed booking. Approximate distance isn’t available without map pins.</small></div>`
      : "";
    return `<article class="booking-card"><span class="booking-service-icon">${getCategoryIcon(provider?.category || "Other")}</span><div class="booking-main"><div class="booking-title-row"><strong>${escapeHTML(booking.service)}</strong><span class="booking-type-pill">${escapeHTML(booking.type || "Individual")}</span></div><span>${providerView ? `Requested by ${escapeHTML(booking.customer || "Student")}` : `with ${escapeHTML(provider?.name || "Skillmate student")}`}</span><span class="booking-date">${formatDate(booking.date)} · ${escapeHTML(booking.time || "Time to be arranged")}</span>${booking.note ? `<small class="booking-note">“${escapeHTML(booking.note)}”</small>` : ""}${location}</div><strong class="booking-price">${currency(booking.price)}</strong><div class="booking-actions">${actions}${!providerView && status !== "Completed" ? `<button class="subtle-button" data-message="${escapeHTML(booking.providerId)}">Message</button>` : ""}</div></article>`;
  }).join("") : '<div class="empty-card"><span>◷</span><strong>Nothing here just yet</strong><small>Your bookings and requests will appear here.</small></div>';
}
function renderConversations(options = {}) {
  const target = document.querySelector("#conversation-list");
  const conversations = state.messages.filter((chat) => !state.blocked.includes(chat.providerId));
  document.querySelector("#message-count").textContent = String(conversations.length);
  if (!conversations.length) {
    target.innerHTML = '<div class="empty-card"><strong>No conversations yet</strong><small>Message a provider from Discover to get started.</small></div>';
    document.querySelector("#chat-panel").innerHTML = "";
    return;
  }
  if (!conversations.some((chat) => chat.id === activeConversationId)) activeConversationId = conversations[0].id;
  target.innerHTML = `<div class="conversation-heading">YOUR CONVERSATIONS</div>${conversations.map((chat) => {
    const provider = getProvider(chat.providerId);
    const latest = chat.messages.at(-1);
    return `<button class="conversation-item ${chat.id === activeConversationId ? "conversation-active" : ""}" type="button" data-chat="${escapeHTML(chat.id)}"><span class="person-avatar avatar-${escapeHTML(provider?.color || "blue")}">${escapeHTML(provider?.initials || "SM")}</span><span class="conversation-copy"><strong>${escapeHTML(provider?.name || "Student")}</strong><small>${escapeHTML(latest?.text || "Start a conversation")}</small></span><span class="conversation-time">${escapeHTML(latest?.time || "")}</span></button>`;
  }).join("")}`;
  renderChat(options);
}
function renderChat(options = {}) {
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const provider = chat && getProvider(chat.providerId);
  const target = document.querySelector("#chat-panel");
  if (!chat || !provider) { target.innerHTML = '<div class="empty-card"><strong>Choose a conversation</strong><small>Your student-to-student messages appear here.</small></div>'; return; }
  const previousInput = options.preserveChatState ? target.querySelector('[name="message"]') : null;
  const draft = previousInput?.value || "";
  const hadFocus = previousInput === document.activeElement;
  const previousMessages = options.preserveChatState ? target.querySelector("#chat-messages") : null;
  const wasNearBottom = previousMessages
    ? previousMessages.scrollHeight - previousMessages.scrollTop - previousMessages.clientHeight < 48
    : true;
  const previousScrollTop = previousMessages?.scrollTop || 0;
  target.innerHTML = `<div class="chat-header"><span class="person-avatar avatar-${escapeHTML(provider.color || "blue")}">${escapeHTML(provider.initials)}</span><span><strong>${escapeHTML(provider.name)}</strong><small>${provider.verified ? "✓ Campus verified" : escapeHTML(provider.campus)}</small></span><button class="subtle-button" type="button" data-report="${escapeHTML(provider.id)}">Safety</button></div><div class="chat-messages" id="chat-messages">${chat.messages.map((message) => `<div class="chat-message ${message.sender === "You" ? "chat-outgoing" : ""}"><span>${escapeHTML(message.text)}</span><small>${escapeHTML(message.time)}</small></div>`).join("")}</div><form class="chat-compose" id="chat-compose"><input name="message" maxlength="500" required placeholder="Write a message..." aria-label="Message" /><button class="button button-primary button-small" type="submit">Send</button></form>`;
  const input = target.querySelector('[name="message"]');
  input.value = draft;
  if (hadFocus) input.focus({ preventScroll: true });
  const messages = document.querySelector("#chat-messages");
  messages.scrollTop = wasNearBottom ? messages.scrollHeight : previousScrollTop;
}
function renderListings() {
  const target = document.querySelector("#listing-list");
  target.innerHTML = state.services.length ? state.services.map((service) => `<article class="listing-card"><span class="service-list-icon">${getCategoryIcon(service.category)}</span><div class="listing-copy"><div class="listing-title"><strong>${escapeHTML(service.title)}</strong><span class="listing-status ${service.active ? "listing-active" : "listing-paused"}">${service.active ? "Active" : "Paused"}</span></div><small>${escapeHTML(service.category)} ${service.groups ? "· Open to groups" : ""}</small><p>${escapeHTML(service.description)}</p></div><strong class="listing-price">${currency(service.price)}</strong><div class="listing-actions"><button class="button button-small button-outline" type="button" data-edit-service="${escapeHTML(service.id)}">Edit</button><button class="subtle-button" type="button" data-toggle-service="${escapeHTML(service.id)}">${service.active ? "Pause" : "Activate"}</button></div></article>`).join("") : '<div class="empty-card"><strong>Your first service starts here</strong><small>List a skill to help students find and book you.</small><button class="button button-primary button-small" type="button" data-open="service-modal">Add a service</button></div>';
}
function renderPortfolio() {
  const target = document.querySelector("#portfolio-grid");
  target.innerHTML = state.portfolio.length ? state.portfolio.map((item) => `<article class="portfolio-item">${item.image ? `<img class="portfolio-art portfolio-image" src="${escapeHTML(item.image)}" alt="" />` : `<span class="portfolio-art">${getCategoryIcon("Design")}</span>`}<div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></div><button type="button" class="portfolio-remove" data-remove-work="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.title)}">×</button></article>`).join("") : '<div class="empty-card"><strong>Your portfolio is ready to grow</strong><small>Add examples of your best work.</small></div>';
}
function renderEarnings() {
  const completed = state.bookings.filter((booking) => isOwnBooking(booking) && booking.status === "Completed");
  const total = completed.reduce((sum, booking) => sum + Number(booking.price), 0);
  document.querySelector("#earnings-total").textContent = currency(total);
  document.querySelector("#provider-earnings").textContent = currency(total);
  renderBookingList("earnings-list", completed, { provider: true });
}
function bookingsForActiveFilter() {
  return state.bookings.filter((booking) => {
    if (activeBookingFilter === "upcoming") return ["Confirmed", "Pending"].includes(booking.status);
    if (activeBookingFilter === "requests") return booking.status === "Pending";
    if (activeBookingFilter === "completed") return booking.status === "Completed";
    return true;
  });
}
function renderBookingActivity() {
  renderBookingList("user-booking-list", bookingsForActiveFilter());
  renderBookingList("provider-booking-list", state.bookings.filter(isOwnBooking), { provider: true });
  renderEarnings();
  const completedThisMonth = state.bookings.filter((booking) => isOwnBooking(booking)
    && booking.status === "Completed" && booking.date?.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((sum, booking) => sum + Number(booking.price), 0);
  document.querySelector("#provider-earnings").textContent = currency(completedThisMonth);
  document.querySelector("#booking-count").textContent = String(
    state.bookings.filter((booking) => !["Declined", "Cancelled", "Completed"].includes(booking.status)).length,
  );
  document.querySelector("#all-booking-count").textContent = String(state.bookings.length);
  document.querySelector("#provider-request-count").textContent = String(
    state.bookings.filter((booking) => isOwnBooking(booking) && booking.status === "Pending").length,
  );
}
function renderAll() {
  document.querySelector("#marketplace-date").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date()).toUpperCase();
  document.querySelector("#provider-setup-banner").hidden = state.services.length > 0;
  renderMarketplace();
  renderGroups();
  renderBookingList("user-booking-list", bookingsForActiveFilter());
  renderBookingList("provider-booking-list", state.bookings.filter(isOwnBooking), { provider: true });
  renderListings();
  renderPortfolio();
  renderConversations();
  renderEarnings();
  const count = state.bookings.filter((booking) => !["Declined", "Cancelled", "Completed"].includes(booking.status)).length;
  document.querySelector("#booking-count").textContent = count;
  document.querySelector("#all-booking-count").textContent = state.bookings.length;
  document.querySelector("#provider-request-count").textContent = state.bookings.filter((booking) => isOwnBooking(booking) && booking.status === "Pending").length;
  document.querySelector("#active-listings-count").textContent = state.services.filter((service) => service.active).length;
  const verified = state.profile.verified;
  document.querySelector(".verified-mark").textContent = verified ? "✓" : "!";
  document.querySelector(".campus-card").classList.toggle("campus-unverified", !verified);
  document.querySelector(".trust-mini small").textContent = verified
    ? "Campus status verified"
    : "Verify to earn a campus badge";
  document.querySelector(".profile-copy strong").textContent = state.profile.name;
  document.querySelector(".profile-avatar").textContent = state.profile.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  document.querySelector(".topbar-avatar").textContent = state.profile.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const ownReviews = state.reviews.filter((review) => review.providerId === ownProviderId());
  const ownRating = ownReviews.length ? (ownReviews.reduce((sum, review) => sum + review.rating, 0) / ownReviews.length).toFixed(1) : appSupabase ? "New" : "4.9";
  const ratingStat = document.querySelectorAll(".provider-stat")[2];
  ratingStat.querySelector("strong").textContent = `${ownRating} ★`;
  ratingStat.querySelector("small").textContent = `From ${appSupabase ? ownReviews.length : 23 + ownReviews.length} student reviews`;
  if (appUser) {
    document.querySelector("#view-home h1").innerHTML = `Welcome, ${escapeHTML(state.profile.name)} <span aria-hidden="true">✦</span>`;
    document.querySelector(".campus-card strong").textContent = state.profile.university || "University not set";
    document.querySelector(".campus-card small").textContent = state.profile.course || "STUDENT ACCOUNT";
    document.querySelector(".topbar-avatar").setAttribute("aria-label", state.profile.name);
    const providerHeading = document.querySelector(".provider-profile-main");
    providerHeading.querySelector(".profile-avatar").textContent = initialsFor(state.profile.name);
    providerHeading.querySelector(".verified-pill").textContent = verified ? "✓ Campus verified" : "Campus verification pending";
    providerHeading.querySelector("h2").textContent = state.profile.name;
    providerHeading.querySelector("p").textContent = `${state.profile.bio || "Student service provider"} · ${state.profile.university || "Campus not set"}`;
    providerHeading.querySelector(".profile-tags").innerHTML = [...new Set(state.services.map((service) => service.category))]
      .slice(0, 3).map((category) => `<span>${escapeHTML(category)}</span>`).join("");
  }
  const completedThisMonth = state.bookings.filter((booking) => isOwnBooking(booking)
    && booking.status === "Completed" && booking.date?.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((sum, booking) => sum + Number(booking.price), 0);
  document.querySelector("#provider-earnings").textContent = currency(completedThisMonth);
}
function toLocalStatus(status) {
  return ({ pending: "Pending", confirmed: "Confirmed", declined: "Declined", completed: "Completed", cancelled: "Cancelled" })[status] || status;
}
function toDatabaseStatus(status) {
  return ({ Pending: "pending", Confirmed: "confirmed", Declined: "declined", Completed: "completed", Cancelled: "cancelled" })[status] || status.toLowerCase();
}
async function refreshSupabaseState() {
  const [
    ownProfile, directory, ownServices, bookings, groups, joinedGroups, userLocations,
    savedServices, blocks, ownReviews, ownPortfolio, portfolioDirectory, conversationDirectory,
    verification,
  ] = await Promise.all([
    appSupabase.from("profiles").select("id, full_name, university, course, bio, campus_verified, university_email, role").eq("id", appUser.id).single(),
    appSupabase.from("provider_directory").select("*"),
    appSupabase.from("services").select("*").eq("provider_id", appUser.id).order("created_at", { ascending: false }),
    appSupabase.from("booking_directory").select("*").order("scheduled_at", { ascending: true }),
    appSupabase.from("group_directory").select("*").in("status", ["open", "full"]).order("scheduled_at", { ascending: true }),
    appSupabase.from("group_booking_members").select("group_booking_id").eq("student_id", appUser.id),
    appSupabase.from("user_locations").select("user_id, location_name"),
    appSupabase.from("saved_services").select("service_id"),
    appSupabase.from("user_blocks").select("blocked_id").eq("blocker_id", appUser.id),
    appSupabase.from("reviews").select("booking_id, provider_id, rating, body, created_at"),
    appSupabase.from("portfolio_items").select("*").eq("provider_id", appUser.id).order("created_at", { ascending: false }),
    appSupabase.from("portfolio_items").select("provider_id, title").order("created_at", { ascending: false }),
    appSupabase.from("conversation_directory").select("conversation_id, other_user_id, other_user_name"),
    appSupabase.from("verification_requests").select("id, status").eq("student_id", appUser.id).eq("status", "open").maybeSingle(),
  ]);
  const results = [ownProfile, directory, ownServices, bookings, groups, joinedGroups, userLocations, savedServices, blocks, ownReviews, ownPortfolio, portfolioDirectory, conversationDirectory, verification];
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;

  const profile = ownProfile.data;
  document.querySelector("#admin-link").hidden = profile.role !== "admin";
  state.profile = {
    name: profile.full_name, university: profile.university, course: profile.course,
    bio: profile.bio, email: profile.university_email || appUser.email, verified: profile.campus_verified,
    location: (userLocations.data || []).find((item) => item.user_id === appUser.id)?.location_name || "",
  };
  connectedServices = (directory.data || []).map((row) => ({
    id: row.service_id, providerId: row.provider_id, title: row.service_title, category: row.category,
    description: row.service_description, price: Number(row.price), groups: row.accepts_groups,
    active: true, currency: row.currency,
  })).concat((ownServices.data || []).filter((service) => !(directory.data || []).some((row) => row.service_id === service.id)).map((service) => ({
    id: service.id, providerId: service.provider_id, title: service.title, category: service.category,
    description: service.description, price: Number(service.price), groups: service.accepts_groups,
    active: service.is_active, currency: service.currency,
  })));
  const providerMap = new Map();
  for (const row of directory.data || []) {
    if (!providerMap.has(row.provider_id)) providerMap.set(row.provider_id, {
      id: row.provider_id, name: row.full_name, initials: initialsFor(row.full_name), campus: row.university || "Campus not set",
      course: row.course || "Student", category: row.category, service: row.service_title,
      description: row.service_description, price: Number(row.price), currency: row.currency,
      rating: 0, reviews: 0, bookings: 0, color: "blue", verified: row.campus_verified,
      available: "Message to ask", groups: row.accepts_groups, portfolio: [],
    });
  }
  connectedProviders = [...providerMap.values()];
  for (const item of portfolioDirectory.data || []) {
    const provider = providerMap.get(item.provider_id);
    if (provider) provider.portfolio.push(item.title);
  }
  state.bookings = (bookings.data || []).map((booking) => {
    const otherUserId = booking.customer_id === appUser.id ? booking.provider_id : booking.customer_id;
    const status = toLocalStatus(booking.status);
    return {
      id: booking.id, providerId: booking.provider_id, customerId: booking.customer_id,
      customer: booking.customer_name || "Student", service: booking.service_title || "Service",
      category: booking.category || "Other", price: Number(booking.agreed_price),
      currency: booking.currency, date: booking.scheduled_at.slice(0, 10),
      time: new Date(booking.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      status, otherLocation: status === "Confirmed"
        ? (userLocations.data || []).find((item) => item.user_id === otherUserId)?.location_name || ""
        : "",
      type: booking.group_booking_id ? "Group booking" : "Individual",
      groupId: booking.group_booking_id, note: booking.note,
      reviewed: (ownReviews.data || []).some((review) => review.booking_id === booking.id),
    };
  });
  const joinedSet = new Set((joinedGroups.data || []).map((item) => item.group_booking_id));
  state.groups = (groups.data || []).map((group) => ({
    id: group.id, hostId: group.host_id, providerId: group.provider_id, serviceId: group.service_id,
    service: group.service_title, title: group.title, host: group.host_name,
    date: group.scheduled_at.slice(0, 10), capacity: group.capacity, joined: group.member_count,
    price: Number(group.proposed_price_per_person), status: group.status === "full" ? "Full" : "Open", joinedByMe: joinedSet.has(group.id),
    inviteMessage: group.invite_message,
  }));
  state.joinedGroups = [...joinedSet];
  state.saved = connectedServices.filter((service) => (savedServices.data || []).some((item) => item.service_id === service.id)).map((service) => service.providerId);
  state.saved = [...new Set(state.saved)];
  state.blocked = (blocks.data || []).map((block) => block.blocked_id);
  state.reviews = (ownReviews.data || []).map((review) => ({
    bookingId: review.booking_id, providerId: review.provider_id, rating: review.rating, text: review.body, date: review.created_at,
  }));
  for (const provider of connectedProviders) {
    const reviews = state.reviews.filter((review) => review.providerId === provider.id);
    provider.rating = reviews.length
      ? reviews.reduce((total, review) => total + Number(review.rating), 0) / reviews.length
      : 0;
    provider.reviews = reviews.length;
  }
  state.services = (ownServices.data || []).map((service) => ({
    id: service.id, title: service.title, category: service.category, price: Number(service.price),
    description: service.description, groups: service.accepts_groups, active: service.is_active,
  }));
  state.portfolio = (ownPortfolio.data || []).map((item) => ({
    id: item.id, title: item.title, description: item.description,
    imagePath: item.image_path || "",
    image: item.image_path ? appSupabase.storage.from("portfolio-images").getPublicUrl(item.image_path).data.publicUrl : "",
  }));

  const conversations = conversationDirectory.data || [];
  const messages = await Promise.all(conversations.map(async (conversation) => {
    const { data, error } = await appSupabase.from("messages").select("id, sender_id, body, created_at")
      .eq("conversation_id", conversation.conversation_id).order("created_at", { ascending: true });
    if (error) throw error;
    return {
      id: conversation.conversation_id, providerId: conversation.other_user_id, name: conversation.other_user_name,
      messages: (data || []).map((message) => ({
        sender: message.sender_id === appUser.id ? "You" : conversation.other_user_name,
        text: message.body,
        time: new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      })),
    };
  }));
  state.messages = messages;
  const verificationButton = document.querySelector("#verification-open");
  verificationButton.dataset.requested = verification.data?.status || "";
  const reportTarget = document.querySelector("#report-target");
  reportTarget.innerHTML = '<option value="">Choose a student</option>' + connectedProviders
    .filter((provider) => provider.id !== appUser.id)
    .map((provider) => `<option value="${escapeHTML(provider.id)}">${escapeHTML(provider.name)}</option>`).join("");
}
async function refreshLiveBookings() {
  const [bookings, userLocations, ownReviews] = await Promise.all([
    appSupabase.from("booking_directory").select("*").order("scheduled_at", { ascending: true }),
    appSupabase.from("user_locations").select("user_id, location_name"),
    appSupabase.from("reviews").select("booking_id"),
  ]);
  for (const result of [bookings, userLocations, ownReviews]) {
    if (result.error) throw result.error;
  }
  state.bookings = (bookings.data || []).map((booking) => {
    const otherUserId = booking.customer_id === appUser.id ? booking.provider_id : booking.customer_id;
    const status = toLocalStatus(booking.status);
    return {
      id: booking.id, providerId: booking.provider_id, customerId: booking.customer_id,
      customer: booking.customer_name || "Student", service: booking.service_title || "Service",
      category: booking.category || "Other", price: Number(booking.agreed_price),
      currency: booking.currency, date: booking.scheduled_at.slice(0, 10),
      time: new Date(booking.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      status, otherLocation: status === "Confirmed"
        ? (userLocations.data || []).find((item) => item.user_id === otherUserId)?.location_name || ""
        : "",
      type: booking.group_booking_id ? "Group booking" : "Individual",
      groupId: booking.group_booking_id, note: booking.note,
      reviewed: (ownReviews.data || []).some((review) => review.booking_id === booking.id),
    };
  });
  renderBookingActivity();
}
async function refreshLiveMessages() {
  const { data: conversations, error: conversationsError } = await appSupabase
    .from("conversation_directory")
    .select("conversation_id, other_user_id, other_user_name");
  if (conversationsError) throw conversationsError;
  state.messages = await Promise.all((conversations || []).map(async (conversation) => {
    const { data, error } = await appSupabase.from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversation.conversation_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return {
      id: conversation.conversation_id,
      providerId: conversation.other_user_id,
      name: conversation.other_user_name,
      messages: (data || []).map((message) => ({
        sender: message.sender_id === appUser.id ? "You" : conversation.other_user_name,
        text: message.body,
        time: new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      })),
    };
  }));
  renderConversations({ preserveChatState: true });
}
async function refreshLiveActivity() {
  if (!appSupabase || !appUser || document.hidden || pendingActionCount || activityRefreshInProgress) return;
  activityRefreshInProgress = true;
  try {
    await refreshLiveBookings();
    if (state.activePage === "messages") await refreshLiveMessages();
  } finally {
    activityRefreshInProgress = false;
  }
}
function initialsFor(name = "Student") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
async function persistBookingStatus(bookingId, status) {
  const { error } = await appSupabase.rpc("update_booking_status", {
    p_booking_id: bookingId, p_status: toDatabaseStatus(status),
  });
  if (error) throw error;
  await refreshSupabaseState();
  renderAll();
}
async function runAction(action, failureMessage, loadingMessage = "Saving your changes…") {
  const loadingIndicator = document.querySelector("#loading-indicator");
  const loadingLabel = document.querySelector("#loading-label");
  pendingActionCount += 1;
  loadingLabel.textContent = loadingMessage;
  loadingIndicator.hidden = false;
  document.querySelector("#app-shell").setAttribute("aria-busy", "true");
  try {
    await action();
  } catch (error) {
    console.error(failureMessage, error);
    showToast(error?.message || failureMessage);
  } finally {
    pendingActionCount = Math.max(0, pendingActionCount - 1);
    if (!pendingActionCount) {
      loadingIndicator.hidden = true;
      document.querySelector("#app-shell").removeAttribute("aria-busy");
    }
  }
}
function showConnectedApp() {
  const status = document.querySelector("#app-auth-status");
  status.hidden = true;
  document.body.classList.remove("app-auth-pending");
  document.querySelector("#app-shell").hidden = false;
}
function initializeDashboard() {
  const modeSwitch = document.querySelector("#mode-switch");
  const syncModeSwitchLabel = () => {
    const offering = modeSwitch.getAttribute("aria-pressed") === "true";
    const label = offering ? "Switch to finding services" : "Switch to offering services";
    modeSwitch.setAttribute("aria-label", label);
    modeSwitch.title = label;
  };
  document.querySelector(".demo-pill").textContent = appSupabase ? "CONNECTED ACCOUNT" : "DEMO · LOCAL DATA";
  document.querySelector("#signout-button").hidden = !appSupabase;
  if (!appSupabase) {
    state.profile.verified = false;
    seedProviders.forEach((provider) => { provider.verified = false; });
    document.querySelector("#safety-modal .modal-footnote").textContent = "Demo reports remain in this browser and are not sent to a safety team.";
  }
  populateServiceSelects();
  updateGroupPrice();
  renderAll();
  if (state.activePage && state.activePage !== "home") showPage(state.activePage);
  if (state.mode === "offer") {
    modeSwitch.setAttribute("aria-pressed", "true");
    document.querySelector("#mode-switch-label").textContent = "Find services";
    document.querySelector("#mode-switch-short").textContent = "Find";
    document.querySelector("#mode-heading").textContent = "Need a hand with something on campus?";
    document.querySelector("#mode-description").textContent = "Browse student services, compare prices, and find someone to help.";
    document.querySelector("#banner-mode-button").textContent = "Browse services →";
    showPage("provider");
  }
  syncModeSwitchLabel();
  modeSwitch.addEventListener("click", () => window.setTimeout(syncModeSwitchLabel, 0));
}
async function bootstrapStudentApp() {
  if (!appSupabase) {
    throw new Error(window.skillmateSupabaseError
      || "Skillmate could not connect to Supabase. Start the Express server and check its .env configuration.");
  }
  const { data, error } = await appSupabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    window.location.replace("login.html");
    return;
  }
  await window.syncSkillmateServerSession(data.session);
  appUser = data.session.user;
  await refreshSupabaseState();
  initializeDashboard();
  document.querySelector("#profile-name").value = state.profile.name;
  document.querySelector("#profile-bio").value = state.profile.bio;
  document.querySelector("#profile-email").value = state.profile.email;
  document.querySelector(".campus-card strong").textContent = state.profile.university || "Your campus";
  document.querySelector(".campus-card small").textContent = state.profile.course || "Student account";
  document.querySelector("#booking-count").textContent = String(
    state.bookings.filter((booking) => !["Declined", "Cancelled", "Completed"].includes(booking.status)).length,
  );
  document.querySelector("#message-count").textContent = String(state.messages.length);
  showConnectedApp();
  appSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.clearSkillmateServerSession()
        .catch((sessionError) => console.error("Could not clear the secure Skillmate session.", sessionError))
        .finally(() => window.location.replace("login.html"));
    }
    if (event === "TOKEN_REFRESHED" && session) {
      window.syncSkillmateServerSession(session).catch((syncError) => {
        console.error("Could not refresh the secure Skillmate session.", syncError);
      });
    }
  });
  window.setInterval(() => {
    refreshLiveActivity().catch((error) => console.error("Could not refresh Skillmate messages and bookings.", error));
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshLiveActivity().catch((error) => console.error("Could not refresh Skillmate messages and bookings.", error));
    }
  });
}
function showPage(page) {
  const view = document.querySelector(`[data-view="${page}"]`);
  if (!view) return;
  state.activePage = page;
  saveState();
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active-view", element === view));
  document.querySelectorAll(".side-nav .nav-link[data-page]").forEach((element) => element.classList.toggle("active", element.dataset.page === page));
  document.querySelector("#breadcrumb-title").textContent = {
    home: "Discover", bookings: "My bookings", messages: "Messages", saved: "Saved providers", provider: "My services", earnings: "Earnings",
  }[page];
  closeSidebar(sidebar.contains(document.activeElement));
  if (page === "saved") renderMarketplace("saved-grid", (appSupabase ? connectedProviders : seedProviders).filter((provider) => state.saved.includes(provider.id)));
  if (page === "messages") renderConversations();
  if (page === "provider") { renderListings(); renderPortfolio(); renderBookingList("provider-booking-list", state.bookings.filter(isOwnBooking), { provider: true }); }
  if (page === "earnings") renderEarnings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function openBooking(providerId) {
  const provider = getProvider(providerId);
  const services = providerServices(providerId);
  if (!provider || !services.length) { showToast("This provider hasn’t listed an active service yet."); return; }
  document.querySelector("#booking-provider-id").value = providerId;
  document.querySelector("#booking-description").textContent = `Choose a service from ${provider.name}. You can confirm the details together in messages.`;
  document.querySelector("#booking-service").innerHTML = services.map((service) => `<option value="${escapeHTML(service.id)}">${escapeHTML(service.title)} · ${currency(service.price)}</option>`).join("");
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  document.querySelector("#booking-date").min = localDateInputValue();
  document.querySelector("#booking-date").value = localDateInputValue(tomorrow);
  openModal("booking-modal");
}
function openProviderProfile(providerId) {
  const provider = getProvider(providerId);
  if (!provider) return;
  const rating = providerReviewSummary(provider);
  const services = providerServices(providerId);
  const profile = document.querySelector("#provider-detail-content");
  profile.innerHTML = `
    <div class="detail-profile-heading">
      <span class="provider-avatar avatar-${escapeHTML(provider.color)}">${escapeHTML(provider.initials)}</span>
      <div><span class="verified-pill">${provider.verified ? "✓ Campus verified" : "Campus verification pending"}</span><h2>${escapeHTML(provider.name)}</h2><p>${escapeHTML(provider.course)} · ${escapeHTML(provider.campus)}</p></div>
    </div>
    <div class="detail-rating"><strong>★ ${escapeHTML(rating.rating)}</strong><span>${rating.count} student reviews</span></div>
    <section class="detail-section"><h3>Services</h3>${services.map((service) => `<div class="detail-service"><span><strong>${escapeHTML(service.title)}</strong><small>${escapeHTML(service.category)} · ${currency(service.price)} per session</small></span>${service.groups ? '<span class="detail-group-tag">Group bookings welcome</span>' : ""}</div>`).join("")}</section>
    <section class="detail-section"><h3>About</h3><p>${escapeHTML(provider.description)}</p><div class="detail-facts"><span>Availability</span><strong>${escapeHTML(provider.available)}</strong><span>Completed bookings</span><strong>${provider.bookings}</strong></div></section>
    <section class="detail-section"><h3>Portfolio highlights</h3><div class="detail-portfolio">${(provider.portfolio || []).map((item) => `<span>${escapeHTML(item)}</span>`).join("")}</div></section>`;
  document.querySelector("#provider-detail-title").textContent = provider.service;
  document.querySelector("#provider-detail-book").dataset.book = providerId;
  document.querySelector("#provider-detail-message").dataset.message = providerId;
  document.querySelector("#provider-detail-report").dataset.report = providerId;
  openModal("provider-detail-modal");
}
function openMessage(providerId, messageFor = "provider") {
  const provider = providerId.startsWith("customer:") ? getProvider(providerId) : getProvider(providerId);
  if (!provider || state.blocked.includes(providerId)) { showToast("You can’t message this student."); return; }
  document.querySelector("#message-provider-id").value = providerId;
  document.querySelector("#message-modal-title").textContent = `Message ${provider.name}`;
  document.querySelector("#message-modal-description").textContent = messageFor === "customer"
    ? `Coordinate your appointment for ${provider.service || "your booking"}.`
    : `Ask about ${provider.service || "their services"} or find a time that works.`;
  document.querySelector("#message-first-text").value = "";
  openModal("message-modal");
}
async function startConversation(providerId, text) {
  if (appSupabase) {
    let otherUserId = providerId;
    let bookingId = null;
    if (providerId.startsWith("customer:")) {
      const booking = state.bookings.find((item) => item.id === providerId.slice("customer:".length));
      if (!booking?.customerId) throw new Error("The customer for this booking could not be identified.");
      otherUserId = booking.customerId;
      bookingId = booking.id;
    }
    if (state.blocked.includes(otherUserId)) throw new Error("You can’t message this student.");
    const { data: conversationId, error: conversationError } = await appSupabase.rpc("start_conversation", {
      p_other_user_id: otherUserId, p_booking_id: bookingId,
    });
    if (conversationError) throw conversationError;
    const { error: messageError } = await appSupabase.from("messages").insert({
      conversation_id: conversationId, sender_id: appUser.id, body: text,
    });
    if (messageError) throw messageError;
    activeConversationId = conversationId;
    await refreshSupabaseState();
    return;
  }
  let chat = state.messages.find((item) => item.providerId === providerId);
  if (!chat) {
    chat = { id: `chat-${providerId}-${Date.now()}`, providerId, messages: [] };
    state.messages.unshift(chat);
  }
  chat.messages.push({ sender: "You", text, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
  activeConversationId = chat.id;
  saveState();
}
function openReport(providerId) {
  const provider = getProvider(providerId);
  if (!provider) return;
  const targetSelect = document.querySelector("#report-target");
  if (![...targetSelect.options].some((option) => option.value === providerId)) {
    const option = document.createElement("option");
    option.value = providerId;
    option.textContent = provider.name;
    targetSelect.append(option);
  }
  document.querySelector("#report-provider-id").value = providerId;
  targetSelect.value = providerId;
  document.querySelector("#report-description").textContent = appSupabase
    ? `Share a concern about ${provider.name}. Only the safety team can review your report.`
    : `Share a concern about ${provider.name}. Your report is recorded locally in this demo.`;
  document.querySelector("#report-details").value = "";
  document.querySelector("#report-block").checked = false;
  openModal("report-modal");
}
function renderBlocked() {
  const target = document.querySelector("#blocked-list");
  target.innerHTML = state.blocked.length ? state.blocked.map((id) => {
    const provider = getProvider(id);
    return `<div class="blocked-person"><span>${escapeHTML(provider?.name || id)}</span><button type="button" class="button button-small button-outline" data-unblock="${escapeHTML(id)}">Unblock</button></div>`;
  }).join("") : '<div class="empty-card"><strong>No blocked students</strong><small>Students you block will be listed here.</small></div>';
}
function populateServiceSelects() {
  const options = appSupabase
    ? connectedServices.filter((service) => service.active && service.groups && service.providerId !== appUser.id).map((service) => `<option value="${escapeHTML(service.id)}">${escapeHTML(service.title)} · ${currency(service.price)} · ${escapeHTML(getProvider(service.providerId)?.name || "Student")}</option>`).join("")
    : seedProviders.map((provider) => `<option value="${escapeHTML(provider.id)}">${escapeHTML(provider.service)} · ${currency(provider.price)} · ${escapeHTML(provider.name)}</option>`).join("");
  document.querySelector("#group-service").innerHTML = options;
}
function addGroup(group) {
  state.groups.unshift(group);
  saveState();
  renderGroups();
}

document.querySelectorAll(".side-nav .nav-link[data-page]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  showPage(link.dataset.page);
}));
document.querySelectorAll("[data-page-link]").forEach((button) => button.addEventListener("click", () => showPage(button.dataset.pageLink)));
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open]");
  if (!button) return;
  const modalId = button.dataset.open;
  if (modalId === "blocked-modal") renderBlocked();
  if (modalId === "report-modal") {
    document.querySelector("#report-provider-id").value = "";
    document.querySelector("#report-target").value = "";
    document.querySelector("#report-description").textContent = appSupabase
      ? "Tell us who the report is about and what happened. The safety team will review your report."
      : "Tell us who the report is about and what happened. Your report is recorded locally in this demo.";
    document.querySelector("#report-details").value = "";
    document.querySelector("#report-block").checked = false;
  }
  if (modalId === "group-modal") {
    const date = document.querySelector("#group-date");
    const today = localDateInputValue();
    date.min = today;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    date.value = localDateInputValue(tomorrow);
    updateGroupPrice();
  }
  openModal(modalId);
});
document.querySelector("#report-target").addEventListener("change", (event) => {
  document.querySelector("#report-provider-id").value = event.target.value;
  const provider = getProvider(event.target.value);
  document.querySelector("#report-description").textContent = provider
    ? appSupabase ? `Share a concern about ${provider.name}. Only the safety team can review your report.` : `Share a concern about ${provider.name}. Your report is recorded locally in this demo.`
    : appSupabase ? "Tell us who the report is about and what happened. The safety team will review your report." : "Tell us who the report is about and what happened. Your report is recorded locally in this demo.";
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => closeModal(button)));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));
document.querySelector("#category-strip").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  document.querySelectorAll(".category-chip").forEach((chip) => {
    const selected = chip.dataset.category === selectedCategory;
    chip.classList.toggle("selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
  });
  renderMarketplace();
});
document.querySelector("#global-search").addEventListener("input", () => {
  if (document.querySelector("#global-search").value.trim() && state.activePage !== "home") showPage("home");
  renderMarketplace();
  renderSearchSuggestions();
});
const globalSearch = document.querySelector("#global-search");
globalSearch.addEventListener("focus", () => {
  document.body.classList.add("search-open");
  globalSearch.setAttribute("aria-expanded", "true");
  renderSearchSuggestions();
});
globalSearch.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (document.querySelector("#search-suggestions").contains(document.activeElement)) return;
    document.body.classList.remove("search-open");
    globalSearch.setAttribute("aria-expanded", "false");
    renderSearchSuggestions();
  }, 0);
});
document.querySelector("#search-suggestions").addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-search-suggestion]")) event.preventDefault();
});
document.querySelector("#search-suggestions").addEventListener("click", (event) => {
  const suggestion = event.target.closest("[data-search-suggestion]");
  if (!suggestion) return;
  globalSearch.value = suggestion.dataset.searchSuggestion;
  globalSearch.dispatchEvent(new Event("input", { bubbles: true }));
  globalSearch.focus();
});
menuToggle.addEventListener("click", () => {
  const isOpen = sidebar.classList.toggle("open");
  document.body.classList.toggle("sidebar-open", isOpen);
  sidebarBackdrop.hidden = !isOpen;
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  if (isOpen) sidebar.querySelector(".side-nav .nav-link").focus();
});
sidebarBackdrop.addEventListener("click", () => closeSidebar(true));
document.querySelector("#mode-switch").addEventListener("click", () => {
  state.mode = state.mode === "find" ? "offer" : "find";
  saveState();
  const offer = state.mode === "offer";
  document.querySelector("#mode-switch").setAttribute("aria-pressed", String(offer));
  document.querySelector("#mode-switch-label").textContent = offer ? "Find services" : "Earn with skills";
  document.querySelector("#mode-switch-short").textContent = offer ? "Find" : "Earn";
  document.querySelector("#mode-switch").setAttribute("aria-label", offer ? "Switch to finding services" : "Switch to offering services");
  document.querySelector("#mode-heading").textContent = offer ? "Need a hand with something on campus?" : "Good at something? Make it your side hustle.";
  document.querySelector("#mode-description").textContent = offer ? "Browse student services, compare prices, and find someone to help." : "Create a profile, list your service, and accept bookings from other students.";
  document.querySelector("#banner-mode-button").textContent = offer ? "Browse services →" : "Set up your profile →";
  showPage(offer ? "provider" : "home");
});
document.querySelector("#banner-mode-button").addEventListener("click", () => showPage(state.mode === "offer" ? "home" : "provider"));
document.querySelector("#marketplace-grid").addEventListener("click", handleCardAction);
document.querySelector("#saved-grid").addEventListener("click", handleCardAction);
document.querySelector("#provider-detail-modal").addEventListener("click", (event) => {
  const button = event.target.closest("[data-book], [data-message], [data-report]");
  if (!button) return;
  if (button.dataset.book) { document.querySelector("#provider-detail-modal").close(); openBooking(button.dataset.book); }
  if (button.dataset.message) { document.querySelector("#provider-detail-modal").close(); openMessage(button.dataset.message); }
  if (button.dataset.report) openReport(button.dataset.report);
});
function handleCardAction(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.book) openBooking(button.dataset.book);
  if (button.dataset.message) openMessage(button.dataset.message);
  if (button.dataset.report) openReport(button.dataset.report);
  if (button.dataset.profile) {
    openProviderProfile(button.dataset.profile);
  }
  if (button.dataset.save) {
    const id = button.dataset.save;
    if (pendingProviderSaves.has(id)) {
      showToast("This provider is already being saved. Please wait.");
      return;
    }
    const saving = !state.saved.includes(id);
    pendingProviderSaves.add(id);
    setProviderSaveButtonsBusy(id, true);
    void runAction(async () => {
      if (appSupabase) {
        const services = connectedServices.filter((service) => service.providerId === id);
        const changes = await Promise.all(services.map((service) => saving
          ? appSupabase.from("saved_services").upsert(
            { user_id: appUser.id, service_id: service.id },
            { onConflict: "user_id,service_id", ignoreDuplicates: true },
          )
          : appSupabase.from("saved_services").delete().eq("user_id", appUser.id).eq("service_id", service.id)));
        const failed = changes.find((result) => result.error);
        if (failed) throw failed.error;
        await refreshSupabaseState();
        renderAll();
      } else {
        state.saved = saving
          ? [...new Set([...state.saved, id])]
          : state.saved.filter((savedId) => savedId !== id);
        saveState();
        renderMarketplace();
        if (state.activePage === "saved") {
          renderMarketplace("saved-grid", (appSupabase ? connectedProviders : seedProviders)
            .filter((provider) => state.saved.includes(provider.id)));
        }
      }
      showToast(saving ? "Provider saved to your shortlist." : "Provider removed from saved.");
    }, "Could not update your saved providers.", saving ? "Saving provider…" : "Updating saved providers…")
      .finally(() => {
        pendingProviderSaves.delete(id);
        setProviderSaveButtonsBusy(id, false);
      });
  }
}
function setProviderSaveButtonsBusy(providerId, busy) {
  document.querySelectorAll(".save-button[data-save]").forEach((button) => {
    if (button.dataset.save !== providerId) return;
    button.disabled = busy;
    button.classList.toggle("is-saving", busy);
    if (busy) {
      button.setAttribute("aria-busy", "true");
      button.setAttribute("aria-label", "Saving provider");
    } else {
      button.removeAttribute("aria-busy");
      button.setAttribute("aria-label", state.saved.includes(providerId) ? "Remove saved provider" : "Save provider");
    }
  });
}
document.querySelector("#group-grid").addEventListener("click", (event) => {
  const messageButton = event.target.closest("[data-message]");
  if (messageButton) { openMessage(messageButton.dataset.message, "customer"); return; }
  const button = event.target.closest("[data-join-group]");
  if (!button) return;
  const group = state.groups.find((item) => item.id === button.dataset.joinGroup);
  if (!group) return;
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.rpc(group.joinedByMe ? "leave_group_booking" : "join_group_booking", { p_group_id: group.id });
      if (error) throw error;
      await refreshSupabaseState();
      renderAll();
      showToast(group.joinedByMe
        ? group.hostId === appUser.id
          ? "You cancelled the group booking. Members and the provider have been notified."
          : "You’ve left the group. Your place is free for another student."
        : "You’re in! Message the host to coordinate your group booking.");
    }, "Could not update your group booking.");
    return;
  }
  const joined = state.joinedGroups.includes(group.id);
  if (joined) {
    state.joinedGroups = state.joinedGroups.filter((id) => id !== group.id);
    group.joined = Math.max(1, group.joined - 1);
    state.bookings = state.bookings.filter((booking) => booking.groupId !== group.id);
    showToast("You’ve left the group. Your place is free for another student.");
  } else if (group.joined < group.capacity) {
    state.joinedGroups.push(group.id);
    group.joined += 1;
    state.bookings.unshift({
      id: `booking-${Date.now()}`, groupId: group.id, providerId: group.providerId,
      service: group.service, price: group.price, date: group.date, time: "Time to be arranged",
      status: "Pending", type: "Group booking", customer: state.profile.name,
      note: `Joined ${group.title}`, reviewed: false,
    });
    showToast("You’re in! Message the host to coordinate your group booking.");
  }
  saveState();
  renderAll();
});
document.querySelector("#booking-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const providerId = document.querySelector("#booking-provider-id").value;
  const service = providerServices(providerId).find((item) => item.id === document.querySelector("#booking-service").value);
  if (!service) { showToast("Choose an available service first."); return; }
  const appointmentDate = document.querySelector("#booking-date").value;
  const appointmentTime = document.querySelector("#booking-time").value;
  const scheduledAt = parseLocalAppointment(appointmentDate, appointmentTime);
  if (!scheduledAt || scheduledAt <= new Date()) {
    showToast("Choose a future appointment date and time.");
    return;
  }
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.from("bookings").insert({
        service_id: service.id, customer_id: appUser.id, provider_id: providerId,
        scheduled_at: scheduledAt.toISOString(), note: document.querySelector("#booking-note").value.trim(),
        agreed_price: service.price, currency: service.currency || "GHS",
      });
      if (error) throw error;
      await refreshSupabaseState();
      event.target.closest("dialog").close();
      renderAll();
      showPage("bookings");
      showToast("Booking request sent. You can track it in My bookings.");
    }, "Could not send the booking request.");
    return;
  }
  state.bookings.unshift({
    id: `booking-${Date.now()}`, providerId, service: service.title, price: Number(service.price),
    date: appointmentDate, time: scheduledAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    status: "Pending", type: "Individual", note: document.querySelector("#booking-note").value.trim(), reviewed: false, customer: state.profile.name,
  });
  saveState();
  event.target.closest("dialog").close();
  renderAll();
  showPage("bookings");
  showToast("Booking request sent. Your booking record is saved on this device.");
});
document.querySelector("#group-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const serviceId = document.querySelector("#group-service").value;
  const service = appSupabase
    ? connectedServices.find((item) => item.id === serviceId)
    : providerServices(serviceId)[0];
  const providerId = service?.providerId || serviceId;
  const provider = getProvider(providerId);
  const date = document.querySelector("#group-date").value;
  if (!provider || !service || !date) return;
  const scheduledAt = parseLocalAppointment(date, "12:00");
  if (!scheduledAt || scheduledAt <= new Date()) {
    showToast("Choose a future group booking date.");
    return;
  }
  const groupPrice = Number(document.querySelector("#group-price").value);
  if (!Number.isFinite(groupPrice) || groupPrice < 1) { showToast("Enter a valid proposed price per student."); return; }
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.rpc("create_group_booking", {
        p_service_id: service.id, p_title: document.querySelector("#group-message").value.trim() || `${service.title} group booking`,
        p_invite_message: document.querySelector("#group-message").value.trim(),
        p_scheduled_at: scheduledAt.toISOString(), p_capacity: Number(document.querySelector("#group-capacity").value),
        p_price: groupPrice,
      });
      if (error) throw error;
      await refreshSupabaseState();
      event.target.closest("dialog").close();
      renderAll();
      showToast("Group booking created. You’re the host!");
    }, "Could not create the group booking.");
    return;
  }
  const groupId = `group-${Date.now()}`;
  addGroup({ id: groupId, providerId, service: service.title, title: document.querySelector("#group-message").value.trim() || `${service.title} group booking`, host: state.profile.name, date, capacity: Number(document.querySelector("#group-capacity").value), joined: 1, price: groupPrice, status: "Open" });
  state.joinedGroups.push(groupId);
  state.bookings.unshift({
    id: `booking-${Date.now()}`, groupId, providerId, service: service.title,
    price: groupPrice, date, time: "Time to be arranged", customer: state.profile.name,
    status: "Pending", type: "Group booking", customer: state.profile.name,
    note: "Hosting this group booking", reviewed: false,
  });
  saveState();
  event.target.closest("dialog").close();
  renderAll();
  showToast("Group booking created. You’re the host!");
});
document.querySelector("#message-form").addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(async () => {
    await startConversation(document.querySelector("#message-provider-id").value, document.querySelector("#message-first-text").value.trim());
    event.target.closest("dialog").close();
    renderConversations();
    showPage("messages");
    showToast("Conversation started.");
  }, "Could not send your message.");
});
document.querySelector("#conversation-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-chat]");
  if (!button) return;
  activeConversationId = button.dataset.chat;
  renderConversations();
});
document.querySelector("#chat-panel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-report]");
  if (button) openReport(button.dataset.report);
});
document.querySelector("#chat-panel").addEventListener("submit", (event) => {
  if (event.target.id !== "chat-compose") return;
  event.preventDefault();
  const text = new FormData(event.target).get("message").toString().trim();
  if (!text) return;
  const chat = state.messages.find((item) => item.id === activeConversationId);
  if (!chat) return;
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.from("messages").insert({
        conversation_id: chat.id, sender_id: appUser.id, body: text,
      });
      if (error) throw error;
      await refreshSupabaseState();
      renderConversations();
    }, "Could not send your message.");
    return;
  }
  chat.messages.push({ sender: "You", text, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
  saveState();
  renderConversations();
});
document.querySelector("#service-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#service-id").value || `service-${Date.now()}`;
  const existing = state.services.find((service) => service.id === id);
  const service = {
    id, title: document.querySelector("#service-title").value.trim(),
    category: document.querySelector("#service-category").value,
    price: Number(document.querySelector("#service-price").value),
    description: document.querySelector("#service-description").value.trim(),
    groups: document.querySelector("#service-group").checked, active: existing?.active ?? true,
  };
  if (appSupabase) {
    runAction(async () => {
      const payload = {
        provider_id: appUser.id, title: service.title, category: service.category,
        price: service.price, description: service.description, accepts_groups: service.groups,
      };
      const result = existing
        ? await appSupabase.from("services").update(payload).eq("id", id).eq("provider_id", appUser.id)
        : await appSupabase.from("services").insert(payload);
      if (result.error) throw result.error;
      await refreshSupabaseState();
      populateServiceSelects();
      event.target.closest("dialog").close();
      event.target.reset();
      document.querySelector("#service-id").value = "";
      document.querySelector("#service-modal-title").textContent = "Add a service";
      renderAll();
      showToast(existing ? "Service updated." : "Your service is now listed.");
    }, "Could not save your service.");
    return;
  }
  if (existing) Object.assign(existing, service);
  else state.services.unshift(service);
  saveState();
  event.target.closest("dialog").close();
  event.target.reset();
  document.querySelector("#service-id").value = "";
  document.querySelector("#service-modal-title").textContent = "Add a service";
  document.querySelector("#provider-setup-banner").hidden = state.services.length > 0;
  renderListings();
  showToast(existing ? "Service updated." : "Your service is live in your demo profile.");
});
document.querySelector("#listing-list").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-service]");
  const toggle = event.target.closest("[data-toggle-service]");
  if (edit) {
    const service = state.services.find((item) => item.id === edit.dataset.editService);
    if (!service) return;
    document.querySelector("#service-id").value = service.id;
    document.querySelector("#service-title").value = service.title;
    document.querySelector("#service-category").value = service.category;
    document.querySelector("#service-price").value = service.price;
    document.querySelector("#service-description").value = service.description;
    document.querySelector("#service-group").checked = service.groups;
    document.querySelector("#service-modal-title").textContent = "Edit your service";
    openModal("service-modal");
  }
  if (toggle) {
    const service = state.services.find((item) => item.id === toggle.dataset.toggleService);
    if (appSupabase) {
      runAction(async () => {
        const { error } = await appSupabase.from("services").update({ is_active: !service.active })
          .eq("id", service.id).eq("provider_id", appUser.id);
        if (error) throw error;
        await refreshSupabaseState();
        populateServiceSelects();
        renderAll();
        showToast(service.active ? "Service paused. It won’t appear in search." : "Service is active.");
      }, "Could not update this service.");
      return;
    }
    service.active = !service.active;
    saveState();
    renderListings();
    showToast(service.active ? "Service is active." : "Service paused. It won’t appear in search.");
  }
});
document.querySelector("#profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#profile-name").value.trim();
  const bio = document.querySelector("#profile-bio").value.trim();
  const email = document.querySelector("#profile-email").value.trim();
  const location = document.querySelector("#profile-location").value.trim();
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.from("profiles").update({ full_name: name, bio }).eq("id", appUser.id);
      if (error) throw error;
      const locationResult = location
        ? await appSupabase.from("user_locations").upsert({ user_id: appUser.id, location_name: location })
        : await appSupabase.from("user_locations").delete().eq("user_id", appUser.id);
      if (locationResult.error) throw locationResult.error;
      const emailChanged = email && email !== appUser.email;
      if (emailChanged) {
        const { error: emailError } = await appSupabase.auth.updateUser({ email });
        if (emailError) throw emailError;
      }
      await refreshSupabaseState();
      renderAll();
      event.target.closest("dialog").close();
      showToast(emailChanged
        ? "Profile updated. Confirm the email change using the link sent to your new address."
        : "Your student profile has been updated.");
    }, "Could not update your profile.");
    return;
  }
  state.profile.name = name;
  state.profile.bio = bio;
  state.profile.email = email;
  state.profile.location = location;
  saveState();
  renderAll();
  event.target.closest("dialog").close();
  showToast("Your student profile has been updated.");
});
document.querySelector("#profile-menu").addEventListener("click", () => {
  document.querySelector("#profile-name").value = state.profile.name;
  document.querySelector("#profile-bio").value = state.profile.bio;
  document.querySelector("#profile-email").value = state.profile.email;
  document.querySelector("#profile-location").value = state.profile.location || "";
  openModal("profile-modal");
});
document.querySelector("#verification-open").addEventListener("click", () => {
  if (appSupabase && document.querySelector("#verification-open").dataset.requested === "open") {
    showToast("Your campus verification request is waiting for review.");
    return;
  }
  if (!appSupabase && state.profile.verificationRequested) {
    showToast("Your demo verification request is saved locally. It has not been reviewed.");
    return;
  }
  if (state.profile.verified) {
    showToast("Campus badge enabled in this demo; no real identity check was performed.");
    return;
  }
  document.querySelector("#verification-email").value = state.profile.email;
  openModal("verification-modal");
});
function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("The selected image could not be read."));
    }, { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("The selected image could not be read.")), { once: true });
    reader.readAsDataURL(file);
  });
}
document.querySelector("#portfolio-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = document.querySelector("#portfolio-image").files[0];
  if (file && !file.type.startsWith("image/")) { showToast("Choose an image file for your portfolio."); return; }
  if (file && file.size > 1000000) { showToast("Please choose an image smaller than 1 MB."); return; }
  if (appSupabase) {
    runAction(async () => {
      let imagePath = null;
      if (file) {
        const extension = file.type.split("/")[1].replace("jpeg", "jpg");
        if (!["png", "jpg", "webp", "gif"].includes(extension)) throw new Error("Choose a PNG, JPG, WebP, or GIF image.");
        imagePath = `${appUser.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await appSupabase.storage.from("portfolio-images").upload(imagePath, file, {
          contentType: file.type, upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const { error } = await appSupabase.from("portfolio_items").insert({
        provider_id: appUser.id, title: document.querySelector("#portfolio-title").value.trim(),
        description: document.querySelector("#portfolio-description").value.trim(), image_path: imagePath,
      });
      if (error) {
        if (imagePath) {
          const { error: cleanupError } = await appSupabase.storage.from("portfolio-images").remove([imagePath]);
          if (cleanupError) console.error("Could not clean up an uploaded portfolio image.", cleanupError);
        }
        throw error;
      }
      await refreshSupabaseState();
      renderPortfolio();
      event.target.closest("dialog").close();
      event.target.reset();
      showToast("Portfolio item added to your profile.");
    }, "Could not add this portfolio item.");
    return;
  }
  let image = "";
  if (file) {
    try { image = await readImage(file); }
    catch (error) {
      console.error("Could not read the selected portfolio image.", error);
      showToast("Could not read that image. Please try another file.");
      return;
    }
  }
  state.portfolio.unshift({ id: `work-${Date.now()}`, title: document.querySelector("#portfolio-title").value.trim(), description: document.querySelector("#portfolio-description").value.trim(), image });
  saveState();
  renderPortfolio();
  event.target.closest("dialog").close();
  event.target.reset();
  showToast("Portfolio item added to your profile.");
});
document.querySelector("#portfolio-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-work]");
  if (!button) return;
  if (appSupabase) {
    runAction(async () => {
      const item = state.portfolio.find((entry) => entry.id === button.dataset.removeWork);
      const { error } = await appSupabase.from("portfolio_items").delete()
        .eq("id", button.dataset.removeWork).eq("provider_id", appUser.id);
      if (error) throw error;
      if (item?.imagePath) {
        const { error: storageError } = await appSupabase.storage.from("portfolio-images").remove([item.imagePath]);
        if (storageError) console.error("Portfolio item was removed, but its image could not be deleted.", storageError);
      }
      await refreshSupabaseState();
      renderPortfolio();
      showToast("Portfolio item removed.");
    }, "Could not remove this portfolio item.");
    return;
  }
  state.portfolio = state.portfolio.filter((item) => item.id !== button.dataset.removeWork);
  saveState();
  renderPortfolio();
  showToast("Portfolio item removed.");
});
document.querySelector("#verification-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = document.querySelector("#verification-email").value.trim();
  if (!email.includes("@")) { showToast("Enter a valid university email address."); return; }
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.from("verification_requests").insert({
        student_id: appUser.id, university_email: email,
      });
      if (error) throw error;
      await refreshSupabaseState();
      event.target.closest("dialog").close();
      showToast("Verification request submitted. Your badge will appear after an administrator reviews it.");
    }, "Could not submit your verification request.");
    return;
  }
  state.profile.email = email;
  state.profile.verificationRequested = true;
  saveState();
  renderAll();
  event.target.closest("dialog").close();
  showToast("Demo request saved locally. No identity check or campus badge was issued.");
});
document.querySelector("#report-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const providerId = document.querySelector("#report-target").value;
  if (!providerId) { showToast("Choose the student you’re reporting."); return; }
  const provider = getProvider(providerId);
  const shouldBlock = document.querySelector("#report-block").checked;
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.from("reports").insert({
        reporter_id: appUser.id, reported_user_id: providerId,
        reason: document.querySelector("#report-reason").value,
        details: document.querySelector("#report-details").value.trim(),
      });
      if (error) throw error;
      if (shouldBlock && !state.blocked.includes(providerId)) {
        const { error: blockError } = await appSupabase.from("user_blocks").insert({
          blocker_id: appUser.id, blocked_id: providerId,
        });
        if (blockError) throw blockError;
      }
      await refreshSupabaseState();
      event.target.closest("dialog").close();
      renderAll();
      showToast(shouldBlock ? "Report submitted and student blocked." : "Report submitted to the safety team.");
    }, "Could not submit your report.");
    return;
  }
  state.reports.unshift({ id: `report-${Date.now()}`, providerId, name: provider?.name || "Student", reason: document.querySelector("#report-reason").value, details: document.querySelector("#report-details").value.trim(), date: new Date().toISOString() });
  if (shouldBlock && !state.blocked.includes(providerId)) state.blocked.push(providerId);
  saveState();
  event.target.closest("dialog").close();
  renderAll();
  showToast(shouldBlock ? "Report saved and student blocked on this device." : "Report saved on this device. Thank you for looking out.");
});
document.querySelector("#blocked-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-unblock]");
  if (!button) return;
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.from("user_blocks").delete()
        .eq("blocker_id", appUser.id).eq("blocked_id", button.dataset.unblock);
      if (error) throw error;
      await refreshSupabaseState();
      renderAll();
      renderBlocked();
      showToast("Student unblocked.");
    }, "Could not unblock this student.");
    return;
  }
  state.blocked = state.blocked.filter((id) => id !== button.dataset.unblock);
  saveState();
  renderAll();
  renderBlocked();
  showToast("Student unblocked.");
});
document.querySelector("#user-booking-list").addEventListener("click", (event) => {
  const messageButton = event.target.closest("[data-message]");
  if (messageButton) {
    const bookingId = messageButton.dataset.message.startsWith("customer:")
      ? messageButton.dataset.message.slice("customer:".length)
      : "";
    const booking = state.bookings.find((item) => item.id === bookingId);
    openMessage(messageButton.dataset.message, booking && isOwnBooking(booking) ? "customer" : "provider");
    return;
  }
  const decision = event.target.closest("[data-decision]");
  if (decision) {
    const booking = state.bookings.find((item) => item.id === decision.dataset.bookingId);
    if (!booking) return;
    if (appSupabase) {
      runAction(async () => {
        await persistBookingStatus(booking.id, decision.dataset.decision);
        showToast(decision.dataset.decision === "Confirmed"
          ? "Booking accepted. The student can see the confirmation."
          : decision.dataset.decision === "Declined"
            ? "Booking request declined."
            : decision.dataset.decision === "Completed"
              ? "Booking marked as completed."
              : "Booking cancelled.");
      }, "Could not update this booking.");
    } else {
      booking.status = decision.dataset.decision;
      saveState();
      renderAll();
      showToast(decision.dataset.decision === "Confirmed"
        ? "Booking accepted. The student can see the confirmation."
        : decision.dataset.decision === "Declined"
          ? "Booking request declined."
          : decision.dataset.decision === "Completed"
            ? "Booking marked as completed."
            : "Booking cancelled.");
    }
    return;
  }
  const button = event.target.closest("[data-review]");
  if (!button) return;
  const booking = state.bookings.find((item) => item.id === button.dataset.review);
  const provider = getProvider(booking?.providerId);
  document.querySelector("#review-booking-id").value = booking.id;
  document.querySelector("#review-description").textContent = `Share a fair review of your booking with ${provider?.name || "this student"}.`;
  openModal("review-modal");
});
document.querySelector("#review-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const booking = state.bookings.find((item) => item.id === document.querySelector("#review-booking-id").value);
  if (!booking) return;
  if (appSupabase) {
    runAction(async () => {
      const { error } = await appSupabase.from("reviews").insert({
        booking_id: booking.id, reviewer_id: appUser.id, provider_id: booking.providerId,
        rating: Number(document.querySelector("#review-rating").value),
        body: document.querySelector("#review-text").value.trim(),
      });
      if (error) throw error;
      await refreshSupabaseState();
      renderAll();
      event.target.closest("dialog").close();
      showToast("Thank you. Your review has been added.");
    }, "Could not post your review.");
    return;
  }
  booking.reviewed = true;
  state.reviews.unshift({ bookingId: booking.id, providerId: booking.providerId, rating: Number(document.querySelector("#review-rating").value), text: document.querySelector("#review-text").value.trim(), date: new Date().toISOString() });
  saveState();
  renderAll();
  event.target.closest("dialog").close();
  showToast("Thank you. Your review has been added to your demo booking record.");
});
document.querySelector("#provider-booking-list").addEventListener("click", (event) => {
  const messageButton = event.target.closest("[data-message]");
  if (messageButton) {
    openMessage(messageButton.dataset.message);
    return;
  }
  const button = event.target.closest("[data-decision]");
  if (!button) return;
  const booking = state.bookings.find((item) => item.id === button.dataset.bookingId);
  if (!booking) return;
  if (appSupabase) {
    runAction(async () => {
      await persistBookingStatus(booking.id, button.dataset.decision);
      showToast(button.dataset.decision === "Confirmed" ? "Booking accepted. The student can see the confirmation." : "Booking request declined.");
    }, "Could not update this booking.");
    return;
  }
  booking.status = button.dataset.decision;
  saveState();
  renderAll();
  showToast(booking.status === "Confirmed" ? "Booking accepted. Your student can see the confirmation." : "Booking request declined.");
});
document.querySelector("#earnings-list").addEventListener("click", (event) => {
  const messageButton = event.target.closest("[data-message]");
  if (messageButton) {
    openMessage(messageButton.dataset.message);
    return;
  }
  const button = event.target.closest("[data-decision]");
  if (!button) return;
  const booking = state.bookings.find((item) => item.id === button.dataset.bookingId);
  if (!booking) return;
  if (appSupabase) {
    runAction(async () => {
      await persistBookingStatus(booking.id, button.dataset.decision);
      showToast("Booking updated.");
    }, "Could not update this booking.");
    return;
  }
  booking.status = button.dataset.decision;
  saveState();
  renderEarnings();
  renderBookingList("provider-booking-list", state.bookings.filter((item) => item.providerId === "alex"), { provider: true });
});
document.querySelector("#booking-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-booking-filter]");
  if (!button) return;
  document.querySelectorAll(".tab-button").forEach((tab) => tab.classList.toggle("active", tab === button));
  activeBookingFilter = button.dataset.bookingFilter;
  renderBookingList("user-booking-list", bookingsForActiveFilter());
});
document.querySelector("#earnings-export").addEventListener("click", () => {
  const completed = state.bookings.filter((booking) => isOwnBooking(booking) && booking.status === "Completed");
  const rows = [["Service", "Customer", "Date", "Amount"], ...completed.map((booking) => [booking.service, booking.customer || state.profile.name, booking.date, currency(booking.price)])];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "skillmate-earnings.csv"; link.click(); URL.revokeObjectURL(url);
  showToast(appSupabase ? "Your completed earnings were exported." : "Your completed demo earnings were exported.");
});
document.querySelector("#notifications-button").addEventListener("click", () => {
  if (!appSupabase) {
    showToast("You’re all caught up in this demo.");
    return;
  }
  runAction(async () => {
    const { data, error } = await appSupabase.from("notifications")
      .select("id, title, body, read_at").order("created_at", { ascending: false }).limit(10);
    if (error) throw error;
    const unread = (data || []).filter((notification) => !notification.read_at);
    if (unread.length) {
      const { error: updateError } = await appSupabase.from("notifications")
        .update({ read_at: new Date().toISOString() }).in("id", unread.map((item) => item.id));
      if (updateError) throw updateError;
    }
    showToast(unread[0] ? `${unread[0].title}${unread[0].body ? `: ${unread[0].body}` : ""}` : "You’re all caught up.");
  }, "Could not load your notifications.");
});
document.querySelector("#signout-button").addEventListener("click", () => {
  if (!appSupabase) {
    showToast("Demo mode has no account to sign out of.");
    return;
  }
  runAction(async () => {
    const { error } = await appSupabase.auth.signOut();
    if (error) throw error;
  }, "Could not sign out.");
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#global-search").focus(); }
  if (event.key === "Escape" && document.body.classList.contains("search-open")) {
    event.preventDefault();
    globalSearch.blur();
    document.body.classList.remove("search-open");
    document.querySelector("#search-suggestions").hidden = true;
    globalSearch.setAttribute("aria-expanded", "false");
    return;
  }
  if (event.key === "Escape" && sidebar.classList.contains("open")) closeSidebar(true);
});

document.querySelector("#group-service").addEventListener("change", updateGroupPrice);
renderServiceCategories();
bootstrapStudentApp().catch((error) => {
  console.error("Could not initialize the Skillmate student dashboard.", error);
  const status = document.querySelector("#app-auth-status");
  status.replaceChildren(document.createTextNode(error?.message || "Could not load your Skillmate account."));
  const loginLink = document.createElement("a");
  loginLink.href = "login.html";
  loginLink.textContent = "Return to sign in";
  status.append(loginLink);
});

function updateGroupPrice() {
  const selectedId = document.querySelector("#group-service").value;
  const service = appSupabase ? connectedServices.find((item) => item.id === selectedId) : providerServices(selectedId)[0];
  const priceInput = document.querySelector("#group-price");
  if (service) priceInput.value = Math.max(1, Math.round(service.price * 0.85));
}
