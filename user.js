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
let pendingReplyId = null;
let messageMetadataAvailable = null;
let messageMetadataWarningShown = false;
const chatDrafts = new Map();
const pendingOutgoingMessages = new Map();
const sendingMessageIds = new Set();
let typingTimeoutId = null;
let longPressTimeoutId = null;
let pendingLongPressId = null;
const messageChannels = new Map();
const messagePresence = new Map();
const hiddenMessageIds = new Set();
const readUpdatesInProgress = new Set();
const presenceTypingTimers = new Map();
let toastTimer;
let pendingActionCount = 0;
let activityRefreshInProgress = false;
const pendingProviderSaves = new Set();
const ownProviderId = () => appUser?.id || "alex";
const isOwnBooking = (booking) => booking.providerId === ownProviderId();
const messageColumns = "id, sender_id, body, created_at, read_at, delivered_at, reply_to";
const legacyMessageColumns = "id, sender_id, body, created_at, read_at";

function isMissingMessageMetadata(error) {
  return ["42703", "PGRST204"].includes(error?.code)
    && /delivered_at|reply_to/i.test(`${error.message || ""} ${error.details || ""}`);
}

async function loadConversationMessages(chatId) {
  const conversation = { conversation_id: chatId, other_user_name: "Student" };
  const messages = await loadConversationMessageGroups([conversation]);
  return messages.get(chatId) || [];
}

async function loadConversationMessageGroups(conversations) {
  const grouped = new Map(conversations.map((conversation) => [conversation.conversation_id, []]));
  if (!conversations.length) return grouped;
  const ids = conversations.map((conversation) => conversation.conversation_id);
  const selectMessages = (columns) => appSupabase.from("messages")
    .select(columns)
    .in("conversation_id", ids)
    .order("created_at", { ascending: true });
  let { data, error } = await selectMessages(
    messageMetadataAvailable === false ? legacyMessageColumns : messageColumns,
  );
  if (error && isMissingMessageMetadata(error)) {
    messageMetadataAvailable = false;
    if (!messageMetadataWarningShown) {
      messageMetadataWarningShown = true;
      console.warn("Chat metadata columns are missing. Apply the messaging migration to enable delivery receipts and replies.");
      showToast("Messages are available; apply the messaging migration to enable replies and delivery receipts.");
    }
    ({ data, error } = await selectMessages(legacyMessageColumns));
  } else if (!error && messageMetadataAvailable === null) {
    messageMetadataAvailable = true;
  }
  if (error) throw error;
  const names = new Map(conversations.map((conversation) => [
    conversation.conversation_id,
    conversation.other_user_name || "Student",
  ]));
  for (const row of data || []) {
    const conversationMessages = grouped.get(row.conversation_id);
    conversationMessages.push(normalizeMessageRow(row, names.get(row.conversation_id)));
  }
  for (const conversation of conversations) {
    const messages = grouped.get(conversation.conversation_id);
    grouped.set(conversation.conversation_id, mergePendingMessages(conversation.conversation_id, messages));
  }
  return grouped;
}

function chatDraftStorageKey() {
  return `skillmate-chat-drafts:${appUser?.id || "demo"}`;
}
function pendingMessageStorageKey() {
  return `skillmate-pending-messages:${appUser?.id || "demo"}`;
}
function loadChatDrafts() {
  chatDrafts.clear();
  try {
    const saved = JSON.parse(localStorage.getItem(chatDraftStorageKey()) || "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      Object.entries(saved).forEach(([conversationId, text]) => {
        if (typeof text === "string" && text) chatDrafts.set(conversationId, text);
      });
    }
  } catch (error) {
    console.error("Could not load saved chat drafts.", error);
    showToast("Saved drafts could not be loaded from this browser.");
  }
}
function saveChatDraft(conversationId, text) {
  if (text) chatDrafts.set(conversationId, text);
  else chatDrafts.delete(conversationId);
  try {
    localStorage.setItem(chatDraftStorageKey(), JSON.stringify(Object.fromEntries(chatDrafts)));
  } catch (error) {
    console.error("Could not save the chat draft.", error);
    showToast("This draft could not be saved on this device.");
  }
}
function persistPendingMessages() {
  try {
    localStorage.setItem(pendingMessageStorageKey(), JSON.stringify([...pendingOutgoingMessages.values()]));
  } catch (error) {
    console.error("Could not save pending chat messages.", error);
    showToast("A failed message could not be saved for retry on this device.");
  }
}
function loadPendingMessages() {
  pendingOutgoingMessages.clear();
  try {
    const saved = JSON.parse(localStorage.getItem(pendingMessageStorageKey()) || "[]");
    if (!Array.isArray(saved)) throw new TypeError("Pending messages must be stored as a list.");
    for (const message of saved) {
      if (typeof message?.id !== "string" || typeof message.conversationId !== "string"
        || typeof message.text !== "string" || typeof message.createdAt !== "string") continue;
      pendingOutgoingMessages.set(message.id, {
        ...message,
        senderId: appUser.id,
        sendStatus: "failed",
      });
    }
  } catch (error) {
    console.error("Could not load pending chat messages.", error);
    showToast("Failed messages could not be restored from this browser.");
  }
}
function mergePendingMessages(conversationId, messages) {
  const serverIds = new Set(messages.map((message) => String(message.id)));
  let outboxChanged = false;
  for (const [id, pending] of pendingOutgoingMessages) {
    if (pending.conversationId === conversationId && serverIds.has(id)) {
      pendingOutgoingMessages.delete(id);
      outboxChanged = true;
    } else if (pending.conversationId === conversationId) {
      messages.push({ ...pending, sender: "You" });
    }
  }
  if (outboxChanged) persistPendingMessages();
  return linkMessageReplies(messages);
}
function createChatMessageId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((byte, index) => `${[4, 6, 8, 10].includes(index) ? "-" : ""}${byte.toString(16).padStart(2, "0")}`).join("");
}
function queuePendingMessage(chat, message) {
  const pending = { ...message, conversationId: chat.id, senderId: appUser.id, sendStatus: "failed" };
  pendingOutgoingMessages.set(String(pending.id), pending);
  persistPendingMessages();
  return pending;
}
async function sendPendingMessage(chat, message) {
  const id = String(message.id);
  if (sendingMessageIds.has(id) || !appSupabase || !appUser) return;
  sendingMessageIds.add(id);
  message.sendStatus = "sending";
  renderConversations({ preserveChatState: true });
  try {
    const insertMessage = async (includeMetadata) => {
      const payload = {
        id: message.id,
        conversation_id: chat.id,
        sender_id: appUser.id,
        body: message.text,
      };
      if (includeMetadata && message.replyTo) payload.reply_to = message.replyTo;
      return appSupabase.from("messages").insert(payload)
        .select(includeMetadata ? messageColumns : legacyMessageColumns).single();
    };
    let includeMetadata = messageMetadataAvailable !== false;
    let result = await insertMessage(includeMetadata);
    if (result.error && isMissingMessageMetadata(result.error)) {
      messageMetadataAvailable = false;
      includeMetadata = false;
      if (!messageMetadataWarningShown) {
        messageMetadataWarningShown = true;
        console.warn("Chat metadata columns are missing. Apply the messaging migration to enable delivery receipts and replies.");
        showToast("Messages are available; apply the messaging migration to enable replies and delivery receipts.");
      }
      result = await insertMessage(false);
    }
    if (result.error?.code === "23505") {
      const existing = await appSupabase.from("messages")
        .select(legacyMessageColumns).eq("id", message.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.sender_id === appUser.id && existing.data.body === message.text) {
        result = { data: existing.data, error: null };
      }
    }
    if (result.error) throw result.error;
    if (includeMetadata && messageMetadataAvailable === null) messageMetadataAvailable = true;
    const sent = normalizeMessageRow(result.data, chat.name || getProvider(chat.providerId)?.name || "Student");
    const index = chat.messages.findIndex((item) => String(item.id) === id);
    if (index >= 0) chat.messages[index] = sent;
    else chat.messages.push(sent);
    pendingOutgoingMessages.delete(id);
    persistPendingMessages();
    linkMessageReplies(chat.messages);
    renderConversations({ preserveChatState: true });
    broadcastTyping(chat.id, false).catch((typingError) => console.error("Could not clear the typing event.", typingError));
  } catch (error) {
    message.sendStatus = "failed";
    queuePendingMessage(chat, message);
    renderConversations({ preserveChatState: true });
    throw error;
  } finally {
    sendingMessageIds.delete(id);
  }
}
function retryPendingMessage(messageId) {
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const message = chat?.messages.find((item) => String(item.id) === String(messageId));
  if (!chat || !message) return;
  queuePendingMessage(chat, message);
  runAction(() => sendPendingMessage(chat, message), "Message wasn't sent. It is saved on this device; tap Retry to try again.", "Sending message…");
}
async function retryQueuedMessages() {
  for (const pending of [...pendingOutgoingMessages.values()]) {
    const chat = state.messages.find((item) => item.id === pending.conversationId);
    const message = chat?.messages.find((item) => String(item.id) === String(pending.id));
    if (chat && message && !sendingMessageIds.has(String(message.id))) {
      await runAction(() => sendPendingMessage(chat, message), "A saved message could not be sent.", "Sending saved messages…");
    }
  }
}

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
      const ownListing = connectedProviders.find((item) => item.id === id);
      if (ownListing) return ownListing;
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
function syncChatVisualViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement;
  root.style.setProperty("--chat-visual-height", `${Math.round(viewport.height)}px`);
  root.style.setProperty("--chat-visual-top", `${Math.round(viewport.offsetTop)}px`);
}
syncChatVisualViewport();
window.addEventListener("resize", syncChatVisualViewport);
window.visualViewport?.addEventListener("resize", syncChatVisualViewport);
window.visualViewport?.addEventListener("scroll", syncChatVisualViewport);
function hiddenMessageStorageKey() {
  return `skillmate-hidden-messages:${appUser?.id || "demo"}`;
}
function loadHiddenMessages() {
  hiddenMessageIds.clear();
  try {
    const saved = JSON.parse(localStorage.getItem(hiddenMessageStorageKey()) || "[]");
    if (Array.isArray(saved)) saved.forEach((id) => hiddenMessageIds.add(String(id)));
  } catch (error) {
    console.error("Could not load locally hidden Skillmate messages.", error);
  }
}
function saveHiddenMessages() {
  try {
    localStorage.setItem(hiddenMessageStorageKey(), JSON.stringify([...hiddenMessageIds]));
  } catch (error) {
    console.error("Could not save locally hidden Skillmate messages.", error);
    showToast("This message could not be hidden on this device.");
  }
}
function formatChatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatChatDate(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const key = (item) => `${item.getFullYear()}-${item.getMonth()}-${item.getDate()}`;
  if (key(date) === key(today)) return "Today";
  if (key(date) === key(yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}
function formatConversationTime(message) {
  if (!message?.createdAt) return message?.time || "";
  const label = formatChatDate(message.createdAt);
  return label === "Today" ? formatChatTime(message.createdAt) : label;
}
function isHiddenMessage(message) {
  return hiddenMessageIds.has(String(message.id));
}
function visibleMessageCount(chat) {
  return chat.messages.filter((message) => !isHiddenMessage(message)).length;
}
function latestVisibleMessage(chat) {
  return [...chat.messages].reverse().find((message) => !isHiddenMessage(message));
}
function normalizeMessageRow(message, otherName) {
  return {
    id: message.id,
    sender: message.sender_id === appUser.id ? "You" : otherName,
    senderId: message.sender_id,
    text: message.body,
    createdAt: message.created_at,
    time: formatChatTime(message.created_at),
    readAt: message.read_at,
    deliveredAt: message.delivered_at,
    replyTo: message.reply_to,
  };
}
function linkMessageReplies(messages) {
  const byId = new Map(messages.map((message) => [String(message.id), message]));
  for (const message of messages) {
    const reply = message.replyTo && byId.get(String(message.replyTo));
    message.replyText = reply?.text || "";
    message.replySender = reply?.sender || "";
  }
  return messages;
}
function unreadMessageCount(chat) {
  return chat.messages.filter((message) => message.sender !== "You" && message.senderId && message.senderId !== appUser?.id && !message.readAt && !isHiddenMessage(message)).length;
}
function currentChatStatus(chat) {
  const presence = messagePresence.get(chat.id);
  if (presence?.typing) return "typing…";
  if (presence?.online) return "online";
  const lastSeen = [...chat.messages].reverse().find((message) => message.senderId && message.senderId !== appUser?.id)?.createdAt;
  return `last seen at ${formatChatTime(lastSeen || new Date())}`;
}
function setChatPresenceStatus(chatId, status) {
  messagePresence.set(chatId, { ...(messagePresence.get(chatId) || {}), ...status });
  if (activeConversationId === chatId && state.activePage === "messages") renderChatHeaderStatus();
}
function renderChatHeaderStatus() {
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const status = document.querySelector("#chat-status");
  if (!chat || !status) return;
  const presence = messagePresence.get(chat.id);
  status.textContent = currentChatStatus(chat);
  status.dataset.status = presence?.online ? "online" : presence?.typing ? "typing" : "offline";
}
function syncMessageChannels() {
  if (!appSupabase || !appUser) return;
  const conversations = state.messages.filter((chat) => !state.blocked.includes(chat.providerId));
  const activeIds = new Set(conversations.map((chat) => chat.id));
  for (const [id, channel] of messageChannels) {
    if (!activeIds.has(id)) {
      appSupabase.removeChannel(channel);
      messageChannels.delete(id);
      messagePresence.delete(id);
    }
  }
  for (const chat of conversations) {
    if (messageChannels.has(chat.id)) continue;
    const channel = appSupabase.channel(`skillmate-chat:${chat.id}`, { config: { private: true, presence: { key: appUser.id } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${chat.id}` }, () => {
        markConversationMessagesDelivered(chat.id)
          .then(() => refreshConversationMessages(chat.id))
          .catch((error) => console.error("Could not refresh a realtime Skillmate conversation.", error));
      })
      .on("presence", { event: "sync" }, () => {
        const members = Object.values(channel.presenceState()).flat();
        const otherOnline = members.some((member) => member.user_id === chat.providerId);
        setChatPresenceStatus(chat.id, { online: otherOnline });
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.sender_id !== chat.providerId) return;
        const typing = Boolean(payload.typing);
        window.clearTimeout(presenceTypingTimers.get(chat.id));
        setChatPresenceStatus(chat.id, { typing });
        if (typing) {
          presenceTypingTimers.set(chat.id, window.setTimeout(() => {
            setChatPresenceStatus(chat.id, { typing: false });
            presenceTypingTimers.delete(chat.id);
          }, 2500));
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const { error } = await channel.track({ user_id: appUser.id, typing: false, online_at: new Date().toISOString() });
          if (error) console.error("Could not publish Skillmate chat presence.", error);
          try {
            await markConversationMessagesDelivered(chat.id);
          } catch (deliveryError) {
            console.error("Could not mark existing Skillmate messages delivered.", deliveryError);
          }
          if (activeConversationId === chat.id && state.activePage === "messages" && !document.hidden) {
            markConversationMessagesRead(chat.id).catch((error) => console.error("Could not mark Skillmate messages as read.", error));
          }
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          console.error(`Skillmate chat realtime channel ${status.toLowerCase()}.`, chat.id);
        }
      });
    messageChannels.set(chat.id, channel);
  }
}
async function broadcastTyping(chatId, typing) {
  const channel = messageChannels.get(chatId);
  if (!channel) return;
  const status = await channel.send({ type: "broadcast", event: "typing", payload: { sender_id: appUser.id, typing } });
  if (status !== "ok") console.error("Could not update Skillmate typing status.", status);
}
async function markConversationMessagesDelivered(chatId) {
  if (!appSupabase || !appUser || messageMetadataAvailable === false) return;
  const deliveredAt = new Date().toISOString();
  const { error } = await appSupabase.from("messages")
    .update({ delivered_at: deliveredAt })
    .eq("conversation_id", chatId).neq("sender_id", appUser.id).is("delivered_at", null);
  if (error) throw error;
  const chat = state.messages.find((item) => item.id === chatId);
  chat?.messages.forEach((message) => {
    if (message.senderId && message.senderId !== appUser.id && !message.deliveredAt) message.deliveredAt = deliveredAt;
  });
}
async function markConversationMessagesRead(chatId) {
  if (!appSupabase || !appUser || readUpdatesInProgress.has(chatId) || document.hidden || state.activePage !== "messages" || activeConversationId !== chatId) return;
  readUpdatesInProgress.add(chatId);
  try {
    const readAt = new Date().toISOString();
    const updates = messageMetadataAvailable === false
      ? { read_at: readAt }
      : { delivered_at: readAt, read_at: readAt };
    const { error } = await appSupabase.from("messages")
      .update(updates)
      .eq("conversation_id", chatId).neq("sender_id", appUser.id).is("read_at", null);
    if (error) throw error;
    const chat = state.messages.find((item) => item.id === chatId);
    if (chat) {
      chat.messages.forEach((message) => {
        if (message.senderId && message.senderId !== appUser.id && !message.readAt) {
          message.deliveredAt = readAt;
          message.readAt = readAt;
        }
      });
      renderConversations({ preserveChatState: true });
    }
  } finally {
    readUpdatesInProgress.delete(chatId);
  }
}
async function refreshConversationMessages(chatId) {
  if (!appSupabase || !appUser) return;
  const chat = state.messages.find((item) => item.id === chatId);
  if (!chat) {
    await refreshLiveMessages();
    return;
  }
  const data = await loadConversationMessages(chatId);
  chat.messages = linkMessageReplies(data.map((message) => normalizeMessageRow(message, chat.name || getProvider(chat.providerId)?.name || "Student")));
  renderConversations({ preserveChatState: true });
  if (activeConversationId === chatId && state.activePage === "messages" && !document.hidden) {
    await markConversationMessagesRead(chatId);
  }
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
      <div class="provider-card-cover cover-${escapeHTML(provider.color)}"><span class="cover-symbol">${getCategoryIcon(provider.category)}</span>${provider.id === appUser?.id ? '<span class="own-listing-label">Your listing</span>' : `<button class="save-button ${state.saved.includes(provider.id) ? "is-saved" : ""}" type="button" data-save="${escapeHTML(provider.id)}" aria-label="${state.saved.includes(provider.id) ? "Remove saved provider" : "Save provider"}">${state.saved.includes(provider.id) ? "♥" : "♡"}</button>`}</div>
      <div class="provider-card-body">
        <div class="provider-card-person"><span class="provider-avatar avatar-${escapeHTML(provider.color)}">${escapeHTML(provider.initials)}</span>        <span><strong>${escapeHTML(provider.name)}</strong><small>${provider.verified ? '<i class="verified-dot">✓</i> Campus verified' : escapeHTML(provider.campus)}</small></span><span class="rating">★ ${providerReviewSummary(provider).rating}<small> (${providerReviewSummary(provider).count})</small></span></div>
        <p class="service-category">${escapeHTML(provider.category)}</p><h3>${escapeHTML(provider.service)}</h3><p class="provider-description">${escapeHTML(provider.description)}</p>
        <div class="provider-card-footer"><span class="price">${currency(provider.price)} <small>/ session</small></span>${provider.id === appUser?.id ? "" : `<span class="card-actions"><button type="button" class="icon-button card-message" data-message="${escapeHTML(provider.id)}" aria-label="Message ${escapeHTML(provider.name)}">▤</button><button type="button" class="button button-small button-primary" data-book="${escapeHTML(provider.id)}">Request booking</button></span>`}</div>
        ${provider.id === appUser?.id ? "" : `<div class="provider-card-tools"><button type="button" data-profile="${escapeHTML(provider.id)}">View provider details <span aria-hidden="true">→</span></button></div>`}
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
    .filter((provider) => !state.blocked.includes(provider.id)
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
function resizeChatInput(input) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 104)}px`;
}
function closeMessageContextMenu() {
  document.querySelector(".chat-context-menu")?.remove();
  pendingLongPressId = null;
}
function openMessageContextMenu(message, x, y) {
  closeMessageContextMenu();
  const menu = document.createElement("div");
  menu.className = "chat-context-menu";
  menu.setAttribute("role", "menu");
  menu.dataset.contextMessage = String(message.id);
  for (const [action, label] of [["reply", "Reply"], ["copy", "Copy"], ["delete", "Delete for me"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.messageAction = action;
    button.setAttribute("role", "menuitem");
    button.textContent = label;
    menu.append(button);
  }
  document.body.append(menu);
  const left = Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8));
  const top = Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.querySelector("button")?.focus();
}
function renderConversations(options = {}) {
  const target = document.querySelector("#conversation-list");
  const layout = document.querySelector("#messages-layout");
  state.messages.forEach((chat) => chat.messages.forEach((message, index) => {
    if (!message.id) message.id = `legacy-${chat.id}-${index}`;
  }));
  const search = document.querySelector("#conversation-search").value.trim().toLocaleLowerCase();
  const conversations = state.messages
    .filter((chat) => !state.blocked.includes(chat.providerId))
    .sort((a, b) => new Date(b.messages.at(-1)?.createdAt || 0) - new Date(a.messages.at(-1)?.createdAt || 0));
  const selectedChatExists = conversations.some((chat) => chat.id === activeConversationId);
  if (activeConversationId && !selectedChatExists) activeConversationId = null;
  if (activeConversationId) layout.dataset.chatOpen = "true";
  else layout.removeAttribute("data-chat-open");
  const totalUnread = conversations.reduce((total, chat) => total + unreadMessageCount(chat), 0);
  const messageCountBadge = document.querySelector("#message-count");
  messageCountBadge.textContent = String(totalUnread);
  messageCountBadge.classList.toggle("has-unread", totalUnread > 0);
  target.replaceChildren();
  const matching = conversations.filter((chat) => {
    const provider = getProvider(chat.providerId);
    return !search || `${chat.name || provider?.name || ""} ${latestVisibleMessage(chat)?.text || ""}`.toLocaleLowerCase().includes(search);
  });
  if (!matching.length) {
    const empty = document.createElement("div");
    empty.className = "conversation-list-empty";
    empty.textContent = conversations.length ? "No chats match your search." : "No conversations yet. Message a student to start chatting.";
    target.append(empty);
  } else {
    for (const chat of matching) {
      const provider = getProvider(chat.providerId);
      const latest = latestVisibleMessage(chat);
      const unread = unreadMessageCount(chat);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `conversation-item${chat.id === activeConversationId ? " conversation-active" : ""}${unread ? " conversation-item-unread" : ""}`;
      row.dataset.chat = chat.id;
      const avatar = document.createElement("span");
      avatar.className = `person-avatar avatar-${provider?.color || "blue"}`;
      avatar.textContent = provider?.initials || initialsFor(chat.name || provider?.name || "Student");
      const copy = document.createElement("span");
      copy.className = "conversation-copy";
      const top = document.createElement("span");
      top.className = "conversation-row-top";
      const name = document.createElement("strong");
      name.textContent = chat.name || provider?.name || "Student";
      const time = document.createElement("time");
      time.className = "conversation-time";
      time.textContent = formatConversationTime(latest);
      top.append(name, time);
      const bottom = document.createElement("span");
      bottom.className = "conversation-row-bottom";
      const preview = document.createElement("small");
      preview.textContent = latest?.text || "Start a conversation";
      bottom.append(preview);
      if (unread) {
        const badge = document.createElement("span");
        badge.className = "unread-badge";
        badge.textContent = String(unread);
        badge.setAttribute("aria-label", `${unread} unread ${unread === 1 ? "message" : "messages"}`);
        bottom.append(badge);
      }
      copy.append(top, bottom);
      row.append(avatar, copy);
      target.append(row);
    }
  }
  if (activeConversationId) renderChat(options);
  else renderEmptyChat();
}
function renderEmptyChat() {
  const target = document.querySelector("#chat-panel");
  target.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "chat-panel-empty";
  const icon = document.createElement("span");
  icon.className = "chat-panel-empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✉";
  const heading = document.createElement("strong");
  heading.textContent = "Your campus conversations";
  const description = document.createElement("p");
  description.textContent = "Choose a chat to pick up where you left off, or message a student to start a new conversation.";
  empty.append(icon, heading, description);
  target.append(empty);
}
function renderChat(options = {}) {
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const provider = chat && getProvider(chat.providerId);
  const target = document.querySelector("#chat-panel");
  if (!chat || !provider) { renderEmptyChat(); return; }
  const previousInput = options.preserveChatState ? target.querySelector('[name="message"]') : null;
  const draft = previousInput ? previousInput.value : chatDrafts.get(chat.id) || "";
  const hadFocus = previousInput === document.activeElement;
  const previousMessages = options.preserveChatState ? target.querySelector("#chat-messages") : null;
  const previousNewMessages = options.preserveChatState ? target.querySelector(".chat-new-messages") : null;
  const wasNearBottom = previousMessages
    ? previousMessages.scrollHeight - previousMessages.scrollTop - previousMessages.clientHeight < 48
    : true;
  const previousScrollTop = previousMessages?.scrollTop || 0;
  const previousMessageCount = previousMessages?.querySelectorAll("[data-message-id]").length || 0;
  const hasNewMessages = visibleMessageCount(chat) > previousMessageCount;
  const header = document.createElement("header");
  header.className = "chat-header";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "chat-back";
  back.dataset.chatBack = "";
  back.setAttribute("aria-label", "Back to conversations");
  back.textContent = "←";
  const avatar = document.createElement("span");
  avatar.className = `person-avatar avatar-${provider.color || "blue"}`;
  avatar.textContent = provider.initials || initialsFor(provider.name);
  const contact = document.createElement("span");
  contact.className = "chat-contact";
  const name = document.createElement("strong");
  name.textContent = chat.name || provider.name;
  const status = document.createElement("small");
  status.id = "chat-status";
  status.textContent = currentChatStatus(chat);
  status.dataset.status = messagePresence.get(chat.id)?.online ? "online" : "offline";
  contact.append(name, status);
  const menu = document.createElement("details");
  menu.className = "chat-header-menu";
  const menuTrigger = document.createElement("summary");
  menuTrigger.className = "chat-menu-trigger";
  menuTrigger.setAttribute("aria-label", "Chat options");
  menuTrigger.textContent = "⋯";
  const menuItems = document.createElement("span");
  menuItems.className = "chat-menu-popover";
  const report = document.createElement("button");
  report.type = "button";
  report.dataset.report = chat.providerId;
  report.textContent = "Report student";
  menuItems.append(report);
  menu.append(menuTrigger, menuItems);
  header.append(back, avatar, contact, menu);

  const messages = document.createElement("div");
  messages.className = "chat-messages";
  messages.id = "chat-messages";
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions text");
  let previousDate = "";
  let previousMessage = null;
  const visibleMessages = chat.messages.filter((message) => !isHiddenMessage(message));
  for (const message of visibleMessages) {
    const messageDate = message.createdAt ? new Date(message.createdAt).toDateString() : "Today";
    if (messageDate !== previousDate) {
      const dateRow = document.createElement("div");
      dateRow.className = "chat-date-row";
      const pill = document.createElement("span");
      pill.className = "chat-date-pill";
      pill.textContent = message.createdAt ? formatChatDate(message.createdAt) : "Today";
      dateRow.append(pill);
      messages.append(dateRow);
      previousDate = messageDate;
      previousMessage = null;
    }
    const sameSender = previousMessage && (previousMessage.senderId || previousMessage.sender) === (message.senderId || message.sender);
    const grouped = sameSender
      && new Date(message.createdAt || 0) - new Date(previousMessage.createdAt || 0) < 5 * 60 * 1000;
    const row = document.createElement("article");
    row.className = `chat-message${message.sender === "You" ? " chat-outgoing" : ""}${grouped ? " chat-message-grouped" : ""}`;
    row.dataset.messageId = String(message.id);
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    if (message.replyText) {
      const quote = document.createElement("div");
      quote.className = "chat-message-quote";
      const quoteName = document.createElement("strong");
      quoteName.textContent = message.replySender || "Message";
      const quoteText = document.createElement("span");
      quoteText.textContent = message.replyText;
      quote.append(quoteName, quoteText);
      bubble.append(quote);
    }
    const body = document.createElement("span");
    body.className = "chat-message-text";
    body.textContent = message.text;
    const meta = document.createElement("span");
    meta.className = "chat-message-meta";
    const time = document.createElement("time");
    time.className = "chat-time";
    time.dateTime = message.createdAt || "";
    time.textContent = message.createdAt ? formatChatTime(message.createdAt) : message.time || "";
    meta.append(time);
    if (message.sendStatus) {
      const status = document.createElement("span");
      status.className = `chat-send-status chat-send-status-${message.sendStatus}`;
      status.textContent = message.sendStatus === "failed" ? "Not sent" : "Sending…";
      meta.append(status);
    } else if (message.sender === "You" && appSupabase) {
      const ticks = document.createElement("span");
      ticks.className = `chat-ticks${message.readAt ? " chat-ticks-read" : ""}`;
      ticks.setAttribute("aria-label", message.readAt ? "Read" : message.deliveredAt ? "Delivered" : "Sent");
      ticks.textContent = message.readAt || message.deliveredAt ? "✓✓" : "✓";
      meta.append(ticks);
    }
    bubble.append(body, meta);
    if (message.sendStatus === "failed") {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "chat-message-retry";
      retry.dataset.retryMessage = String(message.id);
      retry.textContent = "Retry";
      retry.setAttribute("aria-label", `Retry sending message: ${message.text.slice(0, 60)}`);
      bubble.append(retry);
    }
    row.append(bubble);
    messages.append(row);
    previousMessage = message;
  }
  if (!visibleMessages.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty-state";
    empty.textContent = "No messages yet 👋 Say hi!";
    messages.append(empty);
  }
  const newMessages = document.createElement("button");
  newMessages.type = "button";
  newMessages.className = "chat-new-messages";
  newMessages.hidden = true;
  newMessages.textContent = "↓ New messages";
  const form = document.createElement("form");
  form.className = "chat-compose";
  form.id = "chat-compose";
  if (pendingReplyId) {
    const repliedMessage = chat.messages.find((message) => String(message.id) === String(pendingReplyId));
    if (repliedMessage) {
      const preview = document.createElement("div");
      preview.className = "chat-reply-preview";
      const quote = document.createElement("span");
      quote.className = "chat-reply-copy";
      const quoteName = document.createElement("strong");
      quoteName.textContent = repliedMessage.sender;
      const quoteText = document.createElement("span");
      quoteText.textContent = repliedMessage.text;
      quote.append(quoteName, quoteText);
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "chat-reply-cancel";
      cancel.dataset.cancelReply = "";
      cancel.setAttribute("aria-label", "Cancel reply");
      cancel.textContent = "×";
      preview.append(quote, cancel);
      form.append(preview);
    } else pendingReplyId = null;
  }
  const emojiPicker = document.createElement("div");
  emojiPicker.className = "emoji-picker";
  emojiPicker.hidden = true;
  emojiPicker.setAttribute("aria-label", "Choose an emoji");
  for (const emoji of ["🙂", "😂", "🥰", "👍", "🙏", "👏", "🎉", "❤️", "✨", "😅", "💯", "👋"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.emoji = emoji;
    button.setAttribute("aria-label", emoji);
    button.textContent = emoji;
    emojiPicker.append(button);
  }
  const controls = document.createElement("span");
  controls.className = "chat-compose-controls";
  const emojiButton = document.createElement("button");
  emojiButton.type = "button";
  emojiButton.className = "chat-icon-button";
  emojiButton.dataset.emojiToggle = "";
  emojiButton.setAttribute("aria-label", "Choose emoji");
  emojiButton.textContent = "☺";
  const input = document.createElement("textarea");
  input.name = "message";
  input.maxLength = 500;
  input.rows = 1;
  input.required = true;
  input.placeholder = "Write a message...";
  input.setAttribute("aria-label", "Message");
  const send = document.createElement("button");
  send.type = "submit";
  send.className = "chat-send";
  send.setAttribute("aria-label", "Send message");
  send.textContent = "↑";
  controls.append(emojiButton, input, send);
  form.append(emojiPicker, controls);
  messages.append(newMessages);
  target.replaceChildren(header, messages, form);
  input.value = draft;
  resizeChatInput(input);
  if (hadFocus) input.focus({ preventScroll: true });
  messages.scrollTop = wasNearBottom ? messages.scrollHeight : previousScrollTop;
  newMessages.hidden = wasNearBottom || (!hasNewMessages && (previousNewMessages?.hidden ?? true));
  if (activeConversationId === chat.id && state.activePage === "messages" && !document.hidden) {
    markConversationMessagesRead(chat.id).catch((error) => console.error("Could not mark Skillmate messages as read.", error));
  }
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
  if (typeof window.renderProfileCompleteness === "function") {
    window.renderProfileCompleteness(state.profile);
  }
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
  renderUserAvatar(document.querySelector(".profile-avatar"), state.profile);
  const ownReviews = state.reviews.filter((review) => review.providerId === ownProviderId());
  const ownRating = ownReviews.length ? (ownReviews.reduce((sum, review) => sum + review.rating, 0) / ownReviews.length).toFixed(1) : appSupabase ? "New" : "4.9";
  const ratingStat = document.querySelectorAll(".provider-stat")[2];
  ratingStat.querySelector("strong").textContent = `${ownRating} ★`;
  ratingStat.querySelector("small").textContent = `From ${appSupabase ? ownReviews.length : 23 + ownReviews.length} student reviews`;
  if (appUser) {
    document.querySelector("#view-home h1").innerHTML = `Welcome, ${escapeHTML(state.profile.name)} <span aria-hidden="true">✦</span>`;
    document.querySelector(".campus-card strong").textContent = state.profile.university || "University not set";
    document.querySelector(".campus-card small").textContent = state.profile.course || "STUDENT ACCOUNT";
    const providerHeading = document.querySelector(".provider-profile-main");
    renderUserAvatar(providerHeading.querySelector(".profile-avatar"), state.profile);
    providerHeading.querySelector(".verified-pill").textContent = verified ? "✓ Campus verified" : "Campus verification pending";
    providerHeading.querySelector("h2").textContent = state.profile.name;
    providerHeading.querySelector("p").textContent = `${state.profile.bio || "Student service provider"} · ${state.profile.university || "Campus not set"}`;
    providerHeading.querySelector(".profile-tags").innerHTML = [...new Set(state.services.map((service) => service.category))]
      .slice(0, 3).map((category) => `<span>${escapeHTML(category)}</span>`).join("");
  }
  function renderUserAvatar(element, profile) {
    const initials = initialsFor(profile.name);
    element.replaceChildren();
    if (profile.avatarUrl) {
      const image = document.createElement("img");
      image.src = profile.avatarUrl;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => {
        element.textContent = initials;
      }, { once: true });
      element.append(image);
    } else {
      element.textContent = initials;
    }
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
    appSupabase.from("profiles").select("id, full_name, university, course, bio, campus_verified, university_email, role, skills, avatar_url, onboarding_completed").eq("id", appUser.id).single(),
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
  if (!profile.onboarding_completed) {
    window.location.replace("onboarding.html");
    return;
  }
  document.querySelector("#admin-link").hidden = profile.role !== "admin";
  state.profile = {
    name: profile.full_name, university: profile.university, course: profile.course,
    bio: profile.bio, email: profile.university_email || appUser.email, verified: profile.campus_verified,
    skills: profile.skills || [], avatarUrl: profile.avatar_url || "",
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
  const ownActiveService = (ownServices.data || []).find((service) => service.is_active);
  if (ownActiveService && !providerMap.has(appUser.id)) {
    providerMap.set(appUser.id, {
      id: appUser.id, name: profile.full_name, initials: initialsFor(profile.full_name),
      campus: profile.university || "Campus not set", course: profile.course || "Student",
      category: ownActiveService.category, service: ownActiveService.title,
      description: ownActiveService.description, price: Number(ownActiveService.price),
      currency: ownActiveService.currency, rating: 0, reviews: 0, bookings: 0,
      color: "blue", verified: profile.campus_verified, available: "Message to ask",
      groups: ownActiveService.accepts_groups, portfolio: [],
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
  const groupedMessages = await loadConversationMessageGroups(conversations);
  const messages = conversations.map((conversation) => ({
    id: conversation.conversation_id, providerId: conversation.other_user_id, name: conversation.other_user_name,
    messages: groupedMessages.get(conversation.conversation_id) || [],
  }));
  state.messages = messages;
  syncMessageChannels();
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
  const groupedMessages = await loadConversationMessageGroups(conversations || []);
  state.messages = (conversations || []).map((conversation) => ({
    id: conversation.conversation_id,
    providerId: conversation.other_user_id,
    name: conversation.other_user_name,
    messages: groupedMessages.get(conversation.conversation_id) || [],
  }));
  syncMessageChannels();
  renderConversations({ preserveChatState: true });
}
async function refreshLiveActivity() {
  if (!appSupabase || !appUser || document.hidden || pendingActionCount || activityRefreshInProgress) return;
  const pageNeedsBookings = ["home", "bookings", "provider", "earnings"].includes(state.activePage);
  const pageNeedsMessages = state.activePage === "messages";
  if (!pageNeedsBookings && !pageNeedsMessages) return;
  activityRefreshInProgress = true;
  try {
    if (pageNeedsBookings) await refreshLiveBookings();
    if (pageNeedsMessages) await refreshLiveMessages();
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
  let timeoutId;
  const { data, error } = await Promise.race([
    appSupabase.auth.getSession(),
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("SESSION_CHECK_TIMEOUT")), 3000);
    }),
  ]).finally(() => window.clearTimeout(timeoutId));
  if (error) throw error;
  if (!data.session) {
    window.location.replace("login.html");
    return;
  }
  const { data: profile, error: profileError } = await appSupabase.from("profiles")
    .select("onboarding_completed").eq("id", data.session.user.id).single();
  if (profileError) throw profileError;
  if (!profile.onboarding_completed) {
    window.location.replace("onboarding.html");
    return;
  }
  await window.syncSkillmateServerSession(data.session);
  appUser = data.session.user;
  loadHiddenMessages();
  loadChatDrafts();
  loadPendingMessages();
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
  if (window.location.hash === "#profile") {
    openStudentProfileEditor();
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  window.setInterval(() => {
    refreshLiveActivity().catch((error) => console.error("Could not refresh Skillmate messages and bookings.", error));
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshLiveActivity().catch((error) => console.error("Could not refresh Skillmate messages and bookings.", error));
    }
  });
  window.addEventListener("online", () => {
    retryQueuedMessages().catch((error) => console.error("Could not retry saved Skillmate messages.", error));
  });
  if (navigator.onLine) {
    retryQueuedMessages().catch((error) => console.error("Could not retry saved Skillmate messages.", error));
  }
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
  if (appSupabase && appUser && ["home", "bookings", "messages", "provider", "earnings"].includes(page)) {
    refreshLiveActivity().catch((error) => console.error("Could not refresh Skillmate activity for this page.", error));
  }
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
    document.querySelector("#messages-layout").dataset.chatOpen = "true";
    renderConversations();
    showPage("messages");
    showToast("Conversation started.");
  }, "Could not send your message.");
});
document.querySelector("#conversation-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-chat]");
  if (!button) return;
  activeConversationId = button.dataset.chat;
  pendingReplyId = null;
  document.querySelector("#messages-layout").dataset.chatOpen = "true";
  renderConversations();
  markConversationMessagesRead(activeConversationId).catch((error) => console.error("Could not mark Skillmate messages as read.", error));
});
let conversationSearchTimer;
document.querySelector("#conversation-search").addEventListener("input", () => {
  window.clearTimeout(conversationSearchTimer);
  conversationSearchTimer = window.setTimeout(() => renderConversations({ preserveChatState: true }), 120);
});
document.querySelector("#chat-panel").addEventListener("click", (event) => {
  const retryButton = event.target.closest("[data-retry-message]");
  if (retryButton) {
    retryPendingMessage(retryButton.dataset.retryMessage);
    return;
  }
  if (event.target.closest("[data-chat-back]")) {
    activeConversationId = null;
    pendingReplyId = null;
    document.querySelector("#messages-layout").removeAttribute("data-chat-open");
    renderConversations();
    return;
  }
  if (event.target.closest("[data-cancel-reply]")) {
    pendingReplyId = null;
    renderChat({ preserveChatState: true });
    return;
  }
  if (event.target.closest("[data-emoji-toggle]")) {
    const picker = document.querySelector(".emoji-picker");
    picker.hidden = !picker.hidden;
    return;
  }
  const emojiButton = event.target.closest("[data-emoji]");
  if (emojiButton) {
    const input = document.querySelector('#chat-compose [name="message"]');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.setRangeText(emojiButton.dataset.emoji, start, end, "end");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    document.querySelector(".emoji-picker").hidden = true;
    return;
  }
  if (event.target.closest(".chat-new-messages")) {
    const messages = document.querySelector("#chat-messages");
    messages.scrollTo({ top: messages.scrollHeight, behavior: "smooth" });
    event.target.closest(".chat-new-messages").hidden = true;
    return;
  }
  const button = event.target.closest("[data-report]");
  if (button) {
    button.closest("details")?.removeAttribute("open");
    openReport(button.dataset.report);
  }
});
document.querySelector("#chat-panel").addEventListener("input", (event) => {
  if (event.target.name !== "message") return;
  resizeChatInput(event.target);
  const chat = state.messages.find((item) => item.id === activeConversationId);
  if (!chat) return;
  saveChatDraft(chat.id, event.target.value);
  if (!appSupabase) return;
  broadcastTyping(chat.id, true).catch((error) => console.error("Could not send a typing event.", error));
  window.clearTimeout(typingTimeoutId);
  typingTimeoutId = window.setTimeout(() => {
    broadcastTyping(chat.id, false).catch((error) => console.error("Could not clear the typing event.", error));
  }, 2000);
});
document.querySelector("#chat-panel").addEventListener("keydown", (event) => {
  if (event.target.name !== "message" || event.key !== "Enter" || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  event.target.closest("form").requestSubmit();
});
document.querySelector("#chat-panel").addEventListener("submit", (event) => {
  if (event.target.id !== "chat-compose") return;
  event.preventDefault();
  const input = event.target.querySelector('[name="message"]');
  const text = input.value.trim();
  if (!text) return;
  const chat = state.messages.find((item) => item.id === activeConversationId);
  if (!chat) return;
  const replyTo = pendingReplyId;
  input.value = "";
  saveChatDraft(chat.id, "");
  pendingReplyId = null;
  if (appSupabase) {
    const message = {
      id: createChatMessageId(),
      sender: "You",
      senderId: appUser.id,
      text,
      createdAt: new Date().toISOString(),
      time: formatChatTime(new Date()),
      replyTo: replyTo || null,
      sendStatus: navigator.onLine ? "sending" : "failed",
    };
    chat.messages.push(message);
    queuePendingMessage(chat, message);
    renderConversations({ preserveChatState: true });
    if (!navigator.onLine) {
      showToast("You’re offline. This message is saved on this device; tap Retry when you reconnect.");
      return;
    }
    runAction(() => sendPendingMessage(chat, message), "Message wasn't sent. It is saved on this device; tap Retry to try again.", "Sending message…");
    return;
  }
  const message = {
    id: `local-${Date.now()}`, sender: "You", senderId: "demo-self", text,
    createdAt: new Date().toISOString(), time: formatChatTime(new Date()),
    replyTo: replyTo || null,
  };
  chat.messages.push(message);
  linkMessageReplies(chat.messages);
  saveState();
  renderConversations({ preserveChatState: true });
});
document.querySelector("#chat-panel").addEventListener("contextmenu", (event) => {
  const row = event.target.closest("[data-message-id]");
  if (!row) return;
  event.preventDefault();
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const message = chat?.messages.find((item) => String(item.id) === row.dataset.messageId);
  if (message) openMessageContextMenu(message, event.clientX, event.clientY);
});
document.querySelector("#chat-panel").addEventListener("pointerdown", (event) => {
  const row = event.target.closest("[data-message-id]");
  if (!row || event.pointerType === "mouse") return;
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const message = chat?.messages.find((item) => String(item.id) === row.dataset.messageId);
  if (!message) return;
  pendingLongPressId = message.id;
  longPressTimeoutId = window.setTimeout(() => {
    if (pendingLongPressId !== message.id) return;
    openMessageContextMenu(message, event.clientX, event.clientY);
  }, 550);
});
document.querySelector("#chat-panel").addEventListener("pointerup", () => {
  window.clearTimeout(longPressTimeoutId);
  pendingLongPressId = null;
});
document.querySelector("#chat-panel").addEventListener("pointercancel", () => {
  window.clearTimeout(longPressTimeoutId);
  pendingLongPressId = null;
});
document.querySelector("#chat-panel").addEventListener("scroll", (event) => {
  if (event.target.id !== "chat-messages") return;
  const nearBottom = event.target.scrollHeight - event.target.scrollTop - event.target.clientHeight < 48;
  const button = document.querySelector(".chat-new-messages");
  if (button && nearBottom) button.hidden = true;
});
document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-message-action]");
  if (action) {
    const menu = action.closest("[data-context-message]");
    const chat = state.messages.find((item) => item.id === activeConversationId);
    const message = chat?.messages.find((item) => String(item.id) === menu?.dataset.contextMessage);
    closeMessageContextMenu();
    if (!message) return;
    if (action.dataset.messageAction === "reply") {
      pendingReplyId = message.id;
      renderChat({ preserveChatState: true });
      document.querySelector('#chat-compose [name="message"]')?.focus({ preventScroll: true });
    } else if (action.dataset.messageAction === "copy") {
      if (!navigator.clipboard?.writeText) {
        showToast("Copy is unavailable in this browser.");
        return;
      }
      navigator.clipboard.writeText(message.text).then(
        () => showToast("Message copied."),
        (error) => {
          console.error("Could not copy the Skillmate message.", error);
          showToast("Could not copy this message.");
        },
      );
    } else if (action.dataset.messageAction === "delete") {
      hiddenMessageIds.add(String(message.id));
      saveHiddenMessages();
      renderConversations({ preserveChatState: true });
      showToast("Message hidden on this device.");
    }
    return;
  }
  if (!event.target.closest(".chat-context-menu")) closeMessageContextMenu();
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
function openStudentProfileEditor() {
  document.querySelector("#profile-name").value = state.profile.name;
  document.querySelector("#profile-bio").value = state.profile.bio;
  document.querySelector("#profile-email").value = state.profile.email;
  document.querySelector("#profile-location").value = state.profile.location || "";
  openModal("profile-modal");
}
document.querySelector("#profile-menu").addEventListener("click", openStudentProfileEditor);
document.querySelector("#student-profile-link").addEventListener("click", (event) => {
  event.preventDefault();
  openStudentProfileEditor();
});
document.addEventListener("skillmate:edit-profile", openStudentProfileEditor);
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
  link.href = url; link.download = "skillmate-earnings.csv"; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  if (error?.message === "SESSION_CHECK_TIMEOUT") {
    window.location.replace("login.html");
    return;
  }
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
