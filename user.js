const storageKey = "skillflex-student-demo-v1";
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
const MESSAGE_PAGE_SIZE = 30;
const DATA_PAGE_SIZE = 100;
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
  profile: {
    name: "Alex Morgan", bio: "Graphic designer and laptop fixer who loves helping fellow students.",
    email: "alex.m@ug.edu.gh", location: "", verified: true, phoneNumber: "",
    notifyBookingUpdates: true, notifyMessages: true, skills: [], cvPath: "", cvName: "",
  },
};
let state = loadState();
const appSupabase = window.skillflexSupabase;
let appUser = null;
let connectedProviders = [];
let connectedServices = [];
let selectedCategory = "All";
let activeConversationId = null;
let activeBookingFilter = "all";
let bookingDirection = "made";
let groupProviderFilter = null;
let priceNegotiations = [];
let currentBookingNegotiationId = "";
const bookingDrafts = new Map();
let bookingSubmissionPending = false;
let negotiationBackendAvailable = true;
let pendingReplyId = null;
let messageMetadataAvailable = null;
let messageMetadataWarningShown = false;
const chatDrafts = new Map();
const chatNegotiationServiceSelection = new Map();
const conversationsOpeningNegotiation = new Set();
const pendingOutgoingMessages = new Map();
const sendingMessageIds = new Set();
let typingTimeoutId = null;
let longPressTimeoutId = null;
let pendingLongPressId = null;
const messageChannels = new Map();
const realtimeFallbackChatIds = new Set();
const messageChannelRetryTimers = new Map();
const messageChannelRetryAttempts = new Map();
const messagePresence = new Map();
const messageConnectionStatusTimers = new Map();
const conversationMessageRefreshes = new Set();
const conversationMessageRefreshTimes = new Map();
const hiddenMessageIds = new Set();
const readUpdatesInProgress = new Set();
const presenceTypingTimers = new Map();
let toastTimer;
let toastExitTimer;
let globalSearchTimer;
let pendingActionCount = 0;
let activityRefreshInProgress = false;
let dashboardDataLoaded = false;
let dashboardLoadError = null;
const pendingProviderSaves = new Set();
const pendingGroupActions = new Set();
const pendingServiceToggles = new Set();
const pendingBookingStatuses = new Map();
const DASHBOARD_LOAD_ESTIMATE_KEY = "skillflex-dashboard-load-estimate-ms-v1";
const ACTION_LOAD_ESTIMATE_MS = 15000;
let dashboardLoadEstimateMs = ACTION_LOAD_ESTIMATE_MS;
let dashboardLoadingStartedAt = 0;
let dashboardLoadingProgress = 10;
let dashboardLoadingPhase = "Checking your session…";
let dashboardLoadingInterval = null;
const ownProviderId = () => appUser?.id || "alex";
const isOwnBooking = (booking) => booking.providerId === ownProviderId();
const messageColumns = "id, conversation_id, sender_id, body, created_at, read_at, delivered_at, reply_to";
const legacyMessageColumns = "id, conversation_id, sender_id, body, created_at, read_at";
const olderMessagesAvailable = new Map();

function chatMessagesStorageKey() {
  return `skillflex-chat-messages:${appUser?.id || "demo"}`;
}

function loadCachedConversationMessages() {
  try {
    const cached = JSON.parse(localStorage.getItem(chatMessagesStorageKey()) || "[]");
    if (!Array.isArray(cached)) throw new Error("Cached conversation history has an invalid format.");
    return cached.filter((chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages))
      .map((chat) => ({ ...chat, messages: chat.messages.slice(-MESSAGE_PAGE_SIZE) }));
  } catch (error) {
    console.error("Could not load cached Skill Flex conversations.", error);
    return [];
  }
}

function cacheConversationMessages(conversations) {
  try {
    const cached = conversations.map((chat) => ({
      id: chat.id,
      providerId: chat.providerId,
      name: chat.name,
      messages: chat.messages.slice(-MESSAGE_PAGE_SIZE),
    }));
    localStorage.setItem(chatMessagesStorageKey(), JSON.stringify(cached));
  } catch (error) {
    console.error("Could not cache Skill Flex conversation history.", error);
  }
}

function isMissingMessageMetadata(error) {
  return ["42703", "PGRST204"].includes(error?.code)
    && /delivered_at|reply_to/i.test(`${error.message || ""} ${error.details || ""}`);
}

async function loadConversationMessages(chatId, otherUserName = "Student") {
  const conversation = { conversation_id: chatId, other_user_name: otherUserName };
  const messages = await loadConversationMessageGroups([conversation]);
  return messages.get(chatId) || [];
}

let batchMessagesAvailable = true;
async function loadConversationMessageGroups(conversations) {
  const started = performance.now();
  try {
    return await loadConversationMessagePages(conversations);
  } finally {
    performance.measure("skillflex:message-load", { start: started, end: performance.now() });
  }
}

async function loadConversationMessagePages(conversations) {
  const grouped = new Map(conversations.map((conversation) => [conversation.conversation_id, []]));
  if (!conversations.length) return grouped;
  if (batchMessagesAvailable && conversations.length > 1) {
    const rows = [];
    for (let offset = 0; offset < conversations.length; offset += 20) {
      const { data, error } = await appSupabase.rpc("recent_conversation_messages", {
        conversation_ids: conversations.slice(offset, offset + 20).map(item => item.conversation_id),
        page_size: MESSAGE_PAGE_SIZE,
      }).select(messageMetadataAvailable === false ? legacyMessageColumns : messageColumns);
      if (error) {
        if (["PGRST202", "42883"].includes(error.code) || isMissingMessageMetadata(error)) {
          batchMessagesAvailable = false;
          console.info("Batch message loading requires the latest database migrations; using individual history requests.");
          break;
        }
        throw error;
      }
      rows.push(...(data || []));
    }
    if (batchMessagesAvailable) {
      const names = new Map(conversations.map(item => [item.conversation_id, item.other_user_name || "Student"]));
      for (const row of rows) grouped.get(row.conversation_id)?.push(normalizeMessageRow(row, names.get(row.conversation_id)));
      for (const [id, messages] of grouped) {
        // The RPC returns newest first within each conversation.
        messages.reverse();
        olderMessagesAvailable.set(id, messages.length === MESSAGE_PAGE_SIZE);
        grouped.set(id, mergePendingMessages(id, messages));
      }
      return grouped;
    }
  }
  const pages = await Promise.all(conversations.map(async (conversation) => {
    const selectMessages = (columns) => appSupabase.from("messages")
      .select(columns)
      .eq("conversation_id", conversation.conversation_id)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
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
    const messages = (data || []).reverse()
      .map((row) => normalizeMessageRow(row, conversation.other_user_name || "Student"));
    olderMessagesAvailable.set(conversation.conversation_id, messages.length === MESSAGE_PAGE_SIZE);
    return [conversation.conversation_id, mergePendingMessages(conversation.conversation_id, messages)];
  }));
  pages.forEach(([conversationId, messages]) => grouped.set(conversationId, messages));
  return grouped;
}

function chatDraftStorageKey() {
  return `skillflex-chat-drafts:${appUser?.id || "demo"}`;
}
function setActiveConversation(conversationId) {
  activeConversationId = conversationId;
  syncMessageChannels();
}
function pendingMessageStorageKey() {
  return `skillflex-pending-messages:${appUser?.id || "demo"}`;
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
function retainLocalOutgoingMessages(currentMessages, refreshedMessages) {
  const merged = new Map(refreshedMessages.map((message) => [String(message.id), message]));
  for (const message of currentMessages) {
    if (message.senderId === appUser?.id && !merged.has(String(message.id))) {
      merged.set(String(message.id), message);
    }
  }
  return [...merged.values()].sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
}
function createChatMessageId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((byte, index) => `${[4, 6, 8, 10].includes(index) ? "-" : ""}${byte.toString(16).padStart(2, "0")}`).join("");
}
function createOutgoingMessage(text, replyTo = null) {
  const createdAt = new Date();
  return {
    id: createChatMessageId(), sender: "You", senderId: appUser.id, text,
    createdAt: createdAt.toISOString(), time: formatChatTime(createdAt),
    replyTo, sendStatus: navigator.onLine ? "sending" : "failed",
  };
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
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 15000);
      try {
        return await appSupabase.from("messages").insert(payload)
          .select(includeMetadata ? messageColumns : legacyMessageColumns).single()
          .abortSignal(controller.signal);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };
    let includeMetadata = messageMetadataAvailable !== false;
    let result = await insertMessage(includeMetadata);
    if (result.error && isMissingMessageMetadata(result.error)) {
      messageMetadataAvailable = false;
      includeMetadata = false;
      if (!messageMetadataWarningShown) {
        messageMetadataWarningShown = true;
        console.warn("Chat metadata columns are missing. Apply the messaging migration to enable delivery receipts and replies.");
      }
      result = await insertMessage(false);
    }
    if (result.error?.code === "23505") {
      const existing = await appSupabase.from("messages")
        .select(legacyMessageColumns).eq("id", message.id).eq("conversation_id", chat.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data?.sender_id === appUser.id && existing.data.conversation_id === chat.id
          && existing.data.body === message.text) {
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
    cacheConversationMessages(state.messages);
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
function sendMessageWithoutBlocking(chat, message, failureMessage) {
  sendPendingMessage(chat, message).catch((error) => {
    console.error(failureMessage, error);
    const message = error?.name === "AbortError"
      ? "Message send timed out. It is saved on this device; tap Retry to try again."
      : error?.message || failureMessage;
    showToast(message, "error");
  });
}
function retryPendingMessage(messageId) {
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const message = chat?.messages.find((item) => String(item.id) === String(messageId));
  if (!chat || !message) return;
  queuePendingMessage(chat, message);
  sendMessageWithoutBlocking(chat, message, "Message wasn't sent. It is saved on this device; tap Retry to try again.");
}
async function retryQueuedMessages() {
  for (const pending of [...pendingOutgoingMessages.values()]) {
    const chat = state.messages.find((item) => item.id === pending.conversationId);
    const message = chat?.messages.find((item) => String(item.id) === String(pending.id));
    if (chat && message && !sendingMessageIds.has(String(message.id))) {
      sendMessageWithoutBlocking(chat, message, "A saved message could not be sent.");
    }
  }
}

function loadState() {
  if (window.skillflexSupabase) return { ...structuredClone(defaultState), bookings: [], services: [], groups: [], saved: [], blocked: [], reviews: [], portfolio: [], messages: [] };
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return structuredClone(defaultState);
    return { ...structuredClone(defaultState), ...JSON.parse(saved) };
  } catch (error) {
    console.error("Could not load the Skill Flex demo state.", error);
    return structuredClone(defaultState);
  }
}
function saveState() {
  if (appSupabase) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.error("Could not save the Skill Flex demo state.", error);
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
        description: state.profile.bio || "Student on Skill Flex", service: "", price: 0, rating: 0, reviews: 0,
        bookings: 0, available: "Ask about availability", groups: false, portfolio: [],
        skills: state.profile.skills || [], cvPath: state.profile.cvPath || "", cvName: state.profile.cvName || "",
      };
    }
    const provider = connectedProviders.find((item) => item.id === id);
    if (provider) return provider;
    const conversation = state.messages.find((item) => item.providerId === id);
    if (conversation) {
      const name = conversation.name || "Student";
      return { id, name, initials: initialsFor(name), campus: "Skill Flex student", course: "Student", category: "Other", verified: false, color: "sky" };
    }
    const booking = state.bookings.find((item) => item.id === id || `customer:${item.id}` === id);
    if (booking && id.startsWith("customer:")) {
      const name = booking.customer || "Student";
      return { id, name, initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(), campus: "Skill Flex student", course: "Student", category: "Other", verified: false, color: "sky" };
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
function showToast(message, kind = "info") {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastExitTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("visible");
    toastExitTimer = window.setTimeout(() => { delete toast.dataset.kind; }, 250);
  }, 4000);
}
function syncChatVisualViewport() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const root = document.documentElement;
  root.style.setProperty("--chat-visual-height", `${Math.round(viewport.height)}px`);
  root.style.setProperty("--chat-visual-top", `${Math.round(viewport.offsetTop)}px`);
  const mobileViewport = window.innerWidth <= 768;
  const bottomOffset = mobileViewport
    ? Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height)
    : 0;
  root.style.setProperty("--mobile-nav-viewport-bottom", `${Math.round(bottomOffset)}px`);
  const activeElement = document.activeElement;
  const textEntryFocused = activeElement instanceof HTMLElement
    && (activeElement.matches('textarea, input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])')
      || activeElement.isContentEditable);
  const keyboardOpen = mobileViewport && textEntryFocused
    && (window.innerHeight - viewport.height > 120 || window.screen.height - viewport.height > 220);
  document.body.classList.toggle("mobile-keyboard-open", keyboardOpen);
}
syncChatVisualViewport();
window.addEventListener("resize", syncChatVisualViewport);
window.visualViewport?.addEventListener("resize", syncChatVisualViewport);
window.visualViewport?.addEventListener("scroll", syncChatVisualViewport);
document.addEventListener("focusin", syncChatVisualViewport);
document.addEventListener("focusout", () => requestAnimationFrame(syncChatVisualViewport));
function hiddenMessageStorageKey() {
  return `skillflex-hidden-messages:${appUser?.id || "demo"}`;
}
function loadHiddenMessages() {
  hiddenMessageIds.clear();
  try {
    const saved = JSON.parse(localStorage.getItem(hiddenMessageStorageKey()) || "[]");
    if (Array.isArray(saved)) saved.forEach((id) => hiddenMessageIds.add(String(id)));
  } catch (error) {
    console.error("Could not load locally hidden Skill Flex messages.", error);
  }
}
function saveHiddenMessages() {
  try {
    localStorage.setItem(hiddenMessageStorageKey(), JSON.stringify([...hiddenMessageIds]));
  } catch (error) {
    console.error("Could not save locally hidden Skill Flex messages.", error);
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
  if (presence?.connection === "connecting") return "Connecting…";
  if (presence?.connection === "restored") return "Connection restored";
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
  const header = status.closest(".chat-header");
  status.textContent = currentChatStatus(chat);
  status.dataset.status = presence?.connection || (presence?.online ? "online" : presence?.typing ? "typing" : "offline");
  if (header) header.dataset.connection = presence?.connection || "connected";
}
function clearChatConnectionStatusTimer(chatId) {
  const timer = messageConnectionStatusTimers.get(chatId);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    messageConnectionStatusTimers.delete(chatId);
  }
}
function retryMessageChannel(chatId, channel) {
  if (messageChannels.get(chatId) !== channel) return;
  messageChannels.delete(chatId);
  clearChatConnectionStatusTimer(chatId);
  setChatPresenceStatus(chatId, { online: false, typing: false, connection: "connecting" });
  realtimeFallbackChatIds.add(chatId);
  const attempt = messageChannelRetryAttempts.get(chatId) || 0;
  const delay = Math.min(30000, 1000 * (2 ** attempt));
  messageChannelRetryAttempts.set(chatId, attempt + 1);
  messageChannelRetryTimers.set(chatId, window.setTimeout(() => {
    messageChannelRetryTimers.delete(chatId);
    if (!appUser || !state.messages.some((chat) => chat.id === chatId && !state.blocked.includes(chat.providerId))) return;
    syncMessageChannels();
  }, delay));
  appSupabase.removeChannel(channel).then((status) => {
    if (status !== "ok") console.warn("Could not remove a failed Skill Flex chat channel.", status, chatId);
  }).catch((error) => console.error("Could not clean up a failed Skill Flex chat channel.", error, chatId));
}
function syncMessageChannels() {
  if (!appSupabase || !appUser) return;
  const conversations = state.activePage === "messages" && activeConversationId
    ? state.messages.filter((chat) => chat.id === activeConversationId && !state.blocked.includes(chat.providerId))
    : [];
  const activeIds = new Set(conversations.map((chat) => chat.id));
  for (const id of realtimeFallbackChatIds) {
    if (!activeIds.has(id)) realtimeFallbackChatIds.delete(id);
  }
  for (const [id, timer] of messageChannelRetryTimers) {
    if (activeIds.has(id)) continue;
    window.clearTimeout(timer);
    messageChannelRetryTimers.delete(id);
    messageChannelRetryAttempts.delete(id);
  }
  for (const [id, channel] of messageChannels) {
    if (!activeIds.has(id)) {
      messageChannels.delete(id);
      messagePresence.delete(id);
      clearChatConnectionStatusTimer(id);
      appSupabase.removeChannel(channel).then((status) => {
        if (status !== "ok") console.warn("Could not remove an inactive Skill Flex chat channel.", status, id);
      }).catch((error) => console.error("Could not clean up an inactive Skill Flex chat channel.", error, id));
    }
  }
  for (const chat of conversations) {
    if (messageChannels.has(chat.id) || messageChannelRetryTimers.has(chat.id)) continue;
    setChatPresenceStatus(chat.id, { connection: "connecting" });
    const channel = appSupabase.channel(`skillflex-chat:${chat.id}`, { config: { private: true, presence: { key: appUser.id } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${chat.id}` }, (payload) => {
        const delivery = payload.eventType === "INSERT" && payload.new?.sender_id !== appUser.id
          ? markConversationMessagesDelivered(chat.id)
          : Promise.resolve();
        delivery.then(() => refreshConversationMessages(chat.id, { force: true }))
          .catch((error) => console.error("Could not refresh a realtime Skill Flex conversation.", error));
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
      });
    // Register before subscribing: a transport may report its status immediately.
    messageChannels.set(chat.id, channel);
    channel.subscribe(async (status, error) => {
        if (messageChannels.get(chat.id) !== channel) return;
        if (status === "SUBSCRIBED") {
          messageChannelRetryAttempts.delete(chat.id);
          realtimeFallbackChatIds.delete(chat.id);
          clearChatConnectionStatusTimer(chat.id);
          setChatPresenceStatus(chat.id, { connection: "restored" });
          messageConnectionStatusTimers.set(chat.id, window.setTimeout(() => {
            messageConnectionStatusTimers.delete(chat.id);
            if (messagePresence.get(chat.id)?.connection === "restored") {
              setChatPresenceStatus(chat.id, { connection: null });
            }
          }, 3000));
          const { error } = await channel.track({ user_id: appUser.id, typing: false, online_at: new Date().toISOString() });
          if (error) console.error("Could not publish Skill Flex chat presence.", error);
          try {
            await markConversationMessagesDelivered(chat.id);
          } catch (deliveryError) {
            console.error("Could not mark existing Skill Flex messages delivered.", deliveryError);
          }
          if (activeConversationId === chat.id && state.activePage === "messages" && !document.hidden) {
            markConversationMessagesRead(chat.id).catch((error) => console.error("Could not mark Skill Flex messages as read.", error));
          }
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          console.warn(`Skill Flex chat realtime channel ${status.toLowerCase()}; fallback polling is enabled while it reconnects.`, chat.id, error || "");
          retryMessageChannel(chat.id, channel);
        }
      });
  }
}
async function broadcastTyping(chatId, typing) {
  const channel = messageChannels.get(chatId);
  if (!channel) return;
  const status = await channel.send({ type: "broadcast", event: "typing", payload: { sender_id: appUser.id, typing } });
  if (status !== "ok") console.error("Could not update Skill Flex typing status.", status);
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
  const chat = state.messages.find((item) => item.id === chatId);
  if (!chat?.messages.some((message) => message.senderId && message.senderId !== appUser.id && !message.readAt)) return;
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
    if (chat) {
      chat.messages.forEach((message) => {
        if (message.senderId && message.senderId !== appUser.id && !message.readAt) {
          message.deliveredAt = readAt;
          message.readAt = readAt;
        }
      });
      cacheConversationMessages(state.messages);
      renderConversations({ preserveChatState: true });
    }
  } finally {
    readUpdatesInProgress.delete(chatId);
  }
}
async function refreshConversationMessages(chatId, { force = false } = {}) {
  if (!appSupabase || !appUser) return;
  if (!force && Date.now() - (conversationMessageRefreshTimes.get(chatId) || 0) < 4000) return;
  if (conversationMessageRefreshes.has(chatId)) return;
  conversationMessageRefreshes.add(chatId);
  try {
    const chat = state.messages.find((item) => item.id === chatId);
    if (!chat) {
      await refreshLiveMessages();
      return;
    }
    const data = await loadConversationMessages(chatId, chat.name || getProvider(chat.providerId)?.name || "Student");
    conversationMessageRefreshTimes.set(chatId, Date.now());
    const nextMessages = linkMessageReplies(retainLocalOutgoingMessages(chat.messages, data));
    const unchanged = nextMessages.length === chat.messages.length
      && nextMessages.every((message, index) => {
        const current = chat.messages[index];
        return String(message.id) === String(current.id)
          && message.text === current.text
          && message.createdAt === current.createdAt
          && message.readAt === current.readAt
          && message.deliveredAt === current.deliveredAt
          && message.replyTo === current.replyTo
          && message.sendStatus === current.sendStatus;
      });
    if (unchanged) return;
    chat.messages = nextMessages;
      cacheConversationMessages(state.messages);
    renderConversations({ preserveChatState: true });
  } finally {
    conversationMessageRefreshes.delete(chatId);
  }
}
async function loadOlderConversationMessages(chatId) {
  if (!appSupabase || !appUser || conversationMessageRefreshes.has(chatId) || !olderMessagesAvailable.get(chatId)) return;
  const chat = state.messages.find((item) => item.id === chatId);
  const oldestMessage = chat?.messages.find((message) => message.createdAt);
  if (!chat || !oldestMessage) {
    olderMessagesAvailable.set(chatId, false);
    return;
  }
  conversationMessageRefreshes.add(chatId);
  try {
    const selectMessages = (columns) => appSupabase.from("messages")
      .select(columns)
      .eq("conversation_id", chatId)
      .lt("created_at", oldestMessage.createdAt)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
    let { data, error } = await selectMessages(messageMetadataAvailable === false ? legacyMessageColumns : messageColumns);
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
    const olderMessages = (data || []).reverse()
      .map((message) => normalizeMessageRow(message, chat.name || "Student"));
    olderMessagesAvailable.set(chatId, olderMessages.length === MESSAGE_PAGE_SIZE);
    if (!olderMessages.length) return;
    const knownIds = new Set(chat.messages.map((message) => String(message.id)));
    chat.messages = linkMessageReplies([
      ...olderMessages.filter((message) => !knownIds.has(String(message.id))),
      ...chat.messages,
    ]);
    cacheConversationMessages(state.messages);
    renderConversations({ preserveChatState: true, preserveScrollAnchor: true });
  } finally {
    conversationMessageRefreshes.delete(chatId);
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
function categoryOutlineIcon(category) {
  const paths = {
    All: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    Tutoring: '<path d="M12 5c-3-2-7-2-10-1v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 1v16"/>',
    Design: '<path d="m4 16-1 5 5-1L21 7l-4-4L4 16Zm10-10 4 4M4 16l4 4"/>',
    Writing: '<path d="M4 4h16M12 4v16M8 20h8"/>',
    "Tech Support": '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 8h10"/>',
    "Media & Editing": '<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12" r="4"/><path d="M8 5l1-2h6l1 2"/>',
    Events: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3"/>',
    Lifestyle: '<path d="M12 21S3 15 3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 13-9 13Z"/>',
  };
  const alias = { "Tech help": "Tech Support", "Writing & editing": "Writing", Photography: "Media & Editing", "Events & entertainment": "Events" };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[category] || paths[alias[category]] || paths.Lifestyle}</svg>`;
}
function renderServiceCategories() {
  const strip = document.querySelector("#category-strip");
  const currentCategory = [...serviceCategories, ...window.skillflexMarketplace.popularCategories].includes(selectedCategory) ? selectedCategory : "All";
  selectedCategory = currentCategory;
  const popular = window.skillflexMarketplace.popularCategories;
  const categoryButton = (category) => `
    <button class="category-chip ${category === currentCategory ? "selected" : ""}" data-category="${escapeHTML(category)}" type="button" aria-pressed="${category === currentCategory}">
      ${categoryOutlineIcon(category)} <span>${category === "All" ? "All Services" : escapeHTML(category)}</span>
    </button>`;
  strip.innerHTML = popular.map(categoryButton).join("") + `<button class="category-chip more-categories ${popular.includes(currentCategory) ? "" : "selected"}" type="button" data-open="category-modal" aria-haspopup="dialog" aria-controls="category-modal">${popular.includes(currentCategory) ? "More" : escapeHTML(currentCategory)} <span aria-hidden="true">＋</span></button>`;
  document.querySelector("#all-categories").innerHTML = ["All", ...serviceCategories].map(categoryButton).join("");

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
  const totalReviews = (appSupabase ? 0 : Number(provider.reviews) || 0) + reviews.length;
  const totalRating = (appSupabase ? 0 : provider.rating * provider.reviews) + reviews.reduce((sum, review) => sum + Number(review.rating), 0);
  return { rating: totalReviews ? (totalRating / totalReviews).toFixed(1) : "New", count: totalReviews };
}
function providerReviews(providerId) {
  return state.reviews
    .filter((review) => review.providerId === providerId)
    .sort((left, right) => new Date(right.date) - new Date(left.date));
}
function pendingCustomerReviews() {
  if (appSupabase && !dashboardDataLoaded) return [];
  return state.bookings.filter((booking) => booking.status === "Completed" && !booking.reviewed
    && (appUser ? booking.customerId === appUser.id : !isOwnBooking(booking)));
}
function openBookingReview(booking) {
  if (!booking) return;
  const provider = getProvider(booking.providerId);
  document.querySelector("#review-form").reset();
  document.querySelector("#review-booking-id").value = booking.id;
  document.querySelector("#review-description").textContent =
    `Share a fair review of your completed booking with ${provider?.name || "this student"}.`;
  openModal("review-modal");
}
function marketplaceSearchScore(provider, query) {
  const normalizedQuery = window.skillflexSmartSearch.normalize(query);
  const fields = [
    [provider.service, 12],
    [provider.category, 9],
    [provider.name, 7],
    [[provider.description, provider.course, provider.campus].join(" "), 2],
  ];
  return fields.reduce((score, [value, weight]) => {
    const text = window.skillflexSmartSearch.normalize(value);
    if (text.includes(normalizedQuery)) return score + weight * 2;
    return score + normalizedQuery.split(" ").filter((term) => text.split(" ").some((word) => word.startsWith(term))).length * weight;
  }, 0);
}
function providerAvatarMarkup(provider) {
  const image = window.skillflexMarketplace.safeImageUrl(provider.avatarUrl);
  return `<span class="provider-avatar avatar-${escapeHTML(provider.color)}${provider.verified ? " is-verified" : ""}"><span>${escapeHTML(provider.initials)}</span>${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async" />` : ""}</span>`;
}
function listingImage(provider) {
  const work = (provider.portfolio || []).find(item => typeof item === "object" && item.image);
  return window.skillflexMarketplace.safeImageUrl(serviceCoverUrl(provider) || work?.image);
}
function marketplaceEntries(providers) {
  if (appSupabase) return window.skillflexMarketplace.expandListings(providers, connectedServices);
  const activeServices = (state.services || []).filter((service) => service.active !== false)
    .map((service) => ({ ...service, providerId: ownProviderId() }));
  if (!activeServices.length) return providers;
  const providerId = ownProviderId();
  const ownProvider = {
    id: providerId,
    name: state.profile.name || "Student",
    initials: initialsFor(state.profile.name || "Student"),
    avatarUrl: state.profile.avatarUrl || "",
    campus: state.profile.university || "Campus not set",
    course: state.profile.course || "Student",
    bio: state.profile.bio || "",
    verified: state.profile.verified,
    color: "blue",
    bookings: 0,
    portfolio: state.portfolio || [],
  };
  return window.skillflexMarketplace.expandListings(
    [...providers.filter((provider) => provider.id !== providerId), ownProvider],
    activeServices,
  );
}
function publishServiceToMarketplace(service) {
  if (!appSupabase || !appUser?.id || !service?.id) return;
  const publishedService = {
    id: service.id,
    providerId: appUser.id,
    title: service.title,
    category: service.category,
    description: service.description,
    price: Number(service.price),
    currency: service.currency || "GHS",
    groups: Boolean(service.groups),
    active: service.active !== false,
    createdAt: service.createdAt || new Date().toISOString(),
    deliveryMethod: service.deliveryMethod || "",
    estimatedDelivery: service.estimatedDelivery || "",
    priceType: service.priceType || "fixed",
    minimumPrice: service.minimumPrice ?? null,
    coverImagePath: service.coverImagePath || "",
    coverImage: service.coverImage || "",
    negotiationMode: service.negotiationMode || "negotiation",
  };
  connectedServices = [publishedService, ...connectedServices.filter((item) => item.id !== publishedService.id)];
  if (publishedService.active && !connectedProviders.some((provider) => provider.id === appUser.id)) {
    const name = state.profile.name || "Student";
    connectedProviders = [{
      id: appUser.id,
      name,
      initials: initialsFor(name),
      avatarUrl: state.profile.avatarUrl || "",
      campus: state.profile.university || "Campus not set",
      course: state.profile.course || "Student",
      bio: state.profile.bio || "",
      category: publishedService.category,
      service: publishedService.title,
      description: publishedService.description,
      price: publishedService.price,
      currency: publishedService.currency,
      rating: 0,
      reviews: 0,
      bookings: 0,
      color: "blue",
      verified: state.profile.verified,
      available: "Message to ask",
      groups: publishedService.groups,
      portfolio: [],
      ...window.skillflexServiceUtils.metadata({
        cover_image_path: publishedService.coverImagePath,
        delivery_method: publishedService.deliveryMethod,
        estimated_delivery: publishedService.estimatedDelivery,
        negotiation_mode: publishedService.negotiationMode,
      }),
    }, ...connectedProviders];
  }
  renderMarketplace();
}
window.skillflexOnServicePublished = publishServiceToMarketplace;
function latestMarketplaceListings(listings) {
  return listings.slice(0, 2);
}
// Shown instead of an empty state when account data could not be loaded, so a failure never reads as "nothing here".
const pendingDataRegions = new Map();
function renderPendingData(target, count, variant) {
  if (!target) return false;
  if (appSupabase && !dashboardDataLoaded && !count) {
    if (!pendingDataRegions.has(target)) {
      target.replaceChildren();
      pendingDataRegions.set(target, window.skillflexLoading.show(target, { variant, count: 3, label: "Loading your account data" }));
    }
    return true;
  }
  pendingDataRegions.get(target)?.();
  pendingDataRegions.delete(target);
  return false;
}
function renderLoadFailure(target, { focus = false } = {}) {
  if (!appSupabase || !dashboardLoadError || !target) return false;
  window.skillflexLoading.showError(target, {
    title: "We couldn’t load this",
    message: "Your Skill Flex data didn’t load. Check your connection and try again.",
    focus,
    onRetry: () => retryDashboardData(),
  });
  return true;
}
async function retryDashboardData() {
  if (dashboardRefreshPromise) return;
  const originId = document.activeElement?.closest?.("#marketplace-grid, #saved-grid, #user-booking-list, #earnings-list, #listing-list, #conversation-list")?.id;
  dashboardLoadError = null;
  dashboardDataLoaded = false;
  renderAll();
  try {
    await refreshSupabaseState();
  } catch (retryError) {
    dashboardLoadError = retryError;
    console.error("Could not refresh Skill Flex account data.", retryError);
  }
  dashboardDataLoaded = true;
  renderAll();
  // The retry button was replaced, so hand focus to the retry button again or to the refreshed region.
  const origin = originId && document.getElementById(originId);
  if (origin && (document.activeElement === document.body || origin.contains(document.activeElement))) {
    const nextRetry = origin.querySelector("[data-loading-retry]");
    if (nextRetry) nextRetry.focus();
    else { origin.tabIndex = -1; origin.focus({ preventScroll: true }); }
  }
}
function renderMarketplace(targetId = "marketplace-grid", providers = appSupabase ? connectedProviders : seedProviders) {
  const target = document.getElementById(targetId);
  if (!target) return;
  if (["marketplace-grid", "saved-grid"].includes(targetId) && renderPendingData(target, connectedProviders.length, "cards")) return;
  target.removeAttribute("aria-busy");
  if (["marketplace-grid", "saved-grid"].includes(targetId) && dashboardLoadError && !connectedProviders.length && renderLoadFailure(target)) return;
  const query = targetId === "saved-grid" ? "" : document.querySelector("#global-search").value.trim();
  const campus = state.profile?.university || "";
  const matching = marketplaceEntries(providers).filter((provider) => {
    if (state.blocked.includes(provider.id)) return false;
    if (targetId === "recent-grid" && !Number.isFinite(Date.parse(provider.createdAt))) return false;
    if (targetId !== "saved-grid" && window.skillflexMarketplace.campusRank(provider, campus) === null) return false;
    if (targetId !== "saved-grid" && !window.skillflexMarketplace.matchesCategory(provider.category, selectedCategory)) return false;
    return (targetId === "saved-grid" || !window.skillflexGrowth || window.skillflexGrowth.matches(provider)) && window.skillflexSmartSearch.matches(provider, query);
  });
  let visible = window.skillflexMarketplace.sortByCampus(matching, campus, (left, right) => (
    (targetId !== "saved-grid" && window.skillflexGrowth?.compare(left, right)) || (query
      ? marketplaceSearchScore(right, query) - marketplaceSearchScore(left, query)
      : Number(right.bookings || 0) - Number(left.bookings || 0))
  ));
  const newestFirst = targetId === "recent-grid" || document.querySelector('#marketplace-filters [name="sort"]')?.value === "newest";
  if (newestFirst && targetId !== "saved-grid") visible.sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  if (targetId === "recent-grid") visible = latestMarketplaceListings(visible);
  if (targetId === "marketplace-grid") {
    document.querySelector("#marketplace-result-count").textContent = `${visible.length} ${visible.length === 1 ? "service" : "services"}`;
    document.querySelector("#marketplace-heading").textContent = query ? "Search results" : newestFirst ? "Recently added" : selectedCategory === "All" ? "Featured services" : selectedCategory;
    document.querySelector("#marketplace-description").textContent = query || selectedCategory !== "All" ? "Find the right student for what you need." : newestFirst ? "Newest listings first. Services without publication dates appear last." : "Popular services from talented students on your campus.";
    const status = document.querySelector("#search-status");
    status.hidden = !query;
    status.textContent = query
      ? `${visible.length} ${visible.length === 1 ? "service" : "services"} found for “${query}”. Related skills and common typos are included.`
      : "";
  }
  target.innerHTML = visible.length ? visible.map((provider) => `
    <article class="provider-card">
      <div class="provider-card-cover cover-${escapeHTML(provider.color)}"><button type="button" class="listing-cover-button" data-profile="${escapeHTML(provider.id)}" data-service="${escapeHTML(provider.serviceId || "")}" aria-label="View ${escapeHTML(provider.service)} details"><span class="cover-fallback"><span aria-hidden="true">${categoryOutlineIcon(provider.category)}</span><strong>${escapeHTML(provider.category)}</strong><small>Student service</small></span>${listingImage(provider) ? `<img class="service-marketplace-cover" src="${escapeHTML(listingImage(provider))}" alt="" loading="lazy" decoding="async" />` : ""}</button>${provider.id === appUser?.id ? '<span class="own-listing-label">Your listing</span>' : `<button class="save-button ${state.saved.includes(provider.id) ? "is-saved" : ""}" type="button" data-save="${escapeHTML(provider.id)}" aria-pressed="${state.saved.includes(provider.id)}" aria-label="${state.saved.includes(provider.id) ? "Remove saved provider" : "Save provider"}">${state.saved.includes(provider.id) ? "♥" : "♡"}</button>`}</div>
      <div class="provider-card-body">
        <div class="listing-category-row"><p class="service-category">${escapeHTML(provider.category)}</p><span class="rating${providerReviewSummary(provider).count ? "" : " is-new"}">${providerReviewSummary(provider).count ? `★ ${providerReviewSummary(provider).rating}<small> (${providerReviewSummary(provider).count})</small>` : "New provider"}</span></div>
        <h3><button type="button" data-profile="${escapeHTML(provider.id)}" data-service="${escapeHTML(provider.serviceId || "")}">${escapeHTML(provider.service)}</button></h3><p class="provider-description">${escapeHTML(provider.description)}</p>
        <div class="provider-card-person"><button class="provider-profile-trigger" type="button" data-profile="${escapeHTML(provider.id)}" data-service="${escapeHTML(provider.serviceId || "")}" aria-label="View ${escapeHTML(provider.name)}’s provider profile">${providerAvatarMarkup(provider)}</button><span><strong>${escapeHTML(provider.name)}</strong><small>${provider.verified ? '<i class="verified-dot">✓</i> Campus verified · ' : ""}${escapeHTML(provider.campus)}</small></span></div>
        ${serviceDetailLabel(provider) ? `<p class="service-delivery-label">${escapeHTML(serviceDetailLabel(provider))}</p>` : ""}
        <div class="provider-card-footer"><span class="price"><small>Price</small>${escapeHTML(servicePriceLabel(provider))}</span>${provider.id === appUser?.id ? '<span class="own-listing-label">Your listing</span>' : `<span class="card-actions"><button type="button" class="icon-button card-message" data-message="${escapeHTML(provider.id)}" data-service="${escapeHTML(provider.serviceId || "")}" aria-label="Message ${escapeHTML(provider.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12 7.7L3 21l1.8-6A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 11h8"/></svg></button><button type="button" class="button button-small button-primary" data-book="${escapeHTML(provider.id)}" data-service="${escapeHTML(provider.serviceId || "")}">${provider.priceType === "range" ? "Request a quote" : "Request booking"}</button></span>`}</div>
      </div>
    </article>`).join("") : `<div class="empty-card"><span aria-hidden="true">⌕</span><strong>${targetId === "saved-grid" ? "Your shortlist starts here" : "No services found"}</strong><small>${targetId === "saved-grid" ? "Tap the heart on a service to save its provider for later." : "Try a broader skill, adjust your budget, or post your task for students to respond."}</small><button class="button button-outline" type="button" ${targetId === "saved-grid" ? 'data-page-link="home"' : 'data-clear-search'}>${targetId === "saved-grid" ? "Explore services" : "Clear search & filters"}</button>${targetId === "saved-grid" ? "" : '<button class="button button-primary" type="button" data-new-request>Post a campus request</button>'}</div>`;
  if (targetId === "recent-grid" && !visible.length) target.innerHTML = '<p class="recent-empty">No recently published services to show yet.</p>';
  if (!visible.length && ["marketplace-grid", "saved-grid"].includes(targetId)) {
    const empty = target.querySelector(".empty-card");
    window.skillflexIllustrations?.mount(empty, targetId === "saved-grid" ? "saved" : "search", empty?.querySelector(":scope > span"));
  }
  if (targetId === "marketplace-grid") { renderMarketplace("recent-grid", providers); renderMarketplaceActivity(); }
}
function renderSearchSuggestions() {
  const target = document.querySelector("#search-suggestions");
  const query = globalSearch.value.trim();
  if (!document.body.classList.contains("search-open")) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }

  if (!query) {
    const popularSearches = ["Laptop help", "Braids", "Tutoring", "Design", "Lunch"];
    target.innerHTML = `<p class="search-suggestions-heading">Popular searches</p><div class="search-popular-list">${popularSearches.map((term) => `<button class="search-popular" type="button" data-search-suggestion="${escapeHTML(term)}">${escapeHTML(term)}</button>`).join("")}</div><p class="search-suggestions-hint">Search services, skills, or a provider name</p>`;
    target.hidden = false;
    return;
  }
  if (window.skillflexSmartSearch.normalize(query).length < 2) {
    target.innerHTML = `<p class="search-suggestions-empty">Type at least 2 letters to find a service.</p>`;
    target.hidden = false;
    return;
  }

  const providers = appSupabase ? connectedProviders : seedProviders;
  const campus = state.profile?.university || "";
  const matches = window.skillflexMarketplace.sortByCampus(marketplaceEntries(providers)
    .filter((provider) => !state.blocked.includes(provider.id)
      && window.skillflexMarketplace.campusRank(provider, campus) !== null
      && window.skillflexMarketplace.matchesCategory(provider.category, selectedCategory)
      && window.skillflexSmartSearch.matches(provider, query)), campus,
  (left, right) => marketplaceSearchScore(right, query) - marketplaceSearchScore(left, query))
    .slice(0, 6);

  target.innerHTML = matches.length
    ? `<p class="search-suggestions-heading">${matches.length} matching ${matches.length === 1 ? "service" : "services"}</p>${matches.map((provider) => `
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
  const groups = state.groups.filter((group) => ["Open", "Full"].includes(group.status) && !state.blocked.includes(group.providerId)
    && (!groupProviderFilter || group.providerId === groupProviderFilter)
    && group.date >= localDateInputValue());
  target.innerHTML = groups.length ? groups.map((group) => {
    const provider = getProvider(group.providerId);
    const joined = appSupabase ? Boolean(group.joinedByMe) : state.joinedGroups.includes(group.id);
    const full = group.joined >= group.capacity;
    const percent = Math.min(100, group.joined / group.capacity * 100);
    return `<article class="group-card"><div class="group-card-heading"><span class="group-icon">${getCategoryIcon(provider?.category || "Other")}</span><span class="group-open">${full ? "Full" : "Open to join"}</span></div><h3>${escapeHTML(group.title)}</h3><p>${escapeHTML(group.service)} <span>· hosted by ${escapeHTML(group.host)}</span></p><div class="group-date">${formatDate(group.date)}</div><div class="group-progress"><span style="width:${percent}%"></span></div><div class="group-seats"><span>${group.joined} of ${group.capacity} students joined</span><strong>${currency(group.price)} <small>/ person</small></strong></div><button class="button ${joined ? "button-joined" : "button-outline"} group-join" type="button" data-join-group="${escapeHTML(group.id)}" ${pendingGroupActions.has(group.id) || full && !joined ? "disabled" : ""}>${joined ? "✓ You’re in — leave group" : full ? "Group is full" : "Join group"}</button><button class="group-message-link" type="button" data-message="${escapeHTML(group.providerId)}">Ask ${escapeHTML(provider?.name || "provider")} a question</button></article>`;
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
  if (renderPendingData(target, state.messages.length, "conversations")) return;
  if (!state.messages.length && renderLoadFailure(target)) return;
  const layout = document.querySelector("#messages-layout");
  state.messages.forEach((chat) => chat.messages.forEach((message, index) => {
    if (!message.id) message.id = `legacy-${chat.id}-${index}`;
  }));
  const search = document.querySelector("#conversation-search").value.trim().toLocaleLowerCase();
  const conversations = state.messages
    .filter((chat) => !state.blocked.includes(chat.providerId))
    .sort((a, b) => new Date(b.messages.at(-1)?.createdAt || 0) - new Date(a.messages.at(-1)?.createdAt || 0));
  const selectedChatExists = conversations.some((chat) => chat.id === activeConversationId);
  if (activeConversationId && !selectedChatExists) setActiveConversation(null);
  if (activeConversationId) layout.dataset.chatOpen = "true";
  else layout.removeAttribute("data-chat-open");
  const totalUnread = conversations.reduce((total, chat) => total + unreadMessageCount(chat), 0);
  renderMarketplaceActivity();
  const messageCountBadge = document.querySelector("#message-count");
  messageCountBadge.textContent = String(totalUnread);
  messageCountBadge.classList.toggle("has-unread", totalUnread > 0);
  const mobileBadge = document.querySelector("#mobile-message-count");
  mobileBadge.textContent = totalUnread > 99 ? "99+" : String(totalUnread);
  mobileBadge.hidden = totalUnread === 0;
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
  syncMessageChannels();
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
  window.skillflexIllustrations?.mount(empty, "messages", icon);
}
function chatMessageRenderKey(message, grouped) {
  return JSON.stringify([
    message.text, message.sender, message.senderId, message.createdAt, message.time,
    message.replyTo, message.replyText, message.replySender, message.sendStatus,
    message.readAt, message.deliveredAt, grouped,
  ]);
}
function createChatMessageRow(message, grouped) {
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
  return row;
}
function createPriceNegotiationPanel(chat) {
  const negotiations = priceNegotiations.filter(item => item.conversationId === chat.id);
  const serviceMap = new Map();
  for (const service of connectedServices) {
    if (service.active
      && (service.providerId === appUser?.id || service.providerId === chat.providerId)) {
      serviceMap.set(service.id, service);
    }
  }
  for (const negotiation of negotiations) {
    const service = connectedServices.find(item => item.id === negotiation.serviceId);
    if (service) serviceMap.set(service.id, service);
  }
  const chatServices = [...serviceMap.values()];
  if (!chatServices.length) return null;
  const selectedServiceId = chatNegotiationServiceSelection.get(chat.id);
  const selectedService = chatServices.find(service => service.id === selectedServiceId)
    || chatServices.find(service => negotiations.some(item => item.serviceId === service.id))
    || chatServices[0];
  chatNegotiationServiceSelection.set(chat.id, selectedService.id);
  const negotiation = negotiations.find(item => item.serviceId === selectedService.id);
  const section = document.createElement("section");
  section.className = "chat-negotiations";
  section.setAttribute("aria-label", "Service price and negotiation status");
  const serviceCopy = document.createElement("div");
  serviceCopy.className = "chat-negotiation-service";
  if (chatServices.length > 1) {
    const selectorLabel = document.createElement("label");
    selectorLabel.className = "chat-service-select-label";
    selectorLabel.htmlFor = "chat-service-select";
    selectorLabel.textContent = "Service";
    const selector = document.createElement("select");
    selector.id = "chat-service-select";
    selector.dataset.chatServiceSelect = "";
    selector.setAttribute("aria-label", "Choose a service for this conversation");
    for (const service of chatServices) {
      const option = document.createElement("option");
      option.value = service.id;
      option.textContent = service.title;
      option.selected = service.id === selectedService.id;
      selector.append(option);
    }
    serviceCopy.append(selectorLabel, selector);
  } else {
    const title = document.createElement("strong");
    title.className = "chat-negotiation-service-name";
    title.textContent = selectedService.title;
    serviceCopy.append(title);
  }
  const listedPrice = document.createElement("small");
  listedPrice.className = "chat-negotiation-listed-price";
  listedPrice.textContent = selectedService.priceType === "range" && negotiation?.state !== "agreed"
    ? `Price range · ${servicePriceLabel(selectedService)}`
    : selectedService.negotiationMode === "fixed"
    ? `Fixed price · ${currency(selectedService.price)}`
    : negotiation?.state === "agreed"
      ? `${currency(negotiation.listedPrice ?? selectedService.price)} → ${currency(negotiation.agreedPrice)}`
      : `${currency(negotiation?.listedPrice ?? selectedService.price)} listed`;
  if (negotiation?.state === "agreed") {
    listedPrice.title = `${currency(negotiation.listedPrice ?? selectedService.price)} listed; ${currency(negotiation.agreedPrice)} agreed`;
    listedPrice.setAttribute("aria-label", listedPrice.title);
  }
  serviceCopy.append(listedPrice);
  if (negotiation?.agreedScope) {
    const scope = document.createElement("small");
    scope.className = "chat-negotiation-scope";
    scope.textContent = `Agreed scope: ${negotiation.agreedScope}`;
    serviceCopy.append(scope);
  }

  const status = document.createElement("span");
  status.className = "chat-negotiation-state";
  const pendingOffer = negotiation?.offers.find(offer => offer.status === "pending");
  const latestOffer = negotiation?.offers[negotiation.offers.length - 1];
  status.textContent = conversationsOpeningNegotiation.has(chat.id) ? "Opening price discussion…"
    : selectedService.negotiationMode === "fixed" ? "Fixed Price"
    : negotiation?.state === "agreed"
    ? "Agreed"
    : pendingOffer ? "Proposal pending"
      : latestOffer ? `${latestOffer.status === "countered" ? "Counteroffer" : "Proposal"} ${latestOffer.status}`
        : negotiation?.state === "open" ? "Negotiation open" : "No negotiation";
  if (negotiation?.state === "agreed") {
    status.title = `Agreed price: ${currency(negotiation.agreedPrice)}`;
    status.setAttribute("aria-label", `Agreed price ${currency(negotiation.agreedPrice)}`);
  }

  const controls = document.createElement("div");
  controls.className = "chat-negotiation-controls";
  controls.append(status);
  const actions = document.createElement("div");
  actions.className = "chat-negotiation-actions";
  if (selectedService.negotiationMode === "fixed") {
    if (selectedService.providerId !== appUser?.id && selectedService.active !== false) {
      const book = document.createElement("button");
      book.type = "button";
      book.className = "button button-small button-primary";
      book.dataset.priceAction = "book";
      book.dataset.serviceId = selectedService.id;
      book.dataset.providerId = selectedService.providerId;
      book.textContent = "Continue to Booking";
      actions.append(book);
    }
  } else {
    const canPropose = negotiation?.state === "open" && !pendingOffer;
    const propose = document.createElement("button");
    propose.type = "button";
    propose.className = `button button-small button-primary${canPropose ? "" : " chat-propose-inactive"}`;
    propose.dataset.chatPricePropose = "";
    propose.dataset.serviceId = selectedService.id;
    propose.dataset.providerId = selectedService.providerId;
    propose.dataset.negotiationId = negotiation?.id || "";
    propose.disabled = !canPropose;
    if (!canPropose) {
      propose.title = !negotiation
        ? "Start a price discussion for this service before sending a proposal."
        : negotiation.state === "agreed"
          ? "A final price has already been agreed for this service."
          : pendingOffer
        ? "A proposal for this service is waiting for a response."
        : "This negotiation is not open for proposals.";
      propose.setAttribute("aria-label", propose.title);
    }
    propose.textContent = "Propose Price";
    actions.append(propose);
  }

  if (selectedService.negotiationMode !== "fixed" && negotiation?.state === "agreed") {
    const existingBooking = state.bookings.find(item => item.priceNegotiationId === negotiation.id);
    if (appUser?.id === negotiation.customerId && !existingBooking && selectedService.active !== false) {
      const book = document.createElement("button");
      book.type = "button";
      book.className = "button button-small button-outline";
      book.dataset.priceAction = "book";
      book.dataset.negotiationId = negotiation.id;
      book.dataset.serviceId = negotiation.serviceId;
      book.dataset.providerId = negotiation.providerId;
      book.textContent = "Continue to Booking";
      actions.append(book);
    } else if (existingBooking) {
      const bookingStatus = document.createElement("small");
      bookingStatus.className = "chat-booking-next-step";
      bookingStatus.textContent = `Booking ${existingBooking.status.toLowerCase()} · ${formatDate(existingBooking.date)} ${existingBooking.time}`;
      actions.append(bookingStatus);
    }
  }
  if (actions.childElementCount) controls.append(actions);
  section.append(serviceCopy, controls);
  return section;
}
function createChatPriceOfferCard(offer, negotiation, service, chat) {
  const card = document.createElement("article");
  card.className = `chat-proposal-card${offer.proposerId === appUser?.id ? " chat-proposal-outgoing" : ""}`;
  card.dataset.priceOfferId = offer.id;
  card.setAttribute("aria-label", "Price proposal");
  const heading = document.createElement("div");
  heading.className = "chat-proposal-heading";
  const proposer = document.createElement("strong");
  proposer.textContent = offer.proposerId === appUser?.id ? "You proposed" : `${chat.name || "Student"} proposed`;
  const amount = document.createElement("strong");
  amount.className = "chat-proposal-amount";
  amount.textContent = currency(offer.amount);
  heading.append(proposer, amount);
  const meta = document.createElement("div");
  meta.className = "chat-proposal-meta";
  const serviceName = document.createElement("span");
  serviceName.textContent = service?.title || "Service price";
  const offerStatus = document.createElement("span");
  offerStatus.className = `chat-proposal-status chat-proposal-status-${offer.status}`;
  offerStatus.textContent = offer.status.charAt(0).toUpperCase() + offer.status.slice(1);
  meta.append(serviceName, offerStatus);
  card.append(heading, meta);
  if (offer.message) {
    const note = document.createElement("p");
    note.className = "chat-proposal-message";
    note.textContent = offer.message;
    card.append(note);
  }
  if (service?.negotiationMode !== "fixed" && offer.status === "pending"
    && offer.proposerId !== appUser?.id && negotiation.state === "open") {
    const actions = document.createElement("span");
    actions.className = "chat-offer-actions";
    const availableActions = [["accept", "Accept"], ["reject", "Reject"]];
    if (["negotiation", "hybrid"].includes(service?.negotiationMode)) availableActions.push(["counter", "Counter"]);
    for (const [action, label] of availableActions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === "accept" ? "button button-small button-primary" : "button button-small button-outline";
      button.dataset.priceAction = action;
      button.dataset.offerId = offer.id;
      button.dataset.negotiationId = negotiation.id;
      button.dataset.serviceId = negotiation.serviceId;
      button.dataset.providerId = negotiation.providerId;
      button.textContent = label;
      actions.append(button);
    }
    card.append(actions);
  }
  return card;
}
function renderChat(options = {}) {
  const chat = state.messages.find((item) => item.id === activeConversationId);
  const provider = chat && getProvider(chat.providerId);
  const target = document.querySelector("#chat-panel");
  if (!chat || !provider) { renderEmptyChat(); return; }
  const previousInput = options.preserveChatState ? target.querySelector('[name="message"]') : null;
  const previousForm = options.preserveChatState ? target.querySelector("#chat-compose") : null;
  const draft = previousInput ? previousInput.value : chatDrafts.get(chat.id) || "";
  const hadFocus = previousInput === document.activeElement;
  const selectionStart = previousInput?.selectionStart || 0;
  const selectionEnd = previousInput?.selectionEnd || 0;
  const previousMessages = options.preserveChatState ? target.querySelector("#chat-messages") : null;
  const previousNewMessages = options.preserveChatState ? target.querySelector(".chat-new-messages") : null;
  const wasNearBottom = previousMessages
    ? previousMessages.scrollHeight - previousMessages.scrollTop - previousMessages.clientHeight < 48
    : true;
  const previousScrollTop = previousMessages?.scrollTop || 0;
  const previousScrollHeight = previousMessages?.scrollHeight || 0;
  const previousMessageCount = previousMessages?.querySelectorAll("[data-message-id]").length || 0;
  const hasNewMessages = visibleMessageCount(chat) > previousMessageCount;
  const header = document.createElement("header");
  header.className = "chat-header";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "chat-back";
  back.dataset.chatBack = "";
  back.setAttribute("aria-label", "Back to conversations");
  back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h11" /></svg>';
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
  const connection = messagePresence.get(chat.id)?.connection;
  status.dataset.status = connection || (messagePresence.get(chat.id)?.online ? "online" : "offline");
  header.dataset.connection = connection || "connected";
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

  const messages = previousMessages || document.createElement("div");
  messages.className = "chat-messages";
  messages.id = "chat-messages";
  messages.setAttribute("aria-live", "polite");
  messages.setAttribute("aria-relevant", "additions text");
  const existingRows = new Map([...messages.querySelectorAll("[data-message-id]")]
    .map((row) => [row.dataset.messageId, row]));
  const existingDateRows = new Map([...messages.querySelectorAll(".chat-date-row")]
    .map((row) => [row.dataset.messageDate, row]));
  const orderedChildren = [];
  let previousDate = "";
  let previousMessage = null;
  const visibleMessages = chat.messages.filter((message) => !isHiddenMessage(message));
  const timeline = [
    ...visibleMessages.map((message, index) => ({ type: "message", item: message, index })),
    ...priceNegotiations
      .filter(item => item.conversationId === chat.id)
      .flatMap(item => item.offers.map((offer, index) => ({
        type: "proposal", item: offer, negotiation: item, index,
      }))),
  ].sort((left, right) => {
    const leftTime = new Date(left.item.createdAt || 0).getTime();
    const rightTime = new Date(right.item.createdAt || 0).getTime();
    return leftTime - rightTime || (left.type === right.type ? left.index - right.index : left.type === "message" ? -1 : 1);
  });
  for (const entry of timeline) {
    const item = entry.item;
    const messageDate = item.createdAt ? new Date(item.createdAt).toDateString() : "Today";
    if (messageDate !== previousDate) {
      let dateRow = existingDateRows.get(messageDate);
      if (!dateRow) {
        dateRow = document.createElement("div");
        dateRow.className = "chat-date-row";
        dateRow.dataset.messageDate = messageDate;
        const pill = document.createElement("span");
        pill.className = "chat-date-pill";
        dateRow.append(pill);
      }
      dateRow.querySelector(".chat-date-pill").textContent = item.createdAt ? formatChatDate(item.createdAt) : "Today";
      orderedChildren.push(dateRow);
      previousDate = messageDate;
      previousMessage = null;
    }
    if (entry.type === "proposal") {
      const service = connectedServices.find(candidate => candidate.id === entry.negotiation.serviceId);
      orderedChildren.push(createChatPriceOfferCard(item, entry.negotiation, service, chat));
      previousMessage = null;
      continue;
    }
    const message = item;
    const sameSender = previousMessage && (previousMessage.senderId || previousMessage.sender) === (message.senderId || message.sender);
    const grouped = sameSender
      && new Date(message.createdAt || 0) - new Date(previousMessage.createdAt || 0) < 5 * 60 * 1000;
    const messageId = String(message.id);
    const renderKey = chatMessageRenderKey(message, grouped);
    let row = existingRows.get(messageId);
    if (!row || row.dataset.renderKey !== renderKey) row = createChatMessageRow(message, grouped);
    row.dataset.renderKey = renderKey;
    orderedChildren.push(row);
    previousMessage = message;
  }
  const hasTimelineItems = timeline.length > 0;
  if (!hasTimelineItems) {
    let empty = messages.querySelector(".chat-empty-state");
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "chat-empty-state";
    }
    const opening = conversationsOpeningNegotiation.has(chat.id);
    empty.classList.toggle("chat-opening-state", opening);
    empty.replaceChildren();
    if (opening) {
      empty.setAttribute("role", "status");
      const spinner = document.createElement("span");
      spinner.className = "chat-opening-spinner";
      spinner.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = "Opening your price discussion…";
      empty.append(spinner, label);
    } else {
      empty.removeAttribute("role");
      empty.textContent = "No messages yet. Send a message below to introduce yourself.";
    }
    orderedChildren.push(empty);
  }
  const newMessages = previousNewMessages || document.createElement("button");
  newMessages.type = "button";
  newMessages.className = "chat-new-messages";
  if (!previousNewMessages) newMessages.hidden = true;
  newMessages.textContent = "↓ New messages";
  orderedChildren.push(newMessages);
  orderedChildren.forEach((child, index) => {
    if (messages.children[index] !== child) messages.insertBefore(child, messages.children[index] || null);
  });
  while (messages.children.length > orderedChildren.length) messages.lastElementChild.remove();
  const form = previousForm || document.createElement("form");
  form.className = "chat-compose";
  form.id = "chat-compose";
  form.replaceChildren();
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
  const input = previousInput || document.createElement("textarea");
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
  send.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10.8 13.2M21 3l-6.5 18-3.7-7.8L3 9.5 21 3Z" /></svg>';
  controls.append(emojiButton, input, send);
  form.append(emojiPicker, controls);
  messages.append(newMessages);
  const negotiationPanel = createPriceNegotiationPanel(chat);
  target.replaceChildren(...[header, negotiationPanel, messages, form].filter(Boolean));
  if (!previousInput) input.value = draft;
  resizeChatInput(input);
  if (hadFocus) {
    input.focus({ preventScroll: true });
    input.setSelectionRange(selectionStart, selectionEnd);
  }
  messages.scrollTop = options.preserveScrollAnchor && previousMessages
    ? previousScrollTop + messages.scrollHeight - previousScrollHeight
    : wasNearBottom ? messages.scrollHeight : previousScrollTop;
  newMessages.hidden = wasNearBottom || (!hasNewMessages && (previousNewMessages?.hidden ?? true));
  if (activeConversationId === chat.id && state.activePage === "messages" && !document.hidden) {
    markConversationMessagesRead(chat.id).catch((error) => console.error("Could not mark Skill Flex messages as read.", error));
  }
}
function serviceCoverUrl(service) {
  if (appSupabase && service.coverImagePath && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(service.coverImagePath)) {
    return appSupabase.storage.from("service-covers").getPublicUrl(service.coverImagePath).data.publicUrl;
  }
  return !appSupabase && /^data:image\/(png|webp|jpeg);base64,/.test(service.coverImage || "") ? service.coverImage : "";
}
function servicePriceLabel(service) {
  if (service?.priceType === "range" && service.minimumPrice !== null
      && service.minimumPrice !== undefined && service.minimumPrice !== ""
      && Number.isFinite(Number(service.minimumPrice))) {
    return `${currency(service.minimumPrice)}–${currency(service.price)}`;
  }
  return currency(service.price);
}
function serviceUsesPriceRange(service) {
  return service?.priceType === "range";
}
function serviceDetailLabel(service) {
  return [window.skillflexServiceUtils.deliveryLabels[service.deliveryMethod], service.estimatedDelivery].filter(Boolean).join(" · ");
}
function renderListings() {
  const target = document.querySelector("#listing-list");
  if (renderPendingData(target, state.services.length, "listings")) return;
  if (!state.services.length && renderLoadFailure(target)) return;
  target.innerHTML = state.services.length ? state.services.map((service) => `<article class="listing-card">${serviceCoverUrl(service) ? `<img class="service-list-cover" src="${escapeHTML(serviceCoverUrl(service))}" alt="" loading="lazy" />` : `<span class="service-list-icon">${getCategoryIcon(service.category)}</span>`}<div class="listing-copy"><div class="listing-title"><strong>${escapeHTML(service.title)}</strong><span class="listing-status ${service.active ? "listing-active" : "listing-paused"}">${service.pending ? "Saving..." : service.active ? "Active" : "Paused"}</span></div><small>${escapeHTML(service.category)} ${service.groups ? "· Open to groups" : ""}</small><p>${escapeHTML(service.description)}</p><small>${escapeHTML(serviceDetailLabel(service))}</small></div><strong class="listing-price">${servicePriceLabel(service)}</strong><div class="listing-actions"><button class="button button-small button-outline" type="button" data-edit-service="${escapeHTML(service.id)}" ${service.pending ? "disabled" : ""}>Edit</button><button class="subtle-button" type="button" data-toggle-service="${escapeHTML(service.id)}" ${service.pending || pendingServiceToggles.has(service.id) ? "disabled aria-busy=\"true\"" : ""}>${service.active ? "Pause" : "Activate"}</button></div></article>`).join("") : '<div class="empty-card"><strong>Your first service starts here</strong><small>List a skill to help students find and book you.</small><button class="button button-primary button-small" type="button" data-open="service-modal">Add a service</button></div>';
  if (!state.services.length) window.skillflexIllustrations?.mount(target.querySelector(".empty-card"), "listings");
}
function renderPortfolio() {
  const target = document.querySelector("#portfolio-grid");
  target.innerHTML = state.portfolio.length ? state.portfolio.map((item) => `<article class="portfolio-item">${item.image ? `<img class="portfolio-art portfolio-image" src="${escapeHTML(item.image)}" alt="" width="96" height="72" loading="lazy" decoding="async" />` : `<span class="portfolio-art">${getCategoryIcon("Design")}</span>`}<div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.description)}</small></div><button type="button" class="portfolio-remove" ${item.pending ? "disabled aria-busy=\"true\"" : ""} data-remove-work="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.title)}">×</button></article>`).join("") : '<div class="empty-card"><strong>Your portfolio is ready to grow</strong><small>Add examples of your best work.</small></div>';
}
function renderEarnings() {
  const completed = state.bookings.filter((booking) => isOwnBooking(booking) && booking.status === "Completed");
  const total = completed.reduce((sum, booking) => sum + Number(booking.price), 0);
  document.querySelector("#earnings-total").textContent = currency(total);
  document.querySelector("#provider-earnings").textContent = currency(total);
  renderBookingList("earnings-list", completed, { provider: true });
}
function bookingsForActiveFilter() {
  const bookings = window.skillflexMarketplace.filterBookings(state.bookings, { direction: bookingDirection, filter: activeBookingFilter, ownId: ownProviderId() });
  document.querySelector("#all-booking-count").textContent = String(state.bookings.filter(booking => isOwnBooking(booking) === (bookingDirection === "received")).length);
  return bookings;
}
function renderBookingActivity() {
  for (const booking of state.bookings) {
    if (pendingBookingStatuses.has(booking.id)) booking.status = pendingBookingStatuses.get(booking.id);
  }
  window.skillflexGrowth?.render();
  renderBookingList("user-booking-list", bookingsForActiveFilter());
  const pendingReviews = pendingCustomerReviews();
  const reviewReminder = document.querySelector("#required-review-reminder");
  reviewReminder.hidden = pendingReviews.length === 0 || Boolean(window.skillflexGrowth?.reviewDismissed());
  reviewReminder.innerHTML = pendingReviews.length
    ? `<span><strong>${pendingReviews.length} completed ${pendingReviews.length === 1 ? "booking needs" : "bookings need"} your review</strong><small>Your feedback helps other students. You can book again at any time.</small></span><button class="button button-primary button-small" type="button" data-review="${escapeHTML(pendingReviews[0].id)}">Write review</button><button class="subtle-button" type="button" data-dismiss-reviews>Not now</button>`
    : "";
  renderEarnings();
  const completedThisMonth = state.bookings.filter((booking) => isOwnBooking(booking)
    && booking.status === "Completed" && booking.date?.slice(0, 7) === new Date().toISOString().slice(0, 7))
    .reduce((sum, booking) => sum + Number(booking.price), 0);
  document.querySelector("#provider-earnings").textContent = currency(completedThisMonth);
  document.querySelector("#booking-count").textContent = String(
    state.bookings.filter((booking) => !["Declined", "Cancelled", "Completed"].includes(booking.status)).length,
  );
  document.querySelector("#provider-request-count").textContent = String(
    state.bookings.filter((booking) => isOwnBooking(booking) && booking.status === "Pending").length,
  );
}
function renderMarketplaceActivity() {
  const profile = state.profile || {};
  const bookings = window.skillflexMarketplace.filterBookings(state.bookings, {
    direction: "made", filter: "upcoming", ownId: ownProviderId(),
  }).length;
  const messages = state.messages.filter(chat => !state.blocked.includes(chat.providerId))
    .reduce((total, chat) => total + unreadMessageCount(chat), 0);
  const saved = marketplaceEntries(appSupabase ? connectedProviders : seedProviders)
    .filter(provider => state.saved.includes(provider.id) && !state.blocked.includes(provider.id)).length;
  for (const [key, count] of Object.entries({ bookings, messages, saved })) {
    document.querySelectorAll(`[data-activity-count="${key}"]`).forEach(node => { node.textContent = String(count); });
  }
  document.querySelectorAll("[data-student-name]").forEach(node => { node.textContent = profile.name?.trim().split(/\s+/)[0] || "student"; });
  document.querySelectorAll("[data-student-full-name]").forEach(node => { node.textContent = profile.name || "Student account"; });
  document.querySelectorAll("[data-student-campus]").forEach(node => { node.textContent = profile.university || "Add your campus in Profile & Settings"; });
  document.querySelectorAll("[data-activity-avatar]").forEach(node => { node.textContent = initialsFor(profile.name || "Student"); });
  document.querySelectorAll("[data-student-verification]").forEach(node => { node.textContent = profile.verified ? "Campus verified" : "Campus verification is available in your account menu."; });
}
function renderAll() {
  for (const booking of state.bookings) {
    if (pendingBookingStatuses.has(booking.id)) booking.status = pendingBookingStatuses.get(booking.id);
  }
  window.skillflexGrowth?.render();
  if (typeof window.renderProfileCompleteness === "function") {
    window.renderProfileCompleteness(state.profile);
  }
  document.querySelector("#marketplace-date").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date()).toUpperCase();
  syncSellerNavigation();
  renderMarketplace();
  renderMarketplace("saved-grid", (appSupabase ? connectedProviders : seedProviders).filter(provider => state.saved.includes(provider.id)));
  renderGroups();
  renderBookingList("user-booking-list", bookingsForActiveFilter());
  renderListings();
  renderPortfolio();
  renderConversations({ preserveChatState: true });
  renderEarnings();
  const count = state.bookings.filter((booking) => !["Declined", "Cancelled", "Completed"].includes(booking.status)).length;
  document.querySelector("#booking-count").textContent = count;
  document.querySelector("#provider-request-count").textContent = state.bookings.filter((booking) => isOwnBooking(booking) && booking.status === "Pending").length;
  document.querySelector("#active-listings-count").textContent = state.services.filter((service) => service.active).length;
  const verified = state.profile.verified;
  const verificationMark = document.querySelector(".verified-mark");
  verificationMark.textContent = verified ? "✓" : "!";
  verificationMark.title = verified ? "Campus verified" : "Verify to earn a campus badge";
  verificationMark.setAttribute("aria-label", verificationMark.title);
  document.querySelector(".campus-card").classList.toggle("campus-verified", verified);
  document.querySelector(".campus-card").classList.toggle("campus-unverified", !verified);
  const verificationCta = document.querySelector("#verification-cta");
  verificationCta.hidden = verified;
  verificationCta.querySelector("small").textContent = document.querySelector("#verification-open").dataset.requested === "open"
    ? "Verification is waiting for review"
    : "Verify to earn a campus badge";
  document.querySelector(".profile-copy strong").textContent = state.profile.name;
  renderUserAvatar(document.querySelector(".profile-avatar"), state.profile);
  const ownReviews = state.reviews.filter((review) => review.providerId === ownProviderId());
  const ownRating = ownReviews.length ? (ownReviews.reduce((sum, review) => sum + review.rating, 0) / ownReviews.length).toFixed(1) : appSupabase ? "New" : "4.9";
  const ratingStat = document.querySelectorAll(".provider-stat")[2];
  ratingStat.querySelector("strong").textContent = `${ownRating} ★`;
  ratingStat.querySelector("small").textContent = `From ${appSupabase ? ownReviews.length : 23 + ownReviews.length} student reviews`;
  if (appUser) {
    document.querySelector(".campus-card strong").textContent = state.profile.university || "University not set";
    document.querySelector(".campus-card small").textContent = state.profile.course || "STUDENT ACCOUNT";
    const providerHeading = document.querySelector(".provider-profile-main");
    renderUserAvatar(providerHeading.querySelector(".profile-avatar"), state.profile);
    const profileVerificationPill = providerHeading.querySelector(".verified-pill");
    profileVerificationPill.textContent = verified ? "✓ Campus verified" : "Campus verification pending";
    profileVerificationPill.classList.toggle("is-verified", verified);
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
      image.width = 48;
      image.height = 48;
      image.loading = "lazy";
      image.decoding = "async";
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
function toLocalBookingStatus(booking) {
  if (booking.status === "confirmed" && booking.provider_completed_at) return "Awaiting verification";
  if (booking.status === "confirmed" && booking.work_started_at) return "In progress";
  return toLocalStatus(booking.status);
}
function toDatabaseStatus(status) {
  return ({ Pending: "pending", Confirmed: "confirmed", Declined: "declined", Completed: "completed", Cancelled: "cancelled" })[status] || status.toLowerCase();
}
const accountProfileColumns = "id, full_name, university, course, bio, campus_verified, university_email, role, skills, avatar_url, onboarding_completed";
const accountSettingsColumns = ["phone_number", "notify_booking_updates", "notify_messages"];
const accountShowcaseColumns = ["cv_path", "cv_name"];
let accountSettingsColumnsAvailable = true;
let accountShowcaseColumnsAvailable = true;

async function loadAccountProfile(userId) {
  const readProfile = (columns) => appSupabase.from("profiles")
    .select(columns).eq("id", userId).single();
  let result;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const optionalColumns = [
      ...(accountSettingsColumnsAvailable ? accountSettingsColumns : []),
      ...(accountShowcaseColumnsAvailable ? accountShowcaseColumns : []),
    ];
    const columns = optionalColumns.length
      ? `${accountProfileColumns}, ${optionalColumns.join(", ")}`
      : accountProfileColumns;
    result = await readProfile(columns);
    if (!["42703", "PGRST204"].includes(result.error?.code)) break;
    const missing = [...accountSettingsColumns, ...accountShowcaseColumns]
      .find((column) => optionalColumns.includes(column) && result.error.message?.includes(column));
    if (!missing) break;
    if (accountSettingsColumns.includes(missing)) accountSettingsColumnsAvailable = false;
    else accountShowcaseColumnsAvailable = false;
  }
  if (result.error || !result.data) return result;
  return {
    ...result,
    data: {
      phone_number: "",
      notify_booking_updates: true,
      notify_messages: true,
      cv_path: null,
      cv_name: null,
      ...result.data,
    },
  };
}

let dashboardRefreshPromise = null;
async function refreshSupabaseState() {
  if (dashboardRefreshPromise) return dashboardRefreshPromise;
  const started = performance.now();
  const deadline = started + 20000;
  // Each awaited read shares one deadline. A timed-out response never reaches
  // the state assignment below its await, even if the transport completes later.
  const read = request => window.skillflexLoading.withTimeout(request, Math.max(0, deadline - performance.now()));
  dashboardRefreshPromise = loadSupabaseState(read).then((result) => {
    dashboardLoadError = null;
    return result;
  }).finally(() => {
    performance.measure("skillflex:dashboard-refresh", { start: started, end: performance.now() });
    dashboardRefreshPromise = null;
  });
  return dashboardRefreshPromise;
}
async function reconcileSavedChange() {
  // Persistence already succeeded. A failed follow-up read must not undo it.
  try {
    await refreshSupabaseState();
  } catch (error) {
    console.error("Change saved, but account data could not be refreshed.", error);
    showToast("Your change was saved. Some details could not refresh; reload to sync them.", "error");
  }
}
async function refreshPriceNegotiations(read = request => Promise.resolve(request)) {
  if (!negotiationBackendAvailable) return;
  const { data: negotiations, error: negotiationError } = await read(appSupabase
    .from("price_negotiations").select("*").order("updated_at", { ascending: false }));
  if (negotiationError) {
    negotiationBackendAvailable = ["42P01", "42703", "PGRST205"].includes(negotiationError.code);
    priceNegotiations = [];
    console.error("Could not load Skill Flex price negotiations. Apply the price negotiation migration.", negotiationError);
    return;
  }
  const rows = negotiations || [];
  let offers = [];
  if (rows.length) {
    const result = await read(appSupabase.from("price_offers").select("*")
      .in("negotiation_id", rows.map(item => item.id)).order("created_at", { ascending: true }));
    if (result.error) {
      negotiationBackendAvailable = ["42P01", "42703", "PGRST205"].includes(result.error.code);
      priceNegotiations = [];
      console.error("Could not load Skill Flex price offers.", result.error);
      return;
    }
    offers = result.data || [];
  }
  negotiationBackendAvailable = true;
  priceNegotiations = mapPriceNegotiationRows(rows, offers);
}
function mapPriceNegotiationRows(rows, offers) {
  return rows.map(item => ({
    id: item.id, serviceId: item.service_id, providerId: item.provider_id,
    customerId: item.customer_id, conversationId: item.conversation_id,
    listedPrice: Number(item.listed_price),
    state: item.state, agreedPrice: item.agreed_price === null ? null : Number(item.agreed_price),
    agreedScope: item.agreed_scope_snapshot || "",
    acceptedOfferId: item.accepted_offer_id,
    offers: offers.filter(offer => offer.negotiation_id === item.id).map(offer => ({
      id: offer.id, proposerId: offer.proposer_id, amount: Number(offer.amount),
      message: offer.message, status: offer.status, createdAt: offer.created_at,
    })),
  }));
}
async function loadConversationPriceNegotiation(negotiationId) {
  const { data: row, error } = await appSupabase.from("price_negotiations")
    .select("*").eq("id", negotiationId).single();
  if (error) throw error;
  const { data: offers, error: offersError } = await appSupabase.from("price_offers")
    .select("*").eq("negotiation_id", negotiationId).order("created_at", { ascending: true });
  if (offersError) throw offersError;
  const [negotiation] = mapPriceNegotiationRows([row], offers || []);
  return negotiation;
}
async function loadAllRows(createQuery, pageSize = DATA_PAGE_SIZE) {
  const rows = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await createQuery().range(start, start + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}
async function loadSupabaseState(read = request => Promise.resolve(request)) {
  const conversationDirectoryRequest = loadAllRows(() => appSupabase.from("conversation_directory")
    .select("conversation_id, other_user_id, other_user_name").order("conversation_id", { ascending: true }));
  const groupedMessagesRequest = conversationDirectoryRequest.then(({ data, error }) => {
    if (error) throw error;
    return loadConversationMessageGroups(data || []);
  });
  const [
    ownProfile, directory, ownServices, bookings, groups, joinedGroups, userLocations,
    savedServices, blocks, ownReviews, ownPortfolio, portfolioDirectory, conversationDirectory,
    verification, groupedMessages, ownStudentIdentifier, ownNegotiationSettings,
  ] = await read(Promise.all([
    loadAccountProfile(appUser.id),
    loadAllRows(() => appSupabase.from("provider_directory").select("*").order("service_id", { ascending: true })),
    loadAllRows(() => appSupabase.from("services").select("*").eq("provider_id", appUser.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false })),
    loadAllRows(() => appSupabase.from("booking_directory").select("*")
      .order("scheduled_at", { ascending: true }).order("id", { ascending: true })),
    loadAllRows(() => appSupabase.from("group_directory").select("*").in("status", ["open", "full"])
      .order("scheduled_at", { ascending: true }).order("id", { ascending: true })),
    loadAllRows(() => appSupabase.from("group_booking_members").select("group_booking_id")
      .eq("student_id", appUser.id).order("group_booking_id", { ascending: true })),
    loadAllRows(() => appSupabase.from("user_locations").select("user_id, location_name").order("user_id", { ascending: true })),
    loadAllRows(() => appSupabase.from("saved_services").select("service_id").order("service_id", { ascending: true })),
    loadAllRows(() => appSupabase.from("user_blocks").select("blocked_id")
      .eq("blocker_id", appUser.id).order("blocked_id", { ascending: true })),
    loadAllRows(() => appSupabase.from("reviews").select("booking_id, provider_id, rating, body, created_at")
      .order("booking_id", { ascending: true })),
    loadAllRows(() => appSupabase.from("portfolio_items").select("*").eq("provider_id", appUser.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false })),
    loadAllRows(() => appSupabase.from("portfolio_items").select("provider_id, title, description, image_path")
      .order("created_at", { ascending: false }).order("id", { ascending: false })),
    conversationDirectoryRequest,
    appSupabase.from("verification_requests").select("id, status").eq("student_id", appUser.id).eq("status", "open").maybeSingle(),
    groupedMessagesRequest,
    appSupabase.from("student_identifiers").select("student_id_number").eq("student_id", appUser.id).maybeSingle(),
    loadAllRows(() => appSupabase.from("service_negotiation_settings")
      .select("service_id, minimum_price").eq("provider_id", appUser.id).order("service_id", { ascending: true })),
  ]));
  const results = [ownProfile, directory, ownServices, bookings, groups, joinedGroups, userLocations, savedServices, blocks, ownReviews, ownPortfolio, portfolioDirectory, conversationDirectory, verification, ownStudentIdentifier, ownNegotiationSettings];
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;
  await refreshPriceNegotiations(read);
  const ownMinimumByService = new Map((ownNegotiationSettings.data || [])
    .map(item => [item.service_id, Number(item.minimum_price)]));

  const profile = ownProfile.data;
  if (!profile.onboarding_completed) {
    window.location.replace("onboarding.html");
    return;
  }
  document.querySelector("#admin-link").hidden = profile.role !== "admin";
  state.profile = {
    name: profile.full_name, university: profile.university, course: profile.course,
    bio: profile.bio, email: appUser.email, verified: profile.campus_verified,
    skills: profile.skills || [], avatarUrl: profile.avatar_url || "",
    cvPath: profile.cv_path || "", cvName: profile.cv_name || "",
    phoneNumber: profile.phone_number || "",
    notifyBookingUpdates: profile.notify_booking_updates,
    notifyMessages: profile.notify_messages,
    studentIdNumber: ownStudentIdentifier.data?.student_id_number || "",
    identityComplete: Boolean(profile.full_name?.trim().length >= 2
      && profile.university?.trim().length >= 2
      && ownStudentIdentifier.data?.student_id_number?.trim().length >= 3),
    location: (userLocations.data || []).find((item) => item.user_id === appUser.id)?.location_name || "",
  };
  connectedServices = (directory.data || []).map((row) => ({
    id: row.service_id, providerId: row.provider_id, title: row.service_title, category: row.category, createdAt: row.service_created_at || "",
    description: row.service_description, price: Number(row.price), groups: row.accepts_groups,
    active: true, currency: row.currency, negotiationMode: window.skillflexServiceUtils.normalizeNegotiationMode(row.negotiation_mode), ...window.skillflexServiceUtils.metadata(row),
  })).concat((ownServices.data || []).filter((service) => !(directory.data || []).some((row) => row.service_id === service.id)).map((service) => ({
    id: service.id, providerId: service.provider_id, title: service.title, category: service.category, createdAt: service.created_at || "",
    description: service.description, price: Number(service.price), groups: service.accepts_groups,
    active: service.is_active, currency: service.currency, negotiationMode: window.skillflexServiceUtils.normalizeNegotiationMode(service.negotiation_mode), ...window.skillflexServiceUtils.metadata(service),
    minimumPrice: ownMinimumByService.get(service.id) ?? null,
  })));
  const providerMap = new Map();
  for (const row of directory.data || []) {
    if (!providerMap.has(row.provider_id)) providerMap.set(row.provider_id, {
      id: row.provider_id, name: row.full_name, initials: initialsFor(row.full_name), avatarUrl: row.avatar_url || "", campus: row.university || "Campus not set",
      course: row.course || "Student", category: row.category, service: row.service_title,
      description: row.service_description, bio: row.bio || "", price: Number(row.price), currency: row.currency,
      rating: 0, reviews: 0, bookings: Number(row.completed_bookings) || 0, color: "blue", verified: row.campus_verified,
      available: "Message to ask", groups: row.accepts_groups, portfolio: [], ...window.skillflexServiceUtils.metadata(row),
      skills: row.skills || [], cvPath: row.cv_path || "", cvName: row.cv_name || "",
      negotiationMode: window.skillflexServiceUtils.normalizeNegotiationMode(row.negotiation_mode),
    });
  }
  const ownActiveService = (ownServices.data || []).find((service) => service.is_active);
  if (ownActiveService && !providerMap.has(appUser.id)) {
    providerMap.set(appUser.id, {
      id: appUser.id, name: profile.full_name, initials: initialsFor(profile.full_name), avatarUrl: profile.avatar_url || "",
      campus: profile.university || "Campus not set", course: profile.course || "Student", bio: profile.bio || "",
      category: ownActiveService.category, service: ownActiveService.title,
      description: ownActiveService.description, price: Number(ownActiveService.price),
      currency: ownActiveService.currency, rating: 0, reviews: 0, bookings: 0,
      color: "blue", verified: profile.campus_verified, available: "Message to ask",
      groups: ownActiveService.accepts_groups, portfolio: [], negotiationMode: window.skillflexServiceUtils.normalizeNegotiationMode(ownActiveService.negotiation_mode), ...window.skillflexServiceUtils.metadata(ownActiveService),
      minimumPrice: ownMinimumByService.get(ownActiveService.id) ?? null,
      skills: profile.skills || [], cvPath: profile.cv_path || "", cvName: profile.cv_name || "",
    });
  }
  connectedProviders = [...providerMap.values()];
  for (const item of portfolioDirectory.data || []) {
    const provider = providerMap.get(item.provider_id);
    if (provider) provider.portfolio.push({
      title: item.title, description: item.description || "",
      image: item.image_path ? appSupabase.storage.from("portfolio-images").getPublicUrl(item.image_path).data.publicUrl : "",
    });
  }
  state.bookings = (bookings.data || []).map((booking) => {
    const otherUserId = booking.customer_id === appUser.id ? booking.provider_id : booking.customer_id;
    const status = toLocalBookingStatus(booking);
    return {
      id: booking.id, serviceId: booking.service_id, providerId: booking.provider_id, customerId: booking.customer_id,
      workStartedAt: booking.work_started_at || null, durationMinutes: booking.duration_minutes || 60,
      customer: booking.customer_name || "Student", service: booking.service_title || "Service",
      category: booking.category || "Other", price: Number(booking.agreed_price),
      listedPrice: Number(booking.listed_price ?? booking.agreed_price), priceNegotiationId: booking.price_negotiation_id || "",
      priceAgreementId: booking.price_agreement_id || "",
      scopeSnapshot: booking.scope_snapshot || "",
      requestedLocation: booking.location || "",
      pendingAppointmentProposalId: booking.pending_appointment_proposal_id || "",
      pendingAppointmentAt: booking.pending_appointment_at || "",
      currency: booking.currency, scheduledAt: booking.scheduled_at, date: localDateInputValue(new Date(booking.scheduled_at)),
      time: new Date(booking.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      status, otherLocation: ["Confirmed", "In progress"].includes(status)
        ? (userLocations.data || []).find((item) => item.user_id === otherUserId)?.location_name || ""
        : "",
      type: booking.group_booking_id ? "Group booking" : "Individual",
      groupId: booking.group_booking_id, note: booking.note,
      reviewed: (ownReviews.data || []).some((review) => review.booking_id === booking.id),
    };
  });
  const refreshedBookingStatuses = new Map(state.bookings.map(booking => [booking.id, booking.status]));
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
    negotiationMode: window.skillflexServiceUtils.normalizeNegotiationMode(service.negotiation_mode), ...window.skillflexServiceUtils.metadata(service),
  }));
  state.portfolio = (ownPortfolio.data || []).map((item) => ({
    id: item.id, title: item.title, description: item.description,
    imagePath: item.image_path || "",
    image: item.image_path ? appSupabase.storage.from("portfolio-images").getPublicUrl(item.image_path).data.publicUrl : "",
  }));

  const conversations = conversationDirectory.data || [];
  const messages = conversations.map((conversation) => ({
    id: conversation.conversation_id, providerId: conversation.other_user_id, name: conversation.other_user_name,
    messages: groupedMessages.get(conversation.conversation_id) || [],
  }));
  const refreshedAt = Date.now();
  messages.forEach((chat) => conversationMessageRefreshTimes.set(chat.id, refreshedAt));
  state.messages = messages;
  cacheConversationMessages(messages);
  const verificationButton = document.querySelector("#verification-open");
  verificationButton.dataset.requested = verification.data?.status || "";
  await window.skillflexGrowth?.refresh({ read });
  const reportTarget = document.querySelector("#report-target");
  reportTarget.innerHTML = '<option value="">Choose a student</option>' + connectedProviders
    .filter((provider) => provider.id !== appUser.id)
    .map((provider) => `<option value="${escapeHTML(provider.id)}">${escapeHTML(provider.name)}</option>`).join("");
  return refreshedBookingStatuses;
}
async function refreshLiveBookings() {
  const [bookings, userLocations, ownReviews] = await Promise.all([
    loadAllRows(() => appSupabase.from("booking_directory").select("*")
      .order("scheduled_at", { ascending: true }).order("id", { ascending: true })),
    loadAllRows(() => appSupabase.from("user_locations").select("user_id, location_name").order("user_id", { ascending: true })),
    loadAllRows(() => appSupabase.from("reviews").select("booking_id").order("booking_id", { ascending: true })),
  ]);
  for (const result of [bookings, userLocations, ownReviews]) {
    if (result.error) throw result.error;
  }
  state.bookings = (bookings.data || []).map((booking) => {
    const otherUserId = booking.customer_id === appUser.id ? booking.provider_id : booking.customer_id;
    const status = toLocalBookingStatus(booking);
    return {
      id: booking.id, serviceId: booking.service_id, providerId: booking.provider_id, customerId: booking.customer_id,
      workStartedAt: booking.work_started_at || null, durationMinutes: booking.duration_minutes || 60,
      customer: booking.customer_name || "Student", service: booking.service_title || "Service",
      category: booking.category || "Other", price: Number(booking.agreed_price),
      listedPrice: Number(booking.listed_price ?? booking.agreed_price), priceNegotiationId: booking.price_negotiation_id || "",
      priceAgreementId: booking.price_agreement_id || "",
      scopeSnapshot: booking.scope_snapshot || "",
      requestedLocation: booking.location || "",
      pendingAppointmentProposalId: booking.pending_appointment_proposal_id || "",
      pendingAppointmentAt: booking.pending_appointment_at || "",
      currency: booking.currency, scheduledAt: booking.scheduled_at, date: localDateInputValue(new Date(booking.scheduled_at)),
      time: new Date(booking.scheduled_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      status, otherLocation: ["Confirmed", "In progress"].includes(status)
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
  const { data: conversations } = await loadAllRows(() => appSupabase
    .from("conversation_directory")
    .select("conversation_id, other_user_id, other_user_name")
    .order("conversation_id", { ascending: true }));
  const groupedMessages = await loadConversationMessageGroups(conversations || []);
  const previousNegotiations = JSON.stringify(priceNegotiations);
  await refreshPriceNegotiations();
  const negotiationsChanged = previousNegotiations !== JSON.stringify(priceNegotiations);
  const nextMessages = (conversations || []).map((conversation) => ({
    id: conversation.conversation_id,
    providerId: conversation.other_user_id,
    name: conversation.other_user_name,
    messages: retainLocalOutgoingMessages(
      state.messages.find((chat) => chat.id === conversation.conversation_id)?.messages || [],
      groupedMessages.get(conversation.conversation_id) || [],
    ),
  }));
  const refreshedAt = Date.now();
  nextMessages.forEach((chat) => conversationMessageRefreshTimes.set(chat.id, refreshedAt));
  const hasChanged = nextMessages.length !== state.messages.length
    || nextMessages.some((chat, chatIndex) => {
      const current = state.messages[chatIndex];
      return !current
        || chat.id !== current.id
        || chat.providerId !== current.providerId
        || chat.name !== current.name
        || chat.messages.length !== current.messages.length
        || chat.messages.some((message, messageIndex) => {
          const existing = current.messages[messageIndex];
          return !existing
            || message.id !== existing.id
            || message.senderId !== existing.senderId
            || message.text !== existing.text
            || message.createdAt !== existing.createdAt
            || message.readAt !== existing.readAt
            || message.deliveredAt !== existing.deliveredAt
            || message.replyTo !== existing.replyTo
            || message.sendStatus !== existing.sendStatus;
        });
    });
  if (!hasChanged && !negotiationsChanged) {
    syncMessageChannels();
    return;
  }
  state.messages = nextMessages;
  cacheConversationMessages(nextMessages);
  renderConversations({ preserveChatState: true });
}
async function refreshLiveActivity() {
  if (!appSupabase || !appUser || !dashboardDataLoaded || document.hidden || pendingActionCount || activityRefreshInProgress) return;
  const pageNeedsBookings = ["home", "bookings", "provider", "earnings"].includes(state.activePage);
  const pageNeedsMessages = state.activePage === "messages"
    && Boolean(activeConversationId)
    && realtimeFallbackChatIds.has(activeConversationId);
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
  if (pendingBookingStatuses.has(bookingId)) return;
  const booking = state.bookings.find((item) => item.id === bookingId);
  const previousStatus = booking?.status;
  const previousWorkStartedAt = booking?.workStartedAt;
  const localStatus = window.skillflexBookingPolicy.localStatus(status, Boolean(status === "Completed" && booking && isOwnBooking(booking)));
  pendingBookingStatuses.set(bookingId, localStatus);
  if (booking) {
    booking.status = localStatus;
    if (status === "In progress") booking.workStartedAt = new Date().toISOString();
    renderAll();
  }
  try {
    const result = status === "In progress"
      ? await appSupabase.rpc("start_booking_work", { p_booking_id: bookingId })
      : await appSupabase.rpc("update_booking_status", {
        p_booking_id: bookingId, p_status: toDatabaseStatus(status),
      });
    const { error } = result;
    if (error) throw error;
  } catch (error) {
    pendingBookingStatuses.delete(bookingId);
    const currentBooking = state.bookings.find(item => item.id === bookingId);
    if (currentBooking) {
      currentBooking.status = previousStatus;
      currentBooking.workStartedAt = previousWorkStartedAt;
      renderAll();
    }
    throw error;
  }
  let refreshedStatus;
  try {
    const statuses = await refreshSupabaseState();
    refreshedStatus = statuses?.get(bookingId);
  } catch (error) {
    console.error("Booking status was saved, but the latest account data could not be refreshed.", error);
  }
  const currentBooking = state.bookings.find(item => item.id === bookingId);
  if (currentBooking) currentBooking.status = refreshedStatus || localStatus;
  pendingBookingStatuses.delete(bookingId);
  renderAll();
}
function handleAppointmentActions(event) {
  const proposalButton = event.target.closest("[data-propose-appointment]");
  if (proposalButton) {
    if (!appSupabase) {
      showToast("Appointment suggestions require a connected Skill Flex account.", "error");
      return true;
    }
    const booking = state.bookings.find(item => item.id === proposalButton.dataset.proposeAppointment);
    if (!booking) return true;
    document.querySelector("#appointment-proposal-form").reset();
    document.querySelector("#appointment-proposal-booking-id").value = booking.id;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.querySelector("#appointment-proposal-date").min = localDateInputValue();
    document.querySelector("#appointment-proposal-date").value = localDateInputValue(tomorrow);
    document.querySelector("#appointment-proposal-time").value = "10:00";
    openModal("appointment-proposal-modal");
    return true;
  }
  const responseButton = event.target.closest("[data-appointment-response]");
  if (!responseButton) return false;
  if (!appSupabase) {
    showToast("Appointment responses require a connected Skill Flex account.", "error");
    return true;
  }
  const accept = responseButton.dataset.appointmentResponse === "accept";
  const booking = state.bookings.find(item => item.pendingAppointmentProposalId === responseButton.dataset.proposalId);
  const previousAppointment = booking ? {
    scheduledAt: booking.scheduledAt,
    date: booking.date,
    time: booking.time,
    pendingAppointmentProposalId: booking.pendingAppointmentProposalId,
    pendingAppointmentAt: booking.pendingAppointmentAt,
  } : null;
  runAction(async () => {
    const { error } = await appSupabase.rpc("respond_booking_appointment", {
      p_proposal_id: responseButton.dataset.proposalId,
      p_accept: accept,
    });
    if (error) throw error;
    let refreshFailed = false;
    try {
      await refreshSupabaseState();
    } catch (refreshError) {
      console.error("Appointment response was saved, but the latest booking data could not be refreshed.", refreshError);
      refreshFailed = true;
    }
    renderAll();
    showToast(refreshFailed
      ? "Your response was saved. Reload the page to refresh the latest booking details."
      : accept
      ? booking?.status === "Confirmed"
        ? "Suggested time accepted. The confirmed booking schedule is updated."
        : "Suggested time accepted. The provider can now confirm the booking."
      : "Suggested time declined. The original appointment time remains.", refreshFailed ? "error" : "success");
  }, "Could not respond to the suggested appointment.", "Updating appointment…", {
    optimistic: () => {
      if (!booking) return;
      if (accept && booking.pendingAppointmentAt) {
        booking.scheduledAt = booking.pendingAppointmentAt;
        const proposedAt = new Date(booking.pendingAppointmentAt);
        booking.date = localDateInputValue(proposedAt);
        booking.time = proposedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      booking.pendingAppointmentProposalId = "";
      booking.pendingAppointmentAt = "";
    },
    rollback: () => {
      if (booking && previousAppointment) Object.assign(booking, previousAppointment);
    },
    renderOptimistic: renderAll,
  });
  return true;
}
function handleNegotiationChatAction(event) {
  const button = event.target.closest("[data-negotiation-chat]");
  if (!button) return false;
  const negotiation = priceNegotiations.find(item => item.id === button.dataset.negotiationChat);
  if (!negotiation?.conversationId) {
    showToast("The price conversation for this booking is unavailable.", "error");
    return true;
  }
  document.dispatchEvent(new CustomEvent("skillflex:open-conversation", {
    detail: { conversationId: negotiation.conversationId },
  }));
  return true;
}
document.querySelector("#appointment-proposal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const date = document.querySelector("#appointment-proposal-date").value;
  const time = document.querySelector("#appointment-proposal-time").value;
  const proposedAt = parseLocalAppointment(date, time);
  if (!proposedAt || proposedAt <= new Date()) {
    showToast("Choose a future date and time.", "error");
    return;
  }
  const bookingId = document.querySelector("#appointment-proposal-booking-id").value;
  runAction(async () => {
    const { error } = await appSupabase.rpc("propose_booking_appointment", {
      p_booking_id: bookingId,
      p_proposed_at: proposedAt.toISOString(),
    });
    if (error) throw error;
    await refreshSupabaseState();
    renderAll();
    event.target.closest("dialog").close();
    showToast("Time suggestion sent. The booking will stay unconfirmed until the customer responds.");
  }, "Could not send this time suggestion.");
});
function updateDashboardLoadingProgress() {
  if (!dashboardLoadingStartedAt) return;
  const elapsed = performance.now() - dashboardLoadingStartedAt;
  const estimatedRemaining = Math.max(0, Math.ceil((dashboardLoadEstimateMs - elapsed) / 1000));
  const progress = Math.min(95, Math.max(
    dashboardLoadingProgress,
    Math.round(10 + (elapsed / dashboardLoadEstimateMs) * 85),
  ));
  document.querySelector("#dashboard-loading-label").textContent = dashboardLoadingPhase;
  document.querySelector("#dashboard-loading-bar").value = progress;
  document.querySelector("#dashboard-loading-elapsed").textContent = `${Math.floor(elapsed / 1000)} seconds elapsed`;
  document.querySelector("#dashboard-loading-remaining").textContent = estimatedRemaining
    ? `Estimated time remaining: about ${estimatedRemaining} ${estimatedRemaining === 1 ? "second" : "seconds"}`
    : "Estimated time remaining: taking longer than usual";
}
function setDashboardLoadingPhase(progress, label) {
  dashboardLoadingProgress = Math.max(dashboardLoadingProgress, progress);
  dashboardLoadingPhase = label;
  if (!document.querySelector("#dashboard-loading-progress").hidden) updateDashboardLoadingProgress();
}
function startDashboardLoading() {
  dashboardLoadingStartedAt = performance.now();
  try {
    const previousEstimate = Number(localStorage.getItem(DASHBOARD_LOAD_ESTIMATE_KEY));
    if (Number.isFinite(previousEstimate) && previousEstimate >= 1000 && previousEstimate <= 120000) {
      dashboardLoadEstimateMs = previousEstimate;
    }
  } catch (error) {
    console.warn("Could not read the dashboard loading-time estimate.", error);
  }
  document.querySelector("#app-auth-status").hidden = false;
  document.querySelector("#dashboard-loading-skeleton").hidden = false;
  window.setTimeout(() => {
    if (!dashboardLoadingStartedAt || !document.body.classList.contains("app-auth-pending")) return;
    document.querySelector("#dashboard-loading-skeleton").hidden = false;
    document.querySelector("#dashboard-loading-progress").hidden = false;
    updateDashboardLoadingProgress();
    dashboardLoadingInterval = window.setInterval(updateDashboardLoadingProgress, 1000);
  }, 10000);
}
function finishDashboardLoading() {
  document.querySelector("#dashboard-loading-skeleton").removeAttribute("aria-busy");
  if (!dashboardLoadingStartedAt) return;
  const duration = performance.now() - dashboardLoadingStartedAt;
  window.clearInterval(dashboardLoadingInterval);
  dashboardLoadingInterval = null;
  document.querySelector("#app-auth-status").hidden = true;
  try {
    const previousEstimate = Number(localStorage.getItem(DASHBOARD_LOAD_ESTIMATE_KEY));
    const estimate = Number.isFinite(previousEstimate) && previousEstimate >= 1000 && previousEstimate <= 120000
      ? Math.round(previousEstimate * 0.7 + duration * 0.3)
      : Math.round(duration);
    localStorage.setItem(DASHBOARD_LOAD_ESTIMATE_KEY, String(Math.max(1000, Math.min(120000, estimate))));
  } catch (error) {
    console.warn("Could not save the dashboard loading-time estimate.", error);
  }
  dashboardLoadingStartedAt = 0;
}
async function runAction(action, failureMessage, loadingMessage = "Saving your changes…", {
  inlineFeedback,
  submitButton,
  friendlyFailureMessage,
  optimistic,
  rollback,
  renderOptimistic,
} = {}) {
  const loadingIndicator = document.querySelector("#loading-indicator");
  const loadingLabel = document.querySelector("#loading-label");
  const longStatus = document.querySelector("#loading-long-status");
  const activeElement = document.activeElement;
  const control = submitButton || (activeElement instanceof HTMLButtonElement
    ? activeElement
    : activeElement instanceof HTMLElement
      ? activeElement.closest("form")?.querySelector('button[type="submit"]')
      : null);
  const controlWasDisabled = control?.disabled ?? false;
  const actionStartedAt = performance.now();
  let loadingTimer;
  let longLoadingTimer;
  let progressInterval;
  const showActionLoading = () => {
    if (inlineFeedback) {
      inlineFeedback.hidden = false;
      inlineFeedback.dataset.state = "loading";
      inlineFeedback.textContent = loadingMessage;
    } else {
      loadingLabel.textContent = loadingMessage;
      loadingIndicator.hidden = false;
    }
  };
  const updateActionProgress = () => {
    const elapsed = performance.now() - actionStartedAt;
    const estimateRemaining = Math.max(0, Math.ceil((ACTION_LOAD_ESTIMATE_MS - elapsed) / 1000));
    document.querySelector("#loading-progress").value = Math.min(95, Math.round(10 + (elapsed / ACTION_LOAD_ESTIMATE_MS) * 85));
    document.querySelector("#loading-elapsed").textContent = `${Math.floor(elapsed / 1000)} seconds elapsed`;
    document.querySelector("#loading-remaining").textContent = estimateRemaining
      ? `Estimated time remaining: about ${estimateRemaining} ${estimateRemaining === 1 ? "second" : "seconds"}`
      : "Estimated time remaining: taking longer than usual";
  };
  pendingActionCount += 1;
  let optimisticApplied = false;
  loadingTimer = window.setTimeout(showActionLoading, 1000);
  longLoadingTimer = window.setTimeout(() => {
    loadingIndicator.hidden = false;
    loadingLabel.textContent = loadingMessage;
    longStatus.hidden = false;
    loadingIndicator.classList.add("is-long-running");
    updateActionProgress();
    progressInterval = window.setInterval(updateActionProgress, 1000);
  }, 10000);
  document.querySelector("#app-shell").setAttribute("aria-busy", "true");
  if (control && !control.disabled) {
    control.disabled = true;
    control.setAttribute("aria-busy", "true");
  }
  try {
    if (optimistic) {
      optimisticApplied = true;
      optimistic();
      renderOptimistic?.();
    }
    await action();
  } catch (error) {
    if (optimisticApplied && rollback) {
      try {
        rollback();
        renderOptimistic?.();
      } catch (rollbackError) {
        console.error("Could not roll back an optimistic Skill Flex update.", rollbackError);
        showToast("This change could not be saved or restored. Refresh the page to reload your account.", "error");
      }
    }
    console.error(failureMessage, error);
    if (inlineFeedback) {
      inlineFeedback.hidden = false;
      inlineFeedback.dataset.state = "error";
      inlineFeedback.textContent = error.userMessage || friendlyFailureMessage || failureMessage;
    } else {
      showToast(failureMessage, "error");
    }
  } finally {
    window.clearTimeout(loadingTimer);
    window.clearTimeout(longLoadingTimer);
    window.clearInterval(progressInterval);
    if (inlineFeedback?.dataset.state === "loading") inlineFeedback.hidden = true;
    if (control && control.isConnected) {
      control.disabled = controlWasDisabled;
      if (!controlWasDisabled) control.removeAttribute("aria-busy");
    }
    pendingActionCount = Math.max(0, pendingActionCount - 1);
    if (!pendingActionCount) {
      loadingIndicator.hidden = true;
      loadingIndicator.classList.remove("is-long-running");
      longStatus.hidden = true;
      document.querySelector("#app-shell").removeAttribute("aria-busy");
    }
  }
}
function showConnectedApp() {
  const status = document.querySelector("#app-auth-status");
  finishDashboardLoading();
  document.body.classList.remove("app-auth-pending");
  document.querySelector("#app-shell").hidden = false;
  status.hidden = true;
  document.dispatchEvent(new CustomEvent("skillflex:workspace-ready"));
}
function syncSellerNavigation() {
  const isSeller = state.services.length > 0;
  document.querySelectorAll('[data-seller-only]').forEach(element => { element.hidden = !isSeller; });
  document.querySelector("#mode-switch-label").textContent = isSeller ? "Manage my services" : "Offer a service";
  document.querySelector("#seller-entry-title").textContent = isSeller ? "Your skills, your business." : "Good at something?";
  document.querySelector("#seller-entry-description").textContent = isSeller ? "Manage your listings, requests and completed jobs." : "Create a listing and help someone on campus.";
}
function initializeDashboard() {
  const accountStatus = document.querySelector(".demo-pill");
  accountStatus.textContent = appSupabase ? "ONLINE" : "DEMO · LOCAL DATA";
  accountStatus.hidden = Boolean(appSupabase);
  document.querySelector("#signout-button").hidden = !appSupabase;
  if (!appSupabase) {
    state.profile.verified = false;
    seedProviders.forEach(provider => { provider.verified = false; });
    document.querySelector("#safety-modal .modal-footnote").textContent = "Demo reports remain in this browser and are not sent to a safety team.";
  }
  populateServiceSelects();
  updateGroupPrice();
  renderAll();
  const pageFromHash = window.location.hash.slice(1);
  const requestedPage = ["home", "bookings", "messages", "saved", "provider", "earnings", "profile-settings", "help-support", "requests", "activity"].includes(pageFromHash) ? pageFromHash : "home";
  showPage(requestedPage);
}
async function bootstrapStudentApp() {
  if (!appSupabase) {
    throw new Error(window.skillflexSupabaseError
      || "Skill Flex could not connect to Supabase. Start the Express server and check its .env configuration.");
  }
  appSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.clearSkillflexServerSession()
        .catch((sessionError) => console.error("Could not clear the secure Skill Flex session.", sessionError))
        .finally(() => window.location.replace("/"));
    }
    if (event === "TOKEN_REFRESHED" && session) {
      window.syncSkillflexServerSession(session).catch((syncError) => {
        console.error("Could not refresh the secure Skill Flex session.", syncError);
        if (syncError.code === "OTP_VERIFICATION_REQUIRED") {
          window.location.replace("login.html?verify=required");
        }
      });
    }
  });
  let timeoutId;
  setDashboardLoadingPhase(12, "Checking your session…");
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
  setDashboardLoadingPhase(28, "Securing your session…");
  try {
    await window.syncSkillflexServerSession(data.session);
  } catch (sessionError) {
    if (sessionError.code === "OTP_VERIFICATION_REQUIRED") {
      window.location.replace("login.html?verify=required");
      return;
    }
    throw sessionError;
  }
  setDashboardLoadingPhase(42, "Loading your profile…");
  const { data: profile, error: profileError } = await loadAccountProfile(data.session.user.id);
  if (profileError) throw profileError;
  // Email sign-up already collected these details; do not ask for them again.
  if (!profile.onboarding_completed && data.session.user.app_metadata?.provider === "email"
    && profile.full_name?.trim().length >= 2 && profile.university?.trim().length >= 2) {
    const { error: completionError } = await appSupabase.from("profiles").update({ onboarding_completed: true }).eq("id", data.session.user.id);
    if (completionError) throw completionError;
    profile.onboarding_completed = true;
  }
  if (!profile.onboarding_completed) {
    window.location.replace("onboarding.html");
    return;
  }
  appUser = data.session.user;
  loadHiddenMessages();
  loadChatDrafts();
  loadPendingMessages();
  setDashboardLoadingPhase(58, "Preparing your workspace…");
  state.profile = {
    name: profile.full_name,
    university: profile.university,
    course: profile.course,
    bio: profile.bio,
    email: appUser.email,
    verified: profile.campus_verified,
    skills: profile.skills || [],
    avatarUrl: profile.avatar_url || "",
    phoneNumber: profile.phone_number || "",
    cvPath: profile.cv_path || "",
    cvName: profile.cv_name || "",
    notifyBookingUpdates: profile.notify_booking_updates,
    notifyMessages: profile.notify_messages,
    location: "",
  };
  state.messages = loadCachedConversationMessages();
  state.messages.forEach((chat) => {
    olderMessagesAvailable.set(chat.id, chat.messages.length === MESSAGE_PAGE_SIZE);
    chat.messages = linkMessageReplies(chat.messages);
  });
  cacheConversationMessages(state.messages);
  initializeDashboard();
  document.querySelector("#profile-name").value = state.profile.name;
  document.querySelector("#profile-bio").value = state.profile.bio || "";
  document.querySelector("#profile-email").value = state.profile.email;
  loadAccountSettings();
  document.querySelector(".campus-card strong").textContent = state.profile.university || "Your campus";
  document.querySelector(".campus-card small").textContent = state.profile.course || "Student account";
  setDashboardLoadingPhase(72, "Syncing bookings, services and messages…");
  try {
    await refreshSupabaseState();
    dashboardDataLoaded = true;
    populateServiceSelects();
    updateGroupPrice();
    renderAll();
    document.querySelector("#profile-name").value = state.profile.name;
    document.querySelector("#profile-bio").value = state.profile.bio || "";
    document.querySelector("#profile-email").value = state.profile.email;
    loadAccountSettings();
    document.querySelector(".campus-card strong").textContent = state.profile.university || "Your campus";
    document.querySelector(".campus-card small").textContent = state.profile.course || "Student account";
  } catch (refreshError) {
    dashboardDataLoaded = true;
    dashboardLoadError = refreshError;
    renderAll();
    console.error("Could not refresh Skill Flex account data.", refreshError);
    showToast("Some account data could not be refreshed. Your cached conversations are still available.", "error");
  }
  setDashboardLoadingPhase(96, "Finishing your dashboard…");
  showConnectedApp();
  document.querySelector("#booking-count").textContent = String(
    state.bookings.filter((booking) => !["Declined", "Cancelled", "Completed"].includes(booking.status)).length,
  );
  renderConversations({ preserveChatState: true });
  if (window.location.hash === "#profile") {
    openStudentProfileEditor();
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  window.setInterval(() => {
      refreshLiveActivity().catch((error) => console.error("Could not refresh Skill Flex messages and bookings.", error));
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
          refreshLiveActivity().catch((error) => console.error("Could not refresh Skill Flex messages and bookings.", error));
    }
  });
  window.addEventListener("online", () => {
      retryQueuedMessages().catch((error) => console.error("Could not retry saved Skill Flex messages.", error));
  });
  if (navigator.onLine) {
      retryQueuedMessages().catch((error) => console.error("Could not retry saved Skill Flex messages.", error));
  }
}
function showPage(page, options = {}) {
  if (page === "profile") page = "profile-settings";
  if (page !== "bookings") window.skillflexIllustrations?.hideBookingSuccess();
  const view = document.querySelector(`[data-view="${page}"]`);
  if (!view) return;
  const pageTitles = {
    home: "Discover", bookings: "My bookings", messages: "Messages", saved: "Saved providers",
    provider: "My listings", earnings: "Estimated earnings", "profile-settings": "Your profile",
    "help-support": "Help & support", requests: "Campus requests", activity: "My activity",
  };
  const pageTitle = pageTitles[page];
  document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
  const pageHash = `#${page}`;
  if (window.location.hash !== pageHash) {
    persistPageScrollPosition();
    window.history.pushState({ ...pageHistoryState(), skillflexPage: page, skillflexScrollY: 0 }, "", `${window.location.pathname}${window.location.search}${pageHash}`);
  }
  if (page === "messages") {
    if (!options.openConversation) {
      setActiveConversation(null);
      pendingReplyId = null;
    }
  }
  state.activePage = page;
  if (page === "requests") window.skillflexGrowth?.refreshBoard();
  document.querySelector(".account-menu")?.removeAttribute("open");
  renderMarketplaceActivity();
    window.skillflexGrowth?.render();
  saveState();
  syncMessageChannels();
  document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active-view", element === view));
  document.querySelectorAll(".nav-link[data-page]").forEach((element) => {
    element.classList.toggle("active", element.dataset.page === page);
    if (element.dataset.page === page) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  });
  const mobilePage = page === "requests" ? "home" : ["home", "bookings", "messages"].includes(page) ? page : "profile-settings";
  document.querySelectorAll(".mobile-nav [data-page-link]").forEach(element => {
    if (element.dataset.pageLink === mobilePage) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  });
  document.body.classList.remove("search-open");
  globalSearch.setAttribute("aria-expanded", "false");
  document.querySelector("#search-suggestions").hidden = true;
  document.querySelector("#breadcrumb-title").textContent = pageTitle;
  document.title = `${pageTitle} | Skill Flex`;
  closeSidebar(sidebar.classList.contains("open") && sidebar.contains(document.activeElement));
  if (page === "saved") renderMarketplace("saved-grid", (appSupabase ? connectedProviders : seedProviders).filter((provider) => state.saved.includes(provider.id)));
  if (page === "messages") {
    renderConversations();
    if (activeConversationId && !document.hidden) {
      markConversationMessagesRead(activeConversationId)
        .catch((error) => console.error("Could not mark Skill Flex messages as read.", error));
    }
  }
  if (page === "provider") { renderListings(); renderPortfolio(); }
  if (page === "earnings") renderEarnings();
  if (page === "bookings") renderBookingList("user-booking-list", bookingsForActiveFilter());
  if (options.focusHeading) {
    const heading = view.querySelector("h1, h2");
    const destination = heading?.getClientRects().length ? heading : view;
    if (destination === view) destination.setAttribute("aria-label", pageTitle);
    destination.tabIndex = -1;
    destination.focus({ preventScroll: true });
  }
  // Section switches and history restores jump instantly; a smooth scroll left running from one section would override a restore.
  window.scrollTo({ top: Number.isFinite(options.restoreScroll) ? Math.max(0, options.restoreScroll) : 0, behavior: "instant" });
  if (appSupabase && appUser && ["home", "bookings", "messages", "provider", "earnings"].includes(page)) {
    refreshLiveActivity().catch((error) => console.error("Could not refresh Skill Flex activity for this page.", error));
  }
}
let pageScrollSaveTimer = null;
function pageHistoryState() {
  const currentState = window.history.state;
  return currentState && typeof currentState === "object" && !Array.isArray(currentState) ? currentState : {};
}
function persistPageScrollPosition() {
  window.clearTimeout(pageScrollSaveTimer);
  pageScrollSaveTimer = null;
  window.history.replaceState({
    ...pageHistoryState(),
    skillflexPage: window.location.hash.slice(1) || "home",
    skillflexScrollY: window.scrollY,
  }, "");
}
function openBooking(providerId, serviceId, negotiationId = "") {
  const provider = getProvider(providerId);
  const services = providerServices(providerId);
  if (!provider || !services.length) { showToast("This provider hasn’t listed an active service yet."); return; }
  const negotiation = negotiationId
    ? priceNegotiations.find(item => item.id === negotiationId && item.state === "agreed"
      && item.customerId === appUser?.id && item.providerId === providerId)
    : null;
  if (negotiationId && !negotiation) {
    showToast("This agreed price is no longer available for this service.", "error");
    return;
  }
  const bookingService = negotiation ? services.find(item => item.id === negotiation.serviceId) : null;
  if (negotiation && !bookingService) {
    showToast("This agreed service is not currently available for booking.", "error");
    return;
  }
  document.querySelector("#booking-provider-id").value = providerId;
  document.querySelector("#booking-negotiation-id").value = negotiationId;
  currentBookingNegotiationId = negotiationId;
  document.querySelector("#booking-service").innerHTML = services.map((service) => `<option value="${escapeHTML(service.id)}">${escapeHTML(service.title)} · ${servicePriceLabel(service)}</option>`).join("");
  document.querySelector("#booking-service").disabled = Boolean(negotiation);
  if (negotiation) document.querySelector("#booking-service").value = bookingService.id;
  else if (serviceId && services.some(service => service.id === serviceId)) document.querySelector("#booking-service").value = serviceId;
  document.querySelector("#booking-service-switch").hidden = services.length <= 1 || Boolean(negotiation);
  const selectedService = negotiation ? bookingService : services.find(item => item.id === document.querySelector("#booking-service").value);
  const savedDraft = selectedService
    ? window.skillflexJourney?.bookingDraft(providerId, selectedService.id, negotiationId) || (!negotiation ? bookingDrafts.get(`${providerId}:${selectedService.id}`) : null)
    : null;
  document.querySelector("#booking-confirm-label").hidden = !negotiation;
  document.querySelector("#booking-confirm-details").required = Boolean(negotiation);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  document.querySelector("#booking-date").min = localDateInputValue();
  document.querySelector("#booking-date").value = localDateInputValue(tomorrow);
  document.querySelector("#booking-time").value = "10:00";
  document.querySelector("#booking-note").value = "";
  document.querySelector("#booking-location").value = "";
  document.querySelector("#booking-location-type").value = "";
  document.querySelector("#booking-confirm-details").checked = false;
  document.querySelector("#booking-instructions").open = false;
  if (savedDraft) {
    document.querySelector("#booking-date").value = savedDraft.date;
    document.querySelector("#booking-time").value = savedDraft.time;
    document.querySelector("#booking-note").value = savedDraft.note;
    document.querySelector("#booking-location").value = savedDraft.location;
    document.querySelector("#booking-instructions").open = Boolean(savedDraft.note);
  }
  updateBookingSummary();
  if (savedDraft) {
    const savedLocationType = savedDraft.locationType
      || (savedDraft.location === "Online" ? "online" : savedDraft.location === "On campus" ? "campus" : savedDraft.location ? "other" : "");
    const locationType = document.querySelector("#booking-location-type");
    if ([...locationType.options].some(option => option.value === savedLocationType)) locationType.value = savedLocationType;
    if (savedLocationType === "other" && savedDraft.location && !savedDraft.locationType) {
      document.querySelector("#booking-location").value = savedDraft.location.replace(/^Other:\s*/, "");
    }
    updateBookingLocationVisibility();
  }
  openModal("booking-modal");
  window.skillflexJourney?.bookingOpened(Boolean(savedDraft));
  const modal = document.querySelector("#booking-modal");
  const draftRequest = crypto.randomUUID();
  modal.dataset.draftRequest = draftRequest;
  const slots = window.skillflexGrowth?.refreshSlots();
  if (savedDraft?.slot && slots) Promise.resolve(slots).then(() => {
    const select = document.querySelector("#booking-slot");
    if (!modal.open || modal.dataset.draftRequest !== draftRequest
      || document.querySelector("#booking-date").value !== savedDraft.date || select.value) return;
    if ([...select.options].some(option => option.value === savedDraft.slot)) {
      select.value = savedDraft.slot;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }).catch(error => console.warn("Could not restore the saved appointment slot.", error));
}
function updateBookingLocationVisibility() {
  const isOtherLocation = document.querySelector("#booking-location-type").value === "other";
  document.querySelector("#booking-location-details").hidden = !isOtherLocation;
  document.querySelector("#booking-location").required = isOtherLocation
    && !document.querySelector("#booking-appointment-details").hidden;
}
function updateBookingLocationOptions(service) {
  const locationType = document.querySelector("#booking-location-type");
  const previousValue = locationType.value;
  const choices = service.deliveryMethod === "online"
    ? [["online", "Online"]]
    : service.deliveryMethod === "in_person"
      ? [["campus", "On campus"], ["other", "Other location"]]
      : [["online", "Online"], ["campus", "On campus"], ["other", "Other location"]];
  locationType.replaceChildren(new Option("Choose a location", ""));
  choices.forEach(([value, label]) => locationType.add(new Option(label, value)));
  if (choices.some(([value]) => value === previousValue)) locationType.value = previousValue;
  else if (service.deliveryMethod === "online") locationType.value = "online";
  else if (service.deliveryMethod === "in_person") locationType.value = "campus";
  else locationType.value = "";
  updateBookingLocationVisibility();
}
function updateBookingRequestMode(service, hasAgreement) {
  const isQuoteRequest = serviceUsesPriceRange(service) && !hasAgreement;
  document.querySelector("#booking-title").textContent = isQuoteRequest ? "Request a custom quote" : "Request this service";
  document.querySelector("#booking-appointment-details").hidden = isQuoteRequest;
  document.querySelector("#booking-date").required = !isQuoteRequest;
  document.querySelector("#booking-time").required = !isQuoteRequest;
  document.querySelector("#booking-location-type").required = !isQuoteRequest;
  document.querySelector("#booking-note").required = isQuoteRequest;
  document.querySelector("#booking-note-label").textContent = isQuoteRequest
    ? "What would you like included?"
    : "Anything the provider should know?";
  document.querySelector("#booking-note").placeholder = isQuoteRequest
    ? "For example: I’d like 20 edited photos instead of the 10 included. Please quote the extra cost."
    : "Share a helpful detail";
  document.querySelector("#booking-custom-quote-hint").hidden = !isQuoteRequest;
  document.querySelector("#booking-instructions").open = isQuoteRequest || Boolean(document.querySelector("#booking-note").value);
  const instructionsSummary = document.querySelector("#booking-instructions summary");
  instructionsSummary.childNodes[0].textContent = isQuoteRequest ? "Describe your request " : "Add instructions ";
  instructionsSummary.querySelector("span").textContent = isQuoteRequest ? "(required)" : "(optional)";
  document.querySelector("#booking-negotiate").parentElement.hidden = isQuoteRequest || !["negotiation", "hybrid"].includes(service.negotiationMode) || hasAgreement;
  document.querySelector("#booking-submit").textContent = isQuoteRequest ? "Request a Quote" : "Send Booking Request";
  document.querySelector("#booking-availability-note").textContent = isQuoteRequest
    ? "This is not a booking. Accept the provider’s exact quote and scope before choosing an appointment."
    : hasAgreement
      ? "The provider must confirm this agreed booking request."
      : "The provider must confirm your requested appointment.";
}
function bookingLocationValue() {
  const locationType = document.querySelector("#booking-location-type").value;
  if (locationType === "online") return "Online";
  if (locationType === "campus") return "On campus";
  if (locationType === "other") return `Other: ${document.querySelector("#booking-location").value.trim()}`;
  return "";
}
function updateBookingSummary() {
  const providerId = document.querySelector("#booking-provider-id").value;
  const service = providerServices(providerId).find(item => item.id === document.querySelector("#booking-service").value);
  if (!service) return;
  const selectedNegotiation = currentBookingNegotiationId
    ? priceNegotiations.find(item => item.id === currentBookingNegotiationId && item.state === "agreed")
    : null;
  if (selectedNegotiation && selectedNegotiation.serviceId !== service.id) {
    currentBookingNegotiationId = "";
    document.querySelector("#booking-negotiation-id").value = "";
  }
  const negotiation = currentBookingNegotiationId
    ? priceNegotiations.find(item => item.id === currentBookingNegotiationId && item.state === "agreed")
    : null;
  const agreementReview = document.querySelector("#booking-agreement-review");
  agreementReview.hidden = !negotiation;
  document.querySelector("#booking-summary-service").textContent = service.title;
  document.querySelector("#booking-provider-name").textContent = getProvider(providerId)?.name || "";
  const negotiationMode = window.skillflexServiceUtils.normalizeNegotiationMode(service.negotiationMode);
  const isNegotiable = ["negotiation", "hybrid"].includes(negotiationMode);
  const isRangeQuote = serviceUsesPriceRange(service) && !negotiation;
  document.querySelector("#booking-negotiable-badge").textContent = negotiation ? "Agreed" : isRangeQuote ? "Quote required" : isNegotiable ? "Negotiable" : "Fixed price";
  document.querySelector("#booking-price-label").textContent = negotiation ? "Agreed price" : isRangeQuote ? "Estimated range" : "Listed price";
  document.querySelector("#booking-price").textContent = negotiation ? currency(negotiation.agreedPrice) : servicePriceLabel(service);
  document.querySelector("#booking-price-detail").textContent = isRangeQuote
    ? "Your exact price is confirmed after the provider reviews your requested scope."
    : "";
  updateBookingRequestMode(service, Boolean(negotiation));
  updateBookingLocationOptions(service);
  if (negotiation) {
    document.querySelector("#booking-provider-summary").textContent = getProvider(negotiation.providerId)?.name || "Your provider";
    document.querySelector("#booking-scope-summary").textContent = negotiation.agreedScope || service.description || "Service as agreed in messages.";
    document.querySelector("#booking-original-price").textContent = currency(negotiation.listedPrice);
    document.querySelector("#booking-agreed-price").textContent = currency(negotiation.agreedPrice);
  }
}
document.querySelector("#booking-service").addEventListener("change", () => {
  if (!document.querySelector("#booking-modal").open) { updateBookingSummary(); return; }
  openBooking(document.querySelector("#booking-provider-id").value, document.querySelector("#booking-service").value);
});
document.querySelector("#booking-location-type").addEventListener("change", updateBookingLocationVisibility);
document.querySelector("#booking-negotiate").addEventListener("click", (event) => {
  const providerId = document.querySelector("#booking-provider-id").value;
  const serviceId = document.querySelector("#booking-service").value;
  const service = providerServices(providerId).find(item => item.id === serviceId);
  if (!service || !["negotiation", "hybrid"].includes(service.negotiationMode)) {
    showToast("Price negotiation is available only for Negotiable services.", "error");
    return;
  }
  bookingDrafts.set(`${providerId}:${serviceId}`, {
    date: document.querySelector("#booking-date").value,
    time: document.querySelector("#booking-time").value,
    note: document.querySelector("#booking-note").value,
    locationType: document.querySelector("#booking-location-type").value,
    location: document.querySelector("#booking-location").value,
  });
  openServiceDiscussion(providerId, serviceId, event.currentTarget);
});
function openPriceOfferForm({ providerId, serviceId, action = "initial", negotiationId = "", offerId = "", conversationId = "", amount = "", description = "", chatProposal = false }) {
  if (!appSupabase) {
    showToast("Price negotiation requires a connected Skill Flex account.", "error");
    return;
  }
  if (!negotiationBackendAvailable) {
    showToast("Price negotiation is unavailable until the Supabase migration has been applied.", "error");
    return;
  }
  document.querySelector("#price-offer-provider-id").value = providerId;
  document.querySelector("#price-offer-service-id").value = serviceId;
  document.querySelector("#price-offer-negotiation-id").value = negotiationId;
  document.querySelector("#price-offer-response-id").value = offerId;
  document.querySelector("#price-offer-action").value = action;
  document.querySelector("#price-offer-conversation-id").value = conversationId;
  document.querySelector("#price-offer-amount").value = amount;
  const service = connectedServices.find(item => item.id === serviceId);
  const messageLabel = document.querySelector("#price-offer-message").closest("label");
  messageLabel.hidden = action === "proposal" && service?.negotiationMode !== "hybrid" && !chatProposal;
  document.querySelector("#price-offer-message").required = service?.priceType === "range";
  const messageHint = messageLabel.querySelector(".label-hint");
  if (messageHint) messageHint.textContent = service?.priceType === "range"
    ? "(required · state the exact scope included)"
    : service?.negotiationMode === "hybrid"
      ? "(optional · describe scope changes)"
    : "(optional · price only; listed scope stays the same)";
  document.querySelector("#price-offer-message").value = "";
  document.querySelector("#price-offer-message").placeholder = service?.priceType === "range"
    ? "Describe exactly what this quote includes, including the requested extras."
    : service?.negotiationMode === "hybrid"
      ? "Describe any agreed changes to the service scope."
    : "Add a note about your price offer.";
  document.querySelector("#price-offer-title").textContent = action === "counter" ? "Send a counteroffer" : action === "proposal" ? "Send a formal price proposal" : "Make a price offer";
  document.querySelector("#price-offer-description").textContent = description
    || (action === "counter" ? "The other person must explicitly accept or reject your counteroffer." : "A price is only final after the other person explicitly accepts it.");
  const modal = document.querySelector("#price-offer-modal");
  modal.classList.toggle("chat-price-sheet", chatProposal);
  const serviceSummary = document.querySelector("#price-offer-service-summary");
  serviceSummary.hidden = !chatProposal;
  document.querySelector("#price-offer-service-name").textContent = service?.title || "Selected service";
  document.querySelector("#price-offer-listed-price").textContent = currency(service?.price ?? 0);
  document.querySelector("#price-offer-submit").textContent = chatProposal ? "Send Proposal" : "Send offer";
  document.querySelector("#price-offer-feedback").hidden = true;
  openModal("price-offer-modal");
}
function exposePriceActionError(error) {
  if (typeof error?.message === "string" && error.message.trim()) {
    error.userMessage = error.message.trim().slice(0, 240);
  }
  return error;
}
async function openServiceDiscussion(providerId, serviceId, triggerButton, initialMessage = "") {
  if (!appSupabase) {
    showToast("Price discussion requires a connected Skill Flex account.", "error");
    return;
  }
  if (!negotiationBackendAvailable) {
    showToast("Price negotiation is unavailable until the Supabase migration has been applied.", "error");
    return;
  }
  await runAction(async () => {
    const { data: conversationId, error: conversationError } = await appSupabase.rpc("start_conversation", {
      p_other_user_id: providerId, p_booking_id: null,
    });
    if (conversationError) throw conversationError;
    const provider = getProvider(providerId);
    if (!provider) throw new Error("The service provider could not be found.");
    let chat = state.messages.find(item => item.id === conversationId);
    if (!chat) {
      chat = { id: conversationId, providerId, name: provider.name, messages: [] };
      state.messages.unshift(chat);
    }
    chat.name = provider.name;
    setActiveConversation(conversationId);
    chatNegotiationServiceSelection.set(conversationId, serviceId);
    conversationsOpeningNegotiation.add(conversationId);
    for (const modalId of ["#provider-detail-modal", "#booking-modal"]) {
      const modal = document.querySelector(modalId);
      if (modal.open) modal.close();
    }
    showPage("messages", { openConversation: true });
    let quoteRequestSent = false;
    let quoteMessageSent = false;
    let quoteMessageQueued = false;
    try {
      const { data: negotiationId, error: negotiationError } = await appSupabase.rpc("create_price_negotiation", {
        p_service_id: serviceId, p_conversation_id: conversationId,
        p_initial_amount: null, p_message: "",
      });
      if (negotiationError) throw negotiationError;
      if (initialMessage) {
        const service = connectedServices.find(item => item.id === serviceId);
        const message = createOutgoingMessage(`Custom quote request for ${service?.title || "this service"}: ${initialMessage}`);
        chat.messages.push(message);
        queuePendingMessage(chat, message);
        cacheConversationMessages(state.messages);
        quoteMessageQueued = true;
        await sendPendingMessage(chat, message);
        quoteMessageSent = true;
      }
      chat.messages = retainLocalOutgoingMessages(chat.messages, await loadConversationMessages(conversationId, provider.name));
      conversationMessageRefreshTimes.set(conversationId, Date.now());
      cacheConversationMessages(state.messages);
      const negotiation = await loadConversationPriceNegotiation(negotiationId);
      priceNegotiations = [
        negotiation,
        ...priceNegotiations.filter(item => item.id !== negotiation.id),
      ];
      quoteRequestSent = Boolean(initialMessage);
    } catch (error) {
      console.error("Could not finish loading the Skill Flex price discussion.", error);
      showToast(initialMessage
        ? quoteMessageSent
          ? "Quote request sent, but the conversation could not refresh. Reopen it to see the provider’s response."
          : quoteMessageQueued
            ? "Your quote message was not confirmed as sent. It is saved in this conversation; tap Retry to send it."
            : "Chat is open, but your quote request could not be sent. Try again from this conversation."
        : "Chat is open, but the price discussion could not finish loading. You can still message the provider.", "error");
    } finally {
      conversationsOpeningNegotiation.delete(conversationId);
      if (activeConversationId === conversationId && state.activePage === "messages") renderConversations();
    }
    if (quoteRequestSent) showToast("Quote request sent. Accept the provider’s exact price and scope before booking.", "success");
  }, "Could not open price discussion.", "Opening your conversation…", {
    friendlyFailureMessage: "Could not open the price discussion. Check that the migration is applied and try again.",
    submitButton: triggerButton,
  });
}
document.querySelector("#price-offer-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  const amountInput = document.querySelector("#price-offer-amount");
  if (!form.reportValidity()) return;
  const amount = Number(amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0 || !/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(amountInput.value)) {
    showToast("Enter a price with no more than two decimal places.", "error");
    amountInput.focus();
    return;
  }
  const action = document.querySelector("#price-offer-action").value;
  const providerId = document.querySelector("#price-offer-provider-id").value;
  const serviceId = document.querySelector("#price-offer-service-id").value;
  const negotiationId = document.querySelector("#price-offer-negotiation-id").value;
  const offerId = document.querySelector("#price-offer-response-id").value;
  const activeConversationId = document.querySelector("#price-offer-conversation-id").value;
  const service = connectedServices.find(item => item.id === serviceId);
  const isChatProposal = document.querySelector("#price-offer-modal").classList.contains("chat-price-sheet");
  const message = action === "proposal" && service?.negotiationMode !== "hybrid" && !isChatProposal
    ? "" : document.querySelector("#price-offer-message").value.trim();
  const feedback = document.querySelector("#price-offer-feedback");
  runAction(async () => {
    let conversationId = activeConversationId
      || priceNegotiations.find(item => item.id === negotiationId)?.conversationId;
    if (action === "counter") {
      const { error } = await appSupabase.rpc("decide_price_offer", {
        p_offer_id: offerId, p_action: "counter", p_counter_amount: amount, p_message: message,
      });
      if (error) throw error;
    } else {
      if (!conversationId) {
        const { data, error } = await appSupabase.rpc("start_conversation", {
          p_other_user_id: providerId, p_booking_id: null,
        });
        if (error) throw exposePriceActionError(error);
        conversationId = data;
      }
      const { error } = await appSupabase.rpc("create_price_negotiation", {
        p_service_id: serviceId, p_conversation_id: conversationId,
        p_initial_amount: amount, p_message: message,
      });
      if (error) throw exposePriceActionError(error);
    }
    await refreshSupabaseState();
    if (conversationId) setActiveConversation(conversationId);
    document.querySelector("#price-offer-modal").close();
    document.querySelector("#provider-detail-modal").close();
    showPage("messages", { openConversation: true });
    renderConversations();
    showToast(action === "counter" ? "Counteroffer sent." : "Price proposal sent.", "success");
  }, "Could not send this price proposal.", "Sending your price proposal…", {
    inlineFeedback: feedback,
    submitButton: form.querySelector('button[type="submit"]'),
    friendlyFailureMessage: "The price proposal could not be sent. Check the conversation and current offer status, then try again.",
  });
});
function openMessage(providerId, messageFor = "provider", serviceId) {
  if (document.querySelector("#message-form").dataset.sending) {
    showToast("Your conversation is still opening. Please wait before starting another.");
    return;
  }
  const provider = providerId.startsWith("customer:") ? getProvider(providerId) : getProvider(providerId);
  if (!provider || state.blocked.includes(providerId)) { showToast("You can’t message this student."); return; }
  const service = serviceId && providerServices(providerId).find(item => item.id === serviceId);
  document.querySelector("#message-provider-id").value = providerId;
  document.querySelector("#message-modal-title").textContent = `Message ${provider.name}`;
  document.querySelector("#message-modal-description").textContent = messageFor === "customer"
    ? `Coordinate your appointment for ${provider.service || "your booking"}.`
    : `Ask about ${service?.title || provider.service || "their services"} or find a time that works.`;
  document.querySelector("#message-first-text").value = "";
  openModal("message-modal");
}
function openProviderConversation(providerId) {
  const provider = getProvider(providerId);
  if (!provider || state.blocked.includes(providerId)) { showToast("You can’t message this student."); return; }
  runAction(async () => {
    let chat = state.messages.find((item) => item.providerId === providerId);
    if (!chat) {
      if (appSupabase) {
        const { data: conversationId, error } = await appSupabase.rpc("start_conversation", {
          p_other_user_id: providerId,
          p_booking_id: null,
        });
        if (error) throw error;
        chat = state.messages.find((item) => item.id === conversationId);
        if (!chat) {
          const messages = await loadConversationMessages(conversationId, provider.name);
          chat = { id: conversationId, providerId, name: provider.name, messages };
          state.messages.unshift(chat);
        }
      } else {
        chat = { id: `chat-${providerId}-${Date.now()}`, providerId, name: provider.name, messages: [] };
        state.messages.unshift(chat);
      }
    }
    setActiveConversation(chat.id);
    pendingReplyId = null;
    showPage("messages", { openConversation: true });
    document.querySelector('#chat-panel [name="message"]')?.focus();
  }, "Could not open this conversation.", "Opening conversation…");
}
async function startConversation(providerId, text) {
  text = text.trim();
  if (!text) throw new Error("Write a message before sending.");
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
    let chat = state.messages.find(item => item.id === conversationId);
    if (!chat) {
      chat = { id: conversationId, providerId: otherUserId, name: getProvider(providerId)?.name || "Student", messages: [] };
      state.messages.unshift(chat);
    }
    // First messages use the same persisted, idempotent outbox as the chat composer.
    const message = createOutgoingMessage(text);
    chat.messages.push(message);
    queuePendingMessage(chat, message);
    cacheConversationMessages(state.messages);
    setActiveConversation(conversationId);
    return { chat, message };
  }
  let chat = state.messages.find((item) => item.providerId === providerId);
  if (!chat) {
    chat = { id: `chat-${providerId}-${Date.now()}`, providerId, messages: [] };
    state.messages.unshift(chat);
  }
  chat.messages.push({ sender: "You", text, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) });
  setActiveConversation(chat.id);
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
    ? connectedServices.filter((service) => service.active && service.groups && service.providerId !== appUser.id).map((service) => `<option value="${escapeHTML(service.id)}">${escapeHTML(service.title)} · ${servicePriceLabel(service)} · ${escapeHTML(getProvider(service.providerId)?.name || "Student")}</option>`).join("")
    : seedProviders.map((provider) => `<option value="${escapeHTML(provider.id)}">${escapeHTML(provider.service)} · ${currency(provider.price)} · ${escapeHTML(provider.name)}</option>`).join("");
  document.querySelector("#group-service").innerHTML = options;
}
function addGroup(group) {
  state.groups.unshift(group);
  saveState();
  renderGroups();
}

document.querySelectorAll(".nav-link[data-page]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  showPage(link.dataset.page, { focusHeading: true });
}));
document.addEventListener("click", event => {
  const link = event.target.closest("[data-page-link]");
  if (!link) return;
  event.preventDefault();
  showPage(link.dataset.pageLink, { focusHeading: true });
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-open]");
  if (!button) return;
  const modalId = button.dataset.open;
  if (modalId === "profile-modal") { openStudentProfileEditor(); return; }
  if (modalId === "service-modal") window.skillflexServiceEditor.prepare();
  if (modalId === "blocked-modal") renderBlocked();
  if (modalId === "groups-modal") {
    groupProviderFilter = button.dataset.groupProvider || null;
    renderGroups();
  }
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
    if (groupProviderFilter) {
      const service = providerServices(groupProviderFilter).find(item => item.groups);
      if (service) document.querySelector("#group-service").value = appSupabase ? service.id : groupProviderFilter;
    }
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
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  const fromDialog = document.querySelector("#category-modal").open;
  document.querySelector("#category-modal").close();
  renderServiceCategories();
  if (fromDialog) (document.querySelector(`.category-strip [data-category="${CSS.escape(selectedCategory)}"]`) || document.querySelector(".more-categories")).focus({ preventScroll: true });
  renderMarketplace();
  renderSearchSuggestions();
});
document.addEventListener("click", event => {
  if (!event.target.closest("[data-clear-search]")) return;
  globalSearch.value = "";
  selectedCategory = "All";
  searchClear.hidden = true;
  renderServiceCategories();
  renderMarketplace();
  renderSearchSuggestions();
});
document.addEventListener("error", event => {
  if (event.target instanceof HTMLImageElement && event.target.closest(".provider-card, .detail-portfolio, .detail-profile-heading")) event.target.hidden = true;
}, true);
document.querySelector(".booking-directions").addEventListener("click", event => {
  const button = event.target.closest("[data-booking-direction]");
  if (!button) return;
  bookingDirection = button.dataset.bookingDirection;
  document.querySelectorAll("[data-booking-direction]").forEach(item => {
    item.classList.toggle("active", item === button);
    item.setAttribute("aria-pressed", String(item === button));
  });
  renderBookingList("user-booking-list", bookingsForActiveFilter());
});
document.querySelector("#global-search").addEventListener("input", () => {
  document.querySelector("#search-clear").hidden = !globalSearch.value;
  window.clearTimeout(globalSearchTimer);
  renderSearchSuggestions();
  if (!globalSearch.value.trim()) {
    renderMarketplace();
    return;
  }
  globalSearchTimer = window.setTimeout(() => {
    if (document.querySelector("#global-search").value.trim() && state.activePage !== "home") showPage("home");
    renderMarketplace();
  }, 180);
});
const globalSearch = document.querySelector("#global-search");
const searchSuggestions = document.querySelector("#search-suggestions");
const searchClear = document.querySelector("#search-clear");
if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
window.addEventListener("scroll", () => {
  window.clearTimeout(pageScrollSaveTimer);
  pageScrollSaveTimer = window.setTimeout(persistPageScrollPosition, 120);
}, { passive: true });
const mobileNav = document.querySelector(".mobile-nav");
let mobileNavScrollAnchor = window.scrollY;
let mobileNavScrollFrame = 0;
window.addEventListener("scroll", () => {
  if (window.innerWidth > 768 || mobileNavScrollFrame) return;
  mobileNavScrollFrame = requestAnimationFrame(() => {
    const currentScrollY = window.scrollY;
    const forceVisible = currentScrollY < 72
      || document.body.classList.contains("mobile-keyboard-open")
      || document.body.classList.contains("sidebar-open")
      || Boolean(document.querySelector("dialog[open]"))
      || (mobileNav && mobileNav.contains(document.activeElement) && document.activeElement.matches(":focus-visible"));
    if (mobileNav) {
      if (forceVisible) {
        mobileNav.classList.remove("is-hidden");
        mobileNavScrollAnchor = currentScrollY;
      } else if (currentScrollY - mobileNavScrollAnchor > 8) {
        mobileNav.classList.add("is-hidden");
        mobileNavScrollAnchor = currentScrollY;
      } else if (mobileNavScrollAnchor - currentScrollY > 20) {
        mobileNav.classList.remove("is-hidden");
        mobileNavScrollAnchor = currentScrollY;
      }
    }
    mobileNavScrollFrame = 0;
  });
}, { passive: true });
window.addEventListener("resize", () => {
  if (window.innerWidth > 768 && mobileNav) mobileNav.classList.remove("is-hidden");
}, { passive: true });
window.addEventListener("popstate", (event) => showPage(window.location.hash.slice(1) || "home", {
  restoreScroll: Number.isFinite(event.state?.skillflexScrollY) ? event.state.skillflexScrollY : 0,
}));
window.addEventListener("hashchange", () => {
  const page = window.location.hash.slice(1) || "home";
  if (page !== state.activePage) showPage(page);
});
if (navigator.platform?.toLowerCase().includes("mac")) document.querySelector(".search-box kbd").textContent = "⌘ K";
const mobileHeader = document.querySelector(".topbar");
globalSearch.addEventListener("focus", () => {
  mobileHeader.classList.remove("is-hidden");
  document.body.classList.add("search-open");
  globalSearch.setAttribute("aria-expanded", "true");
  searchClear.hidden = !globalSearch.value;
  renderSearchSuggestions();
});
globalSearch.addEventListener("blur", () => {
  window.setTimeout(() => {
    if (document.activeElement === globalSearch || document.activeElement === searchClear || searchSuggestions.contains(document.activeElement)) return;
    document.body.classList.remove("search-open");
    globalSearch.setAttribute("aria-expanded", "false");
    renderSearchSuggestions();
  }, 0);
});
globalSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    if (globalSearch.value) {
      globalSearch.value = "";
      globalSearch.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      globalSearch.blur();
    }
    return;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const suggestions = [...searchSuggestions.querySelectorAll("[data-search-suggestion]")];
    if (!suggestions.length) return;
    event.preventDefault();
    suggestions[event.key === "ArrowDown" ? 0 : suggestions.length - 1].focus();
  }
});
searchClear.addEventListener("click", () => {
  globalSearch.value = "";
  globalSearch.dispatchEvent(new Event("input", { bubbles: true }));
  globalSearch.focus();
});
searchSuggestions.addEventListener("keydown", (event) => {
  const suggestions = [...searchSuggestions.querySelectorAll("[data-search-suggestion]")];
  const index = suggestions.indexOf(document.activeElement);
  if (event.key === "Escape") {
    event.preventDefault();
    globalSearch.focus();
    globalSearch.blur();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const next = event.key === "ArrowDown"
      ? (index + 1) % suggestions.length
      : (index - 1 + suggestions.length) % suggestions.length;
    suggestions[next]?.focus();
  }
});
searchSuggestions.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-search-suggestion]")) event.preventDefault();
});
searchSuggestions.addEventListener("click", (event) => {
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
document.querySelector("#marketplace-search-submit").addEventListener("click", () => {
  renderMarketplace();
  document.querySelector("#search-suggestions").hidden = true;
  globalSearch.setAttribute("aria-expanded", "false");
  document.body.classList.remove("search-open");
  const heading = document.querySelector("#marketplace-heading");
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  heading.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
});
document.querySelector("#recent-view-all").addEventListener("click", () => {
  document.querySelector('#marketplace-filters [name="sort"]').value = "newest";
  document.querySelector("#marketplace-search-submit").click();
});
document.querySelectorAll('[data-activity-count="bookings"]').forEach(node => node.closest("a").addEventListener("click", () => {
  bookingDirection = "made";
  activeBookingFilter = "upcoming";
  document.querySelectorAll("[data-booking-direction]").forEach(button => {
    const active = button.dataset.bookingDirection === "made";
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-booking-filter]").forEach(button => button.classList.toggle("active", button.dataset.bookingFilter === "upcoming"));
}));
sidebar.addEventListener("keydown", event => {
  if (event.key !== "Tab" || !sidebar.classList.contains("open")) return;
  const focusable = [...sidebar.querySelectorAll('a,button,summary')].filter(node => {
    const closedDetails = node.closest("details:not([open])");
    return !node.hidden && !node.disabled && node.getClientRects().length
      && (!closedDetails || node === closedDetails.querySelector("summary"));
  });
  if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
  else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
});
window.matchMedia("(min-width:1101px)").addEventListener("change", event => { if (event.matches) closeSidebar(); });
document.addEventListener("click", event => {
  if (!event.target.closest(".account-menu")) document.querySelector(".account-menu").open = false;
});
document.addEventListener("keydown", event => {
  const account = document.querySelector(".account-menu");
  if (event.key === "Escape" && account.open) { account.open = false; account.querySelector("summary").focus(); }
});
document.querySelector("#mode-switch").addEventListener("click", () => {
  if (state.services.length) showPage("provider", { focusHeading: true });
  else {
    window.skillflexServiceEditor.prepare();
    openModal("service-modal");
  }
});

document.querySelector("#marketplace-grid").addEventListener("click", handleCardAction);
document.querySelector("#saved-grid").addEventListener("click", handleCardAction);
document.querySelector("#recent-grid").addEventListener("click", handleCardAction);
document.querySelector("#provider-detail-modal").addEventListener("click", (event) => {
  const jump = event.target.closest("[data-showcase-jump]");
  if (jump) {
    const heading = [...document.querySelectorAll("#provider-detail-content h3")].find(item => item.textContent === (jump.dataset.showcaseJump === "work" ? "Selected work" : "Student reviews"));
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: "start", behavior: "auto" }); }
    return;
  }
  const negotiation = event.target.closest("[data-negotiation-action]");
  if (negotiation) {
    if (negotiation.dataset.negotiationAction === "offer") {
      const service = connectedServices.find(item => item.id === negotiation.dataset.service);
      openPriceOfferForm({
        providerId: negotiation.dataset.provider, serviceId: negotiation.dataset.service,
        description: `Make an offer for ${service?.title || "this service"}. The provider must explicitly accept, reject or counter.`,
      });
    } else {
      openServiceDiscussion(negotiation.dataset.provider, negotiation.dataset.service);
    }
    return;
  }
  const button = event.target.closest("[data-book], [data-message], [data-report]");
  if (!button) return;
  if (button.dataset.book) { document.querySelector("#provider-detail-modal").close(); openBooking(button.dataset.book, button.dataset.service); }
  if (button.dataset.message) { document.querySelector("#provider-detail-modal").close(); openProviderConversation(button.dataset.message); }
  if (button.dataset.report) openReport(button.dataset.report);
});
function handleCardAction(event) {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.book) openBooking(button.dataset.book, button.dataset.service);
  if (button.dataset.message) openProviderConversation(button.dataset.message);
  if (button.dataset.report) openReport(button.dataset.report);
  if (button.dataset.profile) {
    void openProviderProfile(button.dataset.profile, button.dataset.service).catch((error) => {
      console.error("Could not open the Skill Flex provider profile.", error);
      showToast("Could not open this provider profile. Please try again.", "error");
    });
  }
  if (button.dataset.save) {
    const id = button.dataset.save;
    if (pendingProviderSaves.has(id)) {
      showToast("This provider is already being saved. Please wait.");
      return;
    }
    const saving = !state.saved.includes(id);
    state.saved = saving
      ? [...new Set([...state.saved, id])]
      : state.saved.filter((savedId) => savedId !== id);
    pendingProviderSaves.add(id);
    renderMarketplace();
    if (state.activePage === "saved") {
      renderMarketplace("saved-grid", (appSupabase ? connectedProviders : seedProviders)
        .filter((provider) => state.saved.includes(provider.id)));
    }
    renderMarketplaceActivity();
    setProviderSaveButtonsBusy(id, true);
    void runAction(async () => {
      try {
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
          await reconcileSavedChange();
          renderAll();
        } else {
          saveState();
        }
      } catch (error) {
        state.saved = saving
          ? state.saved.filter((savedId) => savedId !== id)
          : [...new Set([...state.saved, id])];
        renderMarketplace();
        if (state.activePage === "saved") {
          renderMarketplace("saved-grid", (appSupabase ? connectedProviders : seedProviders)
            .filter((provider) => state.saved.includes(provider.id)));
        }
        throw error;
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
  if (pendingGroupActions.has(group.id)) return;
  if (appSupabase) {
    const wasJoined = group.joinedByMe;
    const previousGroup = { joined: group.joined, joinedByMe: group.joinedByMe, status: group.status };
    pendingGroupActions.add(group.id);
    group.joinedByMe = !wasJoined;
    group.joined = Math.max(1, Math.min(group.capacity, group.joined + (wasJoined ? -1 : 1)));
    group.status = group.joined >= group.capacity ? "Full" : "Open";
    renderGroups();
    void runAction(async () => {
      try {
        const { error } = await appSupabase.rpc(wasJoined ? "leave_group_booking" : "join_group_booking", { p_group_id: group.id });
        if (error) throw error;
        await reconcileSavedChange();
        renderAll();
      } catch (error) {
        Object.assign(group, previousGroup);
        renderGroups();
        throw error;
      }
      showToast(wasJoined
        ? group.hostId === appUser.id
          ? "You cancelled the group booking. Members and the provider have been notified."
          : "You’ve left the group. Your place is free for another student."
        : "You’re in! Message the host to coordinate your group booking.");
    }, "Could not update your group booking.").finally(() => {
      pendingGroupActions.delete(group.id);
      renderGroups();
    });
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
  if (bookingSubmissionPending) {
    showToast("Another booking request is still sending. Wait for its result before sending this one.");
    return;
  }
  if (document.querySelector("#booking-confirm-details").required
      && !document.querySelector("#booking-confirm-details").checked) {
    showToast("Review the booking details and confirm before sending the request.", "error");
    return;
  }
  const providerId = document.querySelector("#booking-provider-id").value;
  const service = providerServices(providerId).find((item) => item.id === document.querySelector("#booking-service").value);
  if (!service) { showToast("Choose an available service first."); return; }
  const negotiationId = document.querySelector("#booking-negotiation-id").value;
  if (serviceUsesPriceRange(service) && !negotiationId) {
    const request = document.querySelector("#booking-note").value.trim();
    if (!request) {
      showToast("Describe the extras you want so the provider can quote them.", "error");
      document.querySelector("#booking-note").focus();
      return;
    }
    if (appSupabase) {
      if (!negotiationBackendAvailable) {
        showToast("Custom quotes are unavailable until the latest Supabase migration has been applied.", "error");
        return;
      }
      openServiceDiscussion(providerId, service.id, document.querySelector("#booking-submit"), request);
    } else {
      runAction(async () => {
        await startConversation(providerId, `Custom quote request for ${service.title}: ${request}`);
        event.target.closest("dialog").close();
        renderConversations();
        showPage("messages", { openConversation: true });
        showToast("Quote request shared in chat. Agree on a price and scope before making a booking.", "success");
      }, "Could not send your quote request.");
    }
    return;
  }
  const locationType = document.querySelector("#booking-location-type").value;
  if (!locationType) { showToast("Choose where the service will take place.", "error"); return; }
  if (locationType === "other" && !document.querySelector("#booking-location").value.trim()) {
    showToast("Add a location or meeting point.", "error");
    return;
  }
  const bookingDraftKey = `${providerId}:${service.id}`;
  const appointmentDate = document.querySelector("#booking-date").value;
  const appointmentTime = document.querySelector("#booking-time").value;
  const scheduledAt = window.skillflexGrowth ? window.skillflexGrowth.appointment(appointmentDate, appointmentTime) : parseLocalAppointment(appointmentDate, appointmentTime);
  if (!scheduledAt || scheduledAt <= new Date()) {
    showToast("Choose a future appointment date and time.");
    return;
  }
  if (appSupabase) {
    const negotiation = negotiationId
      ? priceNegotiations.find(item => item.id === negotiationId && item.state === "agreed"
        && item.serviceId === service.id && item.customerId === appUser.id)
      : null;
    if (negotiationId && !negotiation) {
      showToast("This agreed price is no longer available for this service.", "error");
      return;
    }
    window.skillflexIllustrations?.hideBookingSuccess();
    bookingSubmissionPending = true;
    const temporaryId = `pending-booking-${Date.now()}`;
    const submittedDraft = window.skillflexJourney?.bookingDraft(providerId, service.id, negotiationId);
    const submittedDraftRequest = document.querySelector("#booking-modal").dataset.draftRequest;
    const bookingRequestId = window.skillflexJourney?.requestId(JSON.stringify([providerId, service.id, scheduledAt.toISOString(), document.querySelector("#booking-note").value.trim(), bookingLocationValue()])) || crypto.randomUUID();
    const pendingBooking = {
      id: temporaryId, serviceId: service.id, providerId, customerId: appUser.id, customer: state.profile.name,
      scheduledAt: scheduledAt.toISOString(),
      service: service.title, category: service.category, price: negotiation?.agreedPrice ?? Number(service.price),
      listedPrice: negotiation?.listedPrice ?? Number(service.price), priceNegotiationId: negotiationId,
      scopeSnapshot: negotiation?.agreedScope || "",
      currency: service.currency || "GHS", date: appointmentDate,
      requestedLocation: bookingLocationValue(),
      time: scheduledAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      status: "Pending", type: "Individual",
      note: document.querySelector("#booking-note").value.trim(), reviewed: false,
    };
    state.bookings.unshift(pendingBooking);
    renderAll();
    event.target.closest("dialog").close();
    showPage("bookings");
    runAction(async () => {
      try {
        let result = negotiationId
          ? await appSupabase.rpc("create_booking_from_price_agreement", {
            p_negotiation_id: negotiationId,
            p_scheduled_at: scheduledAt.toISOString(),
            p_note: pendingBooking.note,
            p_location: pendingBooking.requestedLocation,
          })
          : await appSupabase.from("bookings").insert({
            id: bookingRequestId,
            service_id: service.id, customer_id: appUser.id, provider_id: providerId,
            scheduled_at: scheduledAt.toISOString(), note: pendingBooking.note,
            location: pendingBooking.requestedLocation,
            agreed_price: service.price, listed_price: service.price, currency: service.currency || "GHS",
          });
        if (!negotiationId && result.error?.code === "23505") {
          const existing = await appSupabase.from("bookings").select("id").eq("id", bookingRequestId).eq("customer_id", appUser.id).eq("provider_id", providerId).eq("service_id", service.id).maybeSingle();
          if (!existing.error && existing.data?.id === bookingRequestId) result = { data: existing.data, error: null };
        }
        const { error } = result;
        if (error) throw error;
        // A saved request remains usable even if the subsequent read fails.
        pendingBooking.id = negotiationId ? (Array.isArray(result.data) ? result.data[0]?.id : result.data?.id) || temporaryId : bookingRequestId;
        await reconcileSavedChange();
        if (!window.skillflexJourney) bookingDrafts.delete(bookingDraftKey);
        document.dispatchEvent(new CustomEvent("skillflex:booking-save", { detail: { state: "saved", providerId, serviceId: service.id, agreementId: negotiationId, requestId: bookingRequestId, submittedDraft } }));
        renderAll();
        window.skillflexIllustrations?.showBookingSuccess();
        showToast("Booking request sent. You can track it in My bookings.", "success");
      } catch (error) {
        state.bookings = state.bookings.filter((booking) => booking.id !== temporaryId);
        renderAll();
        const sameDraft = document.querySelector("#booking-modal").dataset.draftRequest === submittedDraftRequest;
        if (sameDraft) {
          window.skillflexGrowth?.refreshSlots();
          if (!document.querySelector("dialog[open]")) openModal("booking-modal");
        }
        document.dispatchEvent(new CustomEvent("skillflex:booking-save", { detail: { state: "failed", draftRequest: submittedDraftRequest } }));
        throw error;
      }
    }, "Could not send the booking request.").finally(() => {
      bookingSubmissionPending = false;
    });
    return;
  }
  window.skillflexIllustrations?.hideBookingSuccess();
  bookingSubmissionPending = true;
  state.bookings.unshift({
    id: `booking-${Date.now()}`, serviceId: service.id, scheduledAt: scheduledAt.toISOString(), providerId, service: service.title, price: Number(service.price),
    date: appointmentDate, time: scheduledAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    status: "Pending", type: "Individual", note: document.querySelector("#booking-note").value.trim(),
    requestedLocation: bookingLocationValue(),
    reviewed: false, customer: state.profile.name,
  });
  bookingDrafts.delete(bookingDraftKey);
  saveState();
  bookingSubmissionPending = false;
  event.target.closest("dialog").close();
  renderAll();
  showPage("bookings");
  window.skillflexIllustrations?.showBookingSuccess({ local: true });
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
    status: "Pending", type: "Group booking",
    note: "Hosting this group booking", reviewed: false,
  });
  saveState();
  event.target.closest("dialog").close();
  renderAll();
  showToast("Group booking created. You’re the host!");
});
document.querySelector("#message-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.sending) return;
  const input = document.querySelector("#message-first-text");
  const text = input.value.trim();
  if (!text) {
    showToast("Write a message before sending.", "error");
    input.focus();
    return;
  }
  const providerId = document.querySelector("#message-provider-id").value;
  form.dataset.sending = "true";
  runAction(async () => {
    const queued = await startConversation(providerId, text);
    event.target.closest("dialog").close();
    document.querySelector("#messages-layout").dataset.chatOpen = "true";
    renderConversations();
    showPage("messages", { openConversation: true });
    if (queued) {
      if (navigator.onLine) sendMessageWithoutBlocking(queued.chat, queued.message, "Message wasn't sent. It is saved on this device; tap Retry to try again.");
      else showToast("You’re offline. This message is saved on this device; tap Retry when you reconnect.");
    } else showToast("Conversation started.");
  }, "Could not open the conversation. Your message is still here.", "Opening conversation…", {
    submitButton: form.querySelector('button[type="submit"]'),
  }).finally(() => { delete form.dataset.sending; });
});
document.querySelector("#conversation-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-chat]");
  if (!button) return;
  setActiveConversation(button.dataset.chat);
  pendingReplyId = null;
  document.querySelector("#messages-layout").dataset.chatOpen = "true";
  renderConversations();
  markConversationMessagesRead(activeConversationId).catch((error) => console.error("Could not mark Skill Flex messages as read.", error));
  refreshConversationMessages(activeConversationId).catch((error) => {
    console.error("Could not refresh the selected Skill Flex conversation.", error);
    showToast("Could not refresh this chat’s messages. Check your connection and try again.", "error");
  });
});
document.addEventListener("skillflex:open-conversation", event => {
  const conversationId = event.detail?.conversationId;
  if (!conversationId || !appSupabase) return;
  runAction(async () => {
    await refreshSupabaseState();
    if (!state.messages.some(chat => chat.id === conversationId)) {
      throw new Error("This conversation is no longer available.");
    }
    setActiveConversation(conversationId);
    showPage("messages", { openConversation: true });
    renderConversations();
  }, "Could not open this negotiation conversation.", "Opening conversation…", {
    friendlyFailureMessage: "This conversation is no longer available to your account.",
  });
});
document.addEventListener("skillflex:open-booking", event => {
  const bookingId = event.detail?.bookingId;
  if (!bookingId || !appSupabase) return;
  runAction(async () => {
    await refreshSupabaseState();
    const booking = state.bookings.find(item => item.id === bookingId);
    if (!booking) throw new Error("This booking is no longer available.");
    bookingDirection = isOwnBooking(booking) ? "received" : "made";
    activeBookingFilter = "all";
    document.querySelectorAll("[data-booking-direction]").forEach(button => {
      const selected = button.dataset.bookingDirection === bookingDirection;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    document.querySelectorAll("[data-booking-filter]").forEach(button => {
      button.classList.toggle("active", button.dataset.bookingFilter === activeBookingFilter);
    });
    showPage("bookings");
    window.setTimeout(() => {
      [...document.querySelectorAll("[data-booking-card-id]")]
        .find(card => card.dataset.bookingCardId === bookingId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }, "Could not open this booking.", "Opening booking…", {
    friendlyFailureMessage: "This booking is no longer available to your account.",
  });
});
document.querySelector("#chat-panel").addEventListener("scroll", (event) => {
  if (event.target.id !== "chat-messages" || event.target.scrollTop > 32) return;
  loadOlderConversationMessages(activeConversationId).catch((error) => {
    console.error("Could not load older Skill Flex messages.", error);
    showToast("Could not load older messages. Check your connection and try again.", "error");
  });
}, true);
let conversationSearchTimer;
document.querySelector("#conversation-search").addEventListener("input", () => {
  window.clearTimeout(conversationSearchTimer);
  conversationSearchTimer = window.setTimeout(() => renderConversations({ preserveChatState: true }), 300);
});
document.querySelector("#chat-panel").addEventListener("change", event => {
  const selector = event.target.closest("[data-chat-service-select]");
  if (!selector) return;
  chatNegotiationServiceSelection.set(activeConversationId, selector.value);
  const chat = state.messages.find(item => item.id === activeConversationId);
  const currentPanel = selector.closest(".chat-negotiations");
  const updatedPanel = chat && createPriceNegotiationPanel(chat);
  if (updatedPanel) {
    currentPanel.replaceWith(updatedPanel);
    updatedPanel.querySelector("[data-chat-service-select]")?.focus({ preventScroll: true });
  }
});
document.querySelector("#chat-panel").addEventListener("click", (event) => {
  const proposePrice = event.target.closest("[data-chat-price-propose]");
  if (proposePrice) {
    const service = connectedServices.find(item => item.id === proposePrice.dataset.serviceId);
    const chat = state.messages.find(item => item.id === activeConversationId);
    if (!service || !chat) return;
    const action = service.providerId === appUser?.id ? "proposal" : "initial";
    openPriceOfferForm({
      providerId: service.providerId,
      serviceId: service.id,
      action,
      negotiationId: proposePrice.dataset.negotiationId,
      conversationId: chat.id,
      description: action === "initial"
        ? `Propose a price for ${service.title}. The provider must explicitly accept, reject or counter.`
        : `Propose a price for ${service.title}. The customer must explicitly accept or reject it.`,
      chatProposal: true,
    });
    return;
  }
  const priceAction = event.target.closest("[data-price-action]");
  if (priceAction) {
    const action = priceAction.dataset.priceAction;
    if (action === "book") {
      openBooking(priceAction.dataset.providerId, priceAction.dataset.serviceId, priceAction.dataset.negotiationId);
      return;
    }
    if (action === "counter" || action === "proposal" || action === "initial") {
      openPriceOfferForm({
        providerId: priceAction.dataset.providerId,
        serviceId: priceAction.dataset.serviceId,
        negotiationId: priceAction.dataset.negotiationId,
        offerId: priceAction.dataset.offerId || "",
        action,
        description: action === "counter"
          ? "Enter the price you propose. The other person must explicitly accept or reject it."
          : action === "initial"
            ? "Make a formal offer. The provider can accept, reject or send a counteroffer."
            : "Send a formal price proposal. The customer must explicitly accept or reject it.",
      });
      return;
    }
    const chat = state.messages.find(item => item.id === activeConversationId);
    const negotiation = priceNegotiations.find(item => item.id === priceAction.dataset.negotiationId);
    const offer = negotiation?.offers.find(item => item.id === priceAction.dataset.offerId);
    const previousNegotiation = negotiation ? { ...negotiation } : null;
    const previousOfferStatus = offer?.status;
    runAction(async () => {
      const { error } = await appSupabase.rpc("decide_price_offer", {
        p_offer_id: priceAction.dataset.offerId,
        p_action: action,
        p_counter_amount: null,
        p_message: "",
      });
      if (error) throw error;
      let refreshFailed = false;
      try {
        await refreshSupabaseState();
      } catch (refreshError) {
        console.error("Price response was saved, but the latest negotiation data could not be refreshed.", refreshError);
        refreshFailed = true;
      }
      if (chat) setActiveConversation(chat.id);
      renderConversations({ preserveChatState: true });
      showToast(refreshFailed
        ? "Your response was saved. Reload the page to refresh the latest price details."
        : action === "accept" ? "Price accepted. The agreed price is now ready for booking." : "Price offer rejected.",
      refreshFailed ? "error" : "success");
    }, "Could not update this price offer.", "Updating price offer…", {
      friendlyFailureMessage: "This offer may already have been answered or is no longer available.",
      optimistic: () => {
        if (!negotiation || !offer) return;
        offer.status = action === "accept" ? "accepted" : "rejected";
        if (action === "accept") {
          negotiation.state = "agreed";
          negotiation.agreedPrice = offer.amount;
          negotiation.acceptedOfferId = offer.id;
        }
      },
      rollback: () => {
        if (negotiation && previousNegotiation) Object.assign(negotiation, previousNegotiation);
        if (offer) offer.status = previousOfferStatus;
      },
      renderOptimistic: () => renderConversations({ preserveChatState: true }),
    });
    return;
  }
  const retryButton = event.target.closest("[data-retry-message]");
  if (retryButton) {
    retryPendingMessage(retryButton.dataset.retryMessage);
    return;
  }
  if (event.target.closest("[data-chat-back]")) {
    setActiveConversation(null);
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
    const message = createOutgoingMessage(text, replyTo || null);
    chat.messages.push(message);
    queuePendingMessage(chat, message);
    cacheConversationMessages(state.messages);
    renderConversations({ preserveChatState: true });
    if (!navigator.onLine) {
      showToast("You’re offline. This message is saved on this device; tap Retry when you reconnect.");
      return;
    }
    sendMessageWithoutBlocking(chat, message, "Message wasn't sent. It is saved on this device; tap Retry to try again.");
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
          console.error("Could not copy the Skill Flex message.", error);
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
document.querySelector("#listing-list").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-service]");
  const toggle = event.target.closest("[data-toggle-service]");
  if (edit) {
    const service = state.services.find((item) => item.id === edit.dataset.editService);
    if (!service || service.pending) return;
    window.skillflexServiceEditor.prepare(service);
    openModal("service-modal");
  }
  if (toggle) {
    const service = state.services.find((item) => item.id === toggle.dataset.toggleService);
    if (!service || service.pending) return;
    if (appSupabase) {
      if (pendingServiceToggles.has(service.id)) return;
      pendingServiceToggles.add(service.id);
      const previousActive = service.active;
      service.active = !previousActive;
      renderAll();
      void runAction(async () => {
        try {
          const { error } = await appSupabase.from("services").update({ is_active: service.active })
            .eq("id", service.id).eq("provider_id", appUser.id);
          if (error) throw error;
          await reconcileSavedChange();
          populateServiceSelects();
          renderAll();
        } catch (error) {
          const currentService = state.services.find((item) => item.id === service.id);
          if (currentService) currentService.active = previousActive;
          renderAll();
          throw error;
        }
        showToast(service.active ? "Service is active." : "Service paused. It won’t appear in search.");
      }, "Could not update this service.").finally(() => {
        pendingServiceToggles.delete(service.id);
        renderAll();
      });
      return;
    }
    service.active = !service.active;
    saveState();
    renderListings();
    showToast(service.active ? "Service is active." : "Service paused. It won’t appear in search.");
  }
});
async function persistStudentProfileDetails(details, previousProfile = state.profile) {
  const result = await appSupabase.rpc("save_student_profile", {
    p_full_name: details.name, p_university: details.university, p_bio: details.bio,
    p_location: details.location, p_student_id_number: details.studentIdNumber,
  });
  if (result.error?.code !== "PGRST202") return result;
  // A legacy deployment may save a bio/name edit without touching private identity.
  // Refuse multi-part edits until the atomic profile function is available.
  if (details.university !== previousProfile.university
    || details.location !== (previousProfile.location || "")
    || (details.studentIdNumber && details.studentIdNumber !== (previousProfile.studentIdNumber || ""))) {
    const error = new Error("Student details are temporarily unavailable. Your changes have not been saved.");
    error.userMessage = error.message;
    throw error;
  }
  return appSupabase.from("profiles").update({ full_name: details.name, bio: details.bio }).eq("id", appUser.id);
}
document.querySelector("#profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.querySelector("#profile-name").value.trim();
  const university = document.querySelector("#profile-university").value.trim();
  const studentIdNumber = document.querySelector("#profile-student-id").value.trim();
  const bio = document.querySelector("#profile-bio").value.trim();
  const email = document.querySelector("#profile-email").value.trim();
  const location = document.querySelector("#profile-location").value.trim();
  if (name.length < 2 || university.length < 2 || (studentIdNumber && studentIdNumber.length < 3)) {
    showToast("Enter your name and campus. A student ID is optional, with at least 3 characters if provided.", "error");
    return;
  }
  if (appSupabase) {
    const previousProfile = { ...state.profile };
    const campusChanged = university !== previousProfile.university;
    runAction(async () => {
      let canceledVerificationPhoto = "";
      if (campusChanged) {
        const { data: verificationRequest, error: verificationError } = await appSupabase.from("verification_requests")
          .select("id_photo_path").eq("student_id", appUser.id).eq("status", "open").maybeSingle();
        if (verificationError && !["42703", "PGRST204"].includes(verificationError.code)) throw verificationError;
        if (verificationError) {
          console.warn("Could not check for a pending ID photo because the verification migration is not available.", verificationError);
        }
        canceledVerificationPhoto = verificationRequest?.id_photo_path || "";
      }
      const { error } = await persistStudentProfileDetails(
        { name, university, bio, location, studentIdNumber },
        previousProfile,
      );
      if (error) throw error;
      let verificationPhotoCleanupFailed = false;
      if (canceledVerificationPhoto) {
        try {
          const { error: cleanupError } = await appSupabase.storage.from("student-verification-ids")
            .remove([canceledVerificationPhoto]);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          console.error("Campus profile was saved, but the canceled verification photo could not be deleted.", cleanupError);
          verificationPhotoCleanupFailed = true;
        }
      }
      if (campusChanged) state.profile.verified = false;
      Object.assign(state.profile, { name, university, bio, location });
      if (studentIdNumber) state.profile.studentIdNumber = studentIdNumber;
      state.profile.identityComplete = Boolean(name && university && state.profile.studentIdNumber);
      const emailChanged = email && email !== appUser.email;
      let emailError = null;
      if (emailChanged) {
        try { ({ error: emailError } = await appSupabase.auth.updateUser({ email })); }
        catch (error) { emailError = error; }
      }
      let refreshFailed = false;
      try { await refreshSupabaseState(); }
      catch (error) { refreshFailed = true; console.error("Profile saved, but refresh failed.", error); }
      renderAll();
      loadAccountSettings();
      event.target.closest("dialog").close();
      showToast(verificationPhotoCleanupFailed
        ? emailError
          ? "Profile saved. The email change and ID photo cleanup need attention; contact support."
          : "Profile saved, but the ID photo from your canceled verification could not be deleted. Contact support."
        : emailError ? "Your profile was saved, but the email change could not be requested. Try changing the email again."
          : refreshFailed ? "Your profile was saved. Reload to refresh the latest account details."
            : emailChanged ? "Profile updated. Confirm the email change using the link sent to your new address."
              : "Your student profile has been updated.",
      verificationPhotoCleanupFailed || emailError || refreshFailed ? "error" : "success");
    }, "Could not update your profile.", "Updating your profile…", {
      optimistic: () => {
        Object.assign(state.profile, { name, university, bio, location });
        if (studentIdNumber) state.profile.studentIdNumber = studentIdNumber;
        state.profile.identityComplete = Boolean(name && university && state.profile.studentIdNumber);
        if (campusChanged) state.profile.verified = false;
      },
      rollback: () => Object.assign(state.profile, previousProfile),
      renderOptimistic: renderAll,
    });
    return;
  }
  state.profile.name = name;
  state.profile.university = university;
  state.profile.studentIdNumber = studentIdNumber;
  state.profile.identityComplete = Boolean(name && university && studentIdNumber);
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
  document.querySelector("#profile-university").value = state.profile.university || "";
  document.querySelector("#profile-student-id").value = state.profile.studentIdNumber || "";
  document.querySelector("#profile-university-field").hidden = false;
  document.querySelector("#profile-student-id-field").hidden = state.profile.identityComplete;
  document.querySelector("#profile-university").required = true;
  document.querySelector("#profile-student-id").required = false;
  document.querySelector("#profile-bio").value = state.profile.bio;
  document.querySelector("#profile-email").value = state.profile.email;
  document.querySelector("#profile-location").value = state.profile.location || "";
  openModal("profile-modal");
}
document.querySelector("#profile-menu").addEventListener("click", () => showPage("profile-settings", { focusHeading: true }));
async function updatePushSettingsStatus() {
  const button = document.querySelector("#settings-push-toggle");
  const help = document.querySelector("#settings-push-help");
  const needsHomeScreenInstall = window.SkillflexPushPlatform.requiresHomeScreenInstall({
    platform: navigator.platform || "",
    userAgent: navigator.userAgent || "",
    maxTouchPoints: navigator.maxTouchPoints || 0,
    standalone: navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches,
  });
  help.hidden = !needsHomeScreenInstall;
  if (needsHomeScreenInstall) {
    button.disabled = true;
    button.textContent = "Add to Home Screen first";
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    button.disabled = true;
    button.textContent = "Browser notifications unavailable";
    return;
  }
  if (!window.isSecureContext) {
    button.disabled = true;
    button.textContent = "Use a secure connection";
    return;
  }
  if (Notification.permission === "denied") {
    button.disabled = true;
    button.textContent = "Notifications blocked in browser";
    return;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    button.disabled = false;
    button.textContent = subscription ? "Disable on this device" : "Enable on this device";
  } catch (error) {
    console.error("Could not check the browser push-notification status.", error);
    button.disabled = true;
    button.textContent = "Could not check notification status";
  }
}
function pushSettingsError(message) {
  const error = new Error(message);
  error.userMessage = message;
  return error;
}
function loadAccountSettings() {
  document.querySelector("#settings-full-name").value = state.profile.name || "";
  document.querySelector("#settings-email").value = appUser?.email || "";
  document.querySelector("#settings-university").value = state.profile.university || "";
  document.querySelector("#settings-bio").value = state.profile.bio || "";
  document.querySelector("#settings-cv-current").textContent = state.profile.cvName
    ? `Current CV: ${state.profile.cvName}. Only signed-in Skill Flex students can open it.`
    : "Add a PDF CV to your provider profile. Only signed-in Skill Flex students can open it.";
  document.querySelector("#settings-cv-file").value = "";
  document.querySelector("#settings-cv-remove").checked = false;
  document.querySelector("#settings-cv-remove-row").hidden = !state.profile.cvPath;
  document.querySelector("#settings-phone").value = state.profile.phoneNumber || "";
  document.querySelector("#settings-notify-bookings").checked = state.profile.notifyBookingUpdates !== false;
  document.querySelector("#settings-notify-messages").checked = state.profile.notifyMessages !== false;
  updatePushSettingsStatus();
  const avatar = document.querySelector("#settings-avatar-preview");
  if (state.profile.avatarUrl) avatar.src = state.profile.avatarUrl;
  else avatar.removeAttribute("src");
  const config = window.SKILLFLEX_SUPABASE_CONFIG || {};
  document.querySelector("#delete-account-open").disabled = !config.accountDeletionAvailable;
  document.querySelector("#account-delete-availability").hidden = Boolean(config.accountDeletionAvailable);
  const contacts = document.querySelector("#support-contact");
  contacts.replaceChildren();
  for (const email of (config.supportEmail || "").split(",").map((value) => value.trim())) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.endsWith(".example")) continue;
    const link = document.createElement("a");
    link.href = `mailto:${email}`;
    link.textContent = `Email ${email}`;
    contacts.append(link);
  }
  const phone = (config.supportWhatsApp || "").replace(/^\+/, "");
  if (/^[1-9]\d{6,14}$/.test(phone)) {
    const link = document.createElement("a");
    link.href = `https://wa.me/${phone}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Message us on WhatsApp";
    contacts.append(link);
  }
  document.querySelector("#support-contact-unavailable").hidden = contacts.childElementCount > 0;
  document.querySelector("#settings-phone").disabled = !accountSettingsColumnsAvailable;
  document.querySelector("#settings-notify-bookings").disabled = !accountSettingsColumnsAvailable;
  document.querySelector("#settings-notify-messages").disabled = !accountSettingsColumnsAvailable;
  document.querySelector("#settings-notifications-save").disabled = !accountSettingsColumnsAvailable;
  if (!accountSettingsColumnsAvailable) {
    setSettingsFeedback(document.querySelector("#notification-settings-feedback"),
      "Phone and notification preferences are unavailable until the site setup is completed.", "error");
  }
}
function setSettingsFeedback(element, message, kind = "success") {
  element.textContent = message;
  element.dataset.state = kind;
  element.hidden = !message;
}
async function removeUnusedAvatar(path, reason) {
  try {
    const { error } = await appSupabase.storage.from("profile-avatars").remove([path]);
    if (!error) return true;
    console.error(reason, error);
  } catch (error) {
    console.error(reason, error);
  }
  return false;
}
let pendingAvatarPreviewUrl = "";
document.querySelector("#settings-avatar-file").addEventListener("change", (event) => {
  const input = event.currentTarget;
  const photo = input.files[0];
  const preview = document.querySelector("#settings-avatar-preview");
  const feedback = document.querySelector("#account-profile-feedback");
  if (pendingAvatarPreviewUrl) {
    URL.revokeObjectURL(pendingAvatarPreviewUrl);
    pendingAvatarPreviewUrl = "";
  }
  if (!photo) {
    if (state.profile.avatarUrl) preview.src = state.profile.avatarUrl;
    else preview.removeAttribute("src");
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5_000_000) {
    input.value = "";
    if (state.profile.avatarUrl) preview.src = state.profile.avatarUrl;
    else preview.removeAttribute("src");
    setSettingsFeedback(feedback, "Choose a JPG, PNG or WebP image smaller than 5 MB.", "error");
    return;
  }
  pendingAvatarPreviewUrl = URL.createObjectURL(photo);
  preview.src = pendingAvatarPreviewUrl;
  setSettingsFeedback(feedback, "Photo selected. Select Save profile to upload it.", "loading");
});
document.querySelector("#account-profile-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.querySelector("#account-profile-feedback");
  const name = document.querySelector("#settings-full-name").value.trim();
  const university = document.querySelector("#settings-university").value.trim();
  const bio = document.querySelector("#settings-bio").value.trim();
  const phoneNumber = document.querySelector("#settings-phone").value.trim();
  const campusChanged = university !== state.profile.university;
  const photo = document.querySelector("#settings-avatar-file").files[0];
  const cvFile = document.querySelector("#settings-cv-file").files[0];
  const removeCv = document.querySelector("#settings-cv-remove").checked;
  if (name.length < 2 || university.length < 2) {
    setSettingsFeedback(feedback, "Enter your name and university (at least 2 characters each).", "error");
    return;
  }
  if (photo && (!["image/jpeg", "image/png", "image/webp"].includes(photo.type) || photo.size > 5_000_000)) {
    setSettingsFeedback(feedback, "Choose a JPG, PNG or WebP image smaller than 5 MB.", "error");
    return;
  }
  if ((cvFile && (cvFile.type !== "application/pdf" || cvFile.size > 5_000_000))
    || (cvFile && removeCv)) {
    setSettingsFeedback(feedback, "Choose one PDF CV smaller than 5 MB, or select the remove option.", "error");
    return;
  }
  if (!appSupabase || !appUser) {
    setSettingsFeedback(feedback, "Sign in to update your profile.", "error");
    return;
  }
  setSettingsFeedback(feedback, "");
  const previousProfile = { ...state.profile };
  runAction(async () => {
    let avatarPath = "";
    let uploadedCvPath = "";
    let cvMetadataUpdated = false;
    const previousAvatarUrl = state.profile.avatarUrl;
    const previousCvPath = state.profile.cvPath || null;
    const previousCvName = state.profile.cvName || null;
    let avatarUrl = state.profile.avatarUrl || null;
    let cvPath = previousCvPath;
    let cvName = previousCvName;
    if (photo) {
      let compressedPhoto;
      try {
        compressedPhoto = await window.skillflexServiceUtils.compressImageFile(photo, {
          maxDimension: 512, quality: 0.75, maxOutputBytes: 1_000_000,
        });
      } catch (error) {
        error.userMessage = error.message || "This photo could not be prepared. Try a different JPG, PNG or WebP image.";
        throw error;
      }
      avatarPath = `${appUser.id}/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await appSupabase.storage.from("profile-avatars")
        .upload(avatarPath, compressedPhoto, { contentType: compressedPhoto.type, cacheControl: "3600" });
      if (uploadError) {
        if (uploadError.statusCode === "404" || /bucket not found/i.test(uploadError.message || "")) {
          uploadError.userMessage = "Profile photo storage is not set up yet. Please contact support so the profile-avatars bucket can be enabled.";
        } else if (uploadError.statusCode === "403" || /row-level security|permission denied/i.test(uploadError.message || "")) {
          uploadError.userMessage = "Supabase blocked this photo upload. Check that profile-avatars allows signed-in users to upload to their own user folder.";
        } else {
          uploadError.userMessage = uploadError.message || "Supabase could not upload this profile photo. Please try again.";
        }
        throw uploadError;
      }
      avatarUrl = appSupabase.storage.from("profile-avatars").getPublicUrl(avatarPath).data.publicUrl;
    }
    if (cvFile) {
      uploadedCvPath = `${appUser.id}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await appSupabase.storage.from("provider-cvs")
        .upload(uploadedCvPath, cvFile, { contentType: "application/pdf", cacheControl: "3600" });
      if (uploadError) {
        if (avatarPath) {
          const cleaned = await removeUnusedAvatar(avatarPath, "Could not remove the unused profile photo after CV upload failure.");
          if (!cleaned) uploadError.userMessage = `${uploadError.userMessage || uploadError.message || "The CV upload failed."} The unused profile photo could not be removed from storage; please contact support.`;
        }
        throw uploadError;
      }
      cvPath = uploadedCvPath;
      cvName = cvFile.name.slice(0, 120);
    } else if (removeCv) {
      cvPath = null;
      cvName = null;
    }
    if (cvPath !== previousCvPath || cvName !== previousCvName) {
      const { error: cvUpdateError } = await appSupabase.from("profiles")
        .update({ cv_path: cvPath, cv_name: cvName }).eq("id", appUser.id);
      if (cvUpdateError) {
        if (uploadedCvPath) {
          const { error: cleanupError } = await appSupabase.storage.from("provider-cvs").remove([uploadedCvPath]);
          if (cleanupError) console.error("Could not remove the unused CV upload.", cleanupError);
        }
        if (avatarPath) {
          const cleaned = await removeUnusedAvatar(avatarPath, "Could not remove the unused profile photo after CV metadata failure.");
          if (!cleaned) cvUpdateError.userMessage = "Your CV settings could not be saved, and the unused profile photo could not be removed from storage. Please contact support.";
        }
        throw cvUpdateError;
      }
      cvMetadataUpdated = true;
    }
    const profileUpdate = {
      full_name: name,
      university,
      bio,
      avatar_url: avatarUrl,
    };
    if (accountSettingsColumnsAvailable) profileUpdate.phone_number = phoneNumber;
    // The RPC also synchronizes private student identity and verification.
    let result = await appSupabase.rpc("save_account_profile", {
      p_full_name: name, p_university: university, p_bio: bio,
      p_phone_number: phoneNumber, p_avatar_url: avatarUrl,
    });
    if (result.error?.code === "PGRST202") {
      if (campusChanged) {
        result.error.userMessage = "Campus changes are unavailable until the site setup is completed. Your changes have not been saved.";
      } else {
        delete profileUpdate.university;
        result = await appSupabase.from("profiles").update(profileUpdate).eq("id", appUser.id);
      }
    }
    const { error } = result;
    if (error) {
      if (cvMetadataUpdated) {
        const { error: rollbackError } = await appSupabase.from("profiles")
          .update({ cv_path: previousCvPath, cv_name: previousCvName }).eq("id", appUser.id);
        if (rollbackError) console.error("Could not restore the previous CV metadata after a profile-save failure.", rollbackError);
      }
      if (uploadedCvPath) {
        const { error: cleanupError } = await appSupabase.storage.from("provider-cvs").remove([uploadedCvPath]);
        if (cleanupError) console.error("Could not remove the unused CV upload after a profile-save failure.", cleanupError);
      }
      if (avatarPath) {
        const cleaned = await removeUnusedAvatar(avatarPath, "Could not remove the unused profile photo upload.");
        if (!cleaned) error.userMessage = `${error.userMessage || error.message || "Could not save your profile."} The unused profile photo could not be removed from storage; please contact support.`;
      }
      throw error;
    }
    state.profile.name = name;
    state.profile.university = university;
    state.profile.bio = bio;
    state.profile.phoneNumber = phoneNumber;
    state.profile.avatarUrl = avatarUrl || "";
    state.profile.cvPath = cvPath || "";
    state.profile.cvName = cvName || "";
    let cvCleanupFailed = false;
    let avatarCleanupFailed = false;
    if (avatarPath && previousAvatarUrl) {
      const prefix = `${window.SKILLFLEX_SUPABASE_CONFIG.url}/storage/v1/object/public/profile-avatars/`;
      if (previousAvatarUrl.startsWith(prefix)) {
        const oldPath = previousAvatarUrl.slice(prefix.length).split("?")[0];
        if (oldPath.startsWith(`${appUser.id}/`) && !oldPath.includes("..")) {
          avatarCleanupFailed = !(await removeUnusedAvatar(oldPath, "Could not remove the replaced profile photo."));
        }
      }
    }
    if ((cvFile || removeCv) && previousCvPath && previousCvPath !== cvPath) {
      const { error: cleanupError } = await appSupabase.storage.from("provider-cvs").remove([previousCvPath]);
      if (cleanupError) {
        console.error("CV settings were saved, but the replaced CV file could not be deleted.", cleanupError);
        cvCleanupFailed = true;
      }
    }
    if (campusChanged) {
      // Reload the authoritative verification state after a campus change.
      state.profile.verified = false;
      const refreshed = await loadAccountProfile(appUser.id);
      if (!refreshed.error) state.profile.verified = refreshed.data.campus_verified;
    }
    document.querySelector("#profile-name").value = name;
    document.querySelector("#profile-bio").value = bio;
    renderAll();
    loadAccountSettings();
    if (pendingAvatarPreviewUrl) {
      URL.revokeObjectURL(pendingAvatarPreviewUrl);
      pendingAvatarPreviewUrl = "";
    }
    if (campusChanged) {
      showToast("Campus updated. Submit a new campus verification request if needed.");
    }
    document.querySelector("#settings-avatar-file").value = "";
    const cleanupWarnings = [];
    if (avatarCleanupFailed) cleanupWarnings.push("the old profile photo may still use storage");
    if (cvCleanupFailed) cleanupWarnings.push("the older CV file could not be deleted");
    setSettingsFeedback(feedback, cleanupWarnings.length
      ? `Your profile was saved, but ${cleanupWarnings.join(" and ")}. Contact support.`
      : "Your profile has been saved.", cleanupWarnings.length ? "error" : "success");
  }, "Could not save your profile.", "Saving your profile…", {
    inlineFeedback: feedback,
    submitButton: form.querySelector('button[type="submit"]'),
    optimistic: () => {
      Object.assign(state.profile, { name, university, bio, phoneNumber });
      if (campusChanged) state.profile.verified = false;
    },
    rollback: () => Object.assign(state.profile, previousProfile),
    renderOptimistic: renderAll,
  });
});
document.querySelector("#password-change-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.querySelector("#password-change-feedback");
  const password = document.querySelector("#settings-new-password").value;
  const confirmation = document.querySelector("#settings-confirm-password").value;
  if ([...password].length < 8 || new TextEncoder().encode(password).length > 72) {
    setSettingsFeedback(feedback, "Choose a password with at least 8 characters and no more than 72 bytes.", "error");
    return;
  }
  if (password !== confirmation) {
    setSettingsFeedback(feedback, "The new passwords do not match.", "error");
    return;
  }
  runAction(async () => {
    const { error } = await appSupabase.auth.updateUser({ password });
    if (error) throw error;
    form.reset();
    setSettingsFeedback(feedback, "Your password has been updated.");
  }, "Could not update your password.", "Updating your password…", {
    inlineFeedback: feedback,
    submitButton: form.querySelector('button[type="submit"]'),
  });
});
document.querySelector("#settings-notifications-save").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const feedback = document.querySelector("#notification-settings-feedback");
  if (!accountSettingsColumnsAvailable) return;
  const notifyBookingUpdates = document.querySelector("#settings-notify-bookings").checked;
  const notifyMessages = document.querySelector("#settings-notify-messages").checked;
  const previousSettings = {
    notifyBookingUpdates: state.profile.notifyBookingUpdates,
    notifyMessages: state.profile.notifyMessages,
  };
  runAction(async () => {
    const { error } = await appSupabase.from("profiles").update({
      notify_booking_updates: notifyBookingUpdates,
      notify_messages: notifyMessages,
    }).eq("id", appUser.id);
    if (error) throw error;
    setSettingsFeedback(feedback, "Notification settings have been saved.");
  }, "Could not save notification settings.", "Saving notification settings…", {
    inlineFeedback: feedback,
    submitButton: button,
    optimistic: () => Object.assign(state.profile, { notifyBookingUpdates, notifyMessages }),
    rollback: () => Object.assign(state.profile, previousSettings),
  });
});
document.querySelector("#settings-push-toggle").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const feedback = document.querySelector("#settings-push-feedback");
  runAction(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      throw pushSettingsError("This browser does not support push notifications.");
    }
    if (!window.isSecureContext) throw pushSettingsError("Browser notifications require a secure HTTPS connection.");
    if (Notification.permission === "denied") {
      throw pushSettingsError("Notifications are blocked in your browser settings. Allow them for Skill Flex, then try again.");
    }
    if (!await (Notification.permission === "granted" ? Promise.resolve("granted") : Notification.requestPermission())
      .then((permission) => permission === "granted")) {
      throw pushSettingsError("Allow notifications in your browser to enable alerts.");
    }

    const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
    const currentSubscription = await registration.pushManager.getSubscription();
    const { data: sessionData, error: sessionError } = await appSupabase.auth.getSession();
    if (sessionError) throw sessionError;
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw pushSettingsError("Sign in again before changing browser notifications.");

    if (currentSubscription) {
      const deleteResponse = await fetch("/api/push-subscriptions", {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(currentSubscription.toJSON()),
      });
      if (!deleteResponse.ok) {
        const result = await deleteResponse.json().catch(() => ({}));
        throw pushSettingsError(result.error || "Could not disable browser notifications.");
      }
      if (!await currentSubscription.unsubscribe()) {
        throw pushSettingsError("Skill Flex removed this device, but the browser could not disable its push subscription.");
      }
      setSettingsFeedback(feedback, "Browser notifications are disabled on this device.");
    } else {
      const configResponse = await fetch("/api/push-config", { cache: "no-store" });
      const config = await configResponse.json();
      if (!configResponse.ok) throw pushSettingsError(config.error || "Browser notifications are not configured.");
      const applicationServerKey = Uint8Array.from(
        atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (character) => character.charCodeAt(0),
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const saveResponse = await fetch("/api/push-subscriptions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!saveResponse.ok) {
        const result = await saveResponse.json().catch(() => ({}));
        await subscription.unsubscribe();
        throw pushSettingsError(result.error || "Could not enable browser notifications.");
      }
      setSettingsFeedback(feedback, "Browser notifications are enabled on this device.");
    }
    await updatePushSettingsStatus();
  }, "Could not update browser notifications.", "Updating browser notifications…", {
    inlineFeedback: feedback,
    submitButton: button,
  });
});
document.querySelector("#support-ticket-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.querySelector("#support-ticket-feedback");
  const button = document.querySelector("#support-ticket-submit");
  const category = document.querySelector("#support-category").value;
  const message = document.querySelector("#support-message").value.trim();
  const screenshot = document.querySelector("#support-screenshot").files[0];
  if (!["Booking", "Payment", "User behaviour", "Bug", "Other"].includes(category) || message.length < 10) {
    setSettingsFeedback(feedback, "Choose a category and describe the issue in at least 10 characters.", "error");
    return;
  }
  if (screenshot && (!["image/jpeg", "image/png", "image/webp"].includes(screenshot.type) || screenshot.size > 5_000_000)) {
    setSettingsFeedback(feedback, "Choose a JPG, PNG or WebP screenshot smaller than 5 MB.", "error");
    return;
  }
  if (!appSupabase || !appUser) {
    setSettingsFeedback(feedback, "Sign in to send a support request.", "error");
    return;
  }
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = "Sending report…";
  setSettingsFeedback(feedback, "Sending your report…", "loading");
  (async () => {
    let screenshotPath = null;
    try {
      const { error: setupError } = await appSupabase.from("support_tickets").select("id").limit(0);
      if (setupError) throw setupError;
      if (screenshot) {
        const compressedScreenshot = await window.skillflexServiceUtils.compressImageFile(screenshot, {
          maxDimension: 1600, quality: 0.82,
        });
        screenshotPath = `${appUser.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await appSupabase.storage.from("support-screenshots")
          .upload(screenshotPath, compressedScreenshot, { contentType: compressedScreenshot.type, cacheControl: "3600" });
        if (uploadError) throw uploadError;
      }
      const { error } = await appSupabase.from("support_tickets").insert({
        user_id: appUser.id,
        category,
        message,
        screenshot_url: screenshotPath,
      });
      if (error) throw error;
      form.reset();
      setSettingsFeedback(feedback, "Your report was sent. Support will review it shortly.");
    } catch (error) {
      console.error("Could not submit the Skill Flex support ticket.", error);
      if (screenshotPath) {
        const { error: cleanupError } = await appSupabase.storage.from("support-screenshots").remove([screenshotPath]);
        if (cleanupError) console.error("Could not remove the unused support screenshot.", cleanupError);
      }
      setSettingsFeedback(feedback, ["PGRST205", "42P01"].includes(error.code)
        ? "Support reports are unavailable until the site setup is completed. Your report has not been sent."
        : "We could not send your report. Please try again.", "error");
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
      button.textContent = "Send report";
    }
  })();
});
document.querySelector("#delete-account-open").addEventListener("click", () => {
  document.querySelector("#delete-account-confirmation").value = "";
  setSettingsFeedback(document.querySelector("#delete-account-feedback"), "");
  openModal("delete-account-modal");
});
document.querySelector("#delete-account-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const feedback = document.querySelector("#delete-account-feedback");
  const button = document.querySelector("#delete-account-submit");
  const confirmation = document.querySelector("#delete-account-confirmation").value;
  if (confirmation !== "DELETE") {
    setSettingsFeedback(feedback, "Type DELETE exactly to confirm.", "error");
    return;
  }
  runAction(async () => {
    button.textContent = "Closing account…";
    const response = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ confirmation }),
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || "Account closure could not be completed.");
      error.userMessage = error.message;
      throw error;
    }
    try {
      await appSupabase.auth.signOut({ scope: "local" });
    } catch (error) {
      console.error("The closed account's local Supabase session could not be cleared.", error);
    }
    try {
      await window.clearSkillflexServerSession();
    } catch (error) {
      console.error("The closed account's server session could not be cleared.", error);
    }
    window.location.replace("login.html?account=closed");
  }, "Could not close your account.", "Closing your account…", {
    inlineFeedback: feedback,
    submitButton: button,
  }).finally(() => {
    button.textContent = "Permanently delete account";
  });
});
window.addEventListener("skillflex:edit-profile", openStudentProfileEditor);
document.querySelector("#verification-open").addEventListener("click", () => {
  if (appSupabase && document.querySelector("#verification-open").dataset.requested === "open") {
    showToast("Your campus verification request is waiting for review.");
    return;
  }
  if (state.profile.verified) {
    showToast("Your campus status is verified.");
    return;
  }
  document.querySelector("#verification-email").value = state.profile.email;
  document.querySelector("#verification-photo").value = "";
  const feedback = document.querySelector("#verification-feedback");
  feedback.hidden = true;
  feedback.textContent = "";
  openModal("verification-modal");
});
document.querySelector("#verification-cta").addEventListener("click", () => {
  document.querySelector("#verification-open").click();
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
  if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { showToast("Choose a JPG, PNG or WebP image for your portfolio."); return; }
  if (file && file.size > 1000000) { showToast("Please choose an image smaller than 1 MB."); return; }
  if (appSupabase) {
    const pendingItem = { id: crypto.randomUUID(), title: document.querySelector("#portfolio-title").value.trim(), description: document.querySelector("#portfolio-description").value.trim(), image: "", pending: true };
    runAction(async () => {
      let imagePath = null;
      if (file) {
        const compressedImage = await window.skillflexServiceUtils.compressImageFile(file, {
          maxDimension: 1600, quality: 0.84, maxInputBytes: 5_000_000, maxOutputBytes: 1_000_000,
        });
        imagePath = `${appUser.id}/${crypto.randomUUID()}.webp`;
        const { error: uploadError } = await appSupabase.storage.from("portfolio-images").upload(imagePath, compressedImage, {
          contentType: compressedImage.type, upsert: false,
        });
        if (uploadError) throw uploadError;
      }
      const { error } = await appSupabase.from("portfolio_items").insert({
        id: pendingItem.id, provider_id: appUser.id, title: pendingItem.title,
        description: pendingItem.description, image_path: imagePath,
      });
      if (error) {
        if (imagePath) {
          const { error: cleanupError } = await appSupabase.storage.from("portfolio-images").remove([imagePath]);
          if (cleanupError) console.error("Could not clean up an uploaded portfolio image.", cleanupError);
        }
        throw error;
      }
      pendingItem.pending = false;
      await reconcileSavedChange();
      renderPortfolio();
      event.target.closest("dialog").close();
      event.target.reset();
      showToast("Portfolio item added to your profile.");
    }, "Could not add this portfolio item.", "Adding portfolio item…", {
      optimistic: () => {
        state.portfolio.unshift(pendingItem);
        if (file) void readImage(file).then(image => {
          if (state.portfolio.includes(pendingItem)) { pendingItem.image = image; renderPortfolio(); }
        }).catch(error => console.warn("Portfolio preview could not be read.", error));
      },
      rollback: () => { state.portfolio = state.portfolio.filter(item => item.id !== pendingItem.id); },
      renderOptimistic: renderPortfolio,
    });
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
  if (state.portfolio.find(item => item.id === button.dataset.removeWork)?.pending) return;
  if (appSupabase) {
    const removedItem = state.portfolio.find(item => item.id === button.dataset.removeWork);
    const removedIndex = state.portfolio.indexOf(removedItem);
    runAction(async () => {
      const item = removedItem;
      const { error } = await appSupabase.from("portfolio_items").delete()
        .eq("id", button.dataset.removeWork).eq("provider_id", appUser.id);
      if (error) throw error;
      if (item?.imagePath) {
        const { error: storageError } = await appSupabase.storage.from("portfolio-images").remove([item.imagePath]);
        if (storageError) console.error("Portfolio item was removed, but its image could not be deleted.", storageError);
      }
      await reconcileSavedChange();
      renderPortfolio();
      showToast("Portfolio item removed.");
    }, "Could not remove this portfolio item.", "Removing portfolio item…", {
      optimistic: () => { state.portfolio = state.portfolio.filter(item => item.id !== button.dataset.removeWork); },
      rollback: () => {
        if (removedItem && !state.portfolio.some(item => item.id === removedItem.id)) state.portfolio.splice(Math.max(0, removedIndex), 0, removedItem);
      },
      renderOptimistic: renderPortfolio,
    });
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
  const photo = document.querySelector("#verification-photo").files[0];
  const allowedTypes = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ]);
  if (!email.includes("@")) { showToast("Enter a valid university email address."); return; }
  if (!photo || !allowedTypes.has(photo.type)) {
    showToast("Choose a JPG, PNG, or WebP photo of your student ID.", "error");
    return;
  }
  if (photo.size > 5 * 1024 * 1024) {
    showToast("Choose a student ID photo smaller than 5 MB.", "error");
    return;
  }
  if (!appSupabase) {
    showToast("Connect your Skill Flex account to submit an ID photo securely. Nothing was saved.", "error");
    return;
  }
  const submitButton = document.querySelector("#verification-submit");
  const feedback = document.querySelector("#verification-feedback");
  runAction(async () => {
    const bucket = "student-verification-ids";
    const imagePath = `${appUser.id}/${crypto.randomUUID()}.${allowedTypes.get(photo.type)}`;
    const { error: uploadError } = await appSupabase.storage.from(bucket).upload(imagePath, photo, {
      contentType: photo.type,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { error: requestError } = await appSupabase.from("verification_requests").insert({
      student_id: appUser.id,
      university_email: email,
      id_photo_path: imagePath,
    });
    if (requestError) {
      const { error: cleanupError } = await appSupabase.storage.from(bucket).remove([imagePath]);
      if (cleanupError) {
        console.error("The verification request failed and its uploaded ID photo could not be removed.", cleanupError);
        const error = new Error("The request could not be submitted, and the private ID photo may still be stored. Contact support.");
        error.userMessage = error.message;
        throw error;
      }
      throw requestError;
    }

    document.querySelector("#verification-open").dataset.requested = "open";
    document.querySelector("#verification-cta small").textContent = "Verification is waiting for review";
    event.target.reset();
    event.target.closest("dialog").close();
    showToast("Verification request submitted. Your badge will appear after an administrator reviews it.");
    try {
      await refreshSupabaseState();
    } catch (error) {
      console.error("Verification request was submitted, but the profile refresh failed.", error);
      showToast("Your request was submitted, but its status could not be refreshed. Reload to check it.", "error");
    }
  }, "Could not submit your verification request.", "Uploading your ID for review…", {
    inlineFeedback: feedback,
    submitButton,
    friendlyFailureMessage: "Your ID photo could not be submitted. Check your connection and try again.",
  });
});
document.querySelector("#report-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const providerId = document.querySelector("#report-target").value;
  if (!providerId) { showToast("Choose the student you’re reporting."); return; }
  const provider = getProvider(providerId);
  const shouldBlock = document.querySelector("#report-block").checked;
  if (appSupabase) {
    const wasBlocked = state.blocked.includes(providerId);
    if (shouldBlock && !wasBlocked) {
      state.blocked.push(providerId);
      renderAll();
    }
    runAction(async () => {
      try {
        const { error } = await appSupabase.from("reports").insert({
          reporter_id: appUser.id, reported_user_id: providerId,
          reason: document.querySelector("#report-reason").value,
          details: document.querySelector("#report-details").value.trim(),
        });
        if (error) throw error;
        if (shouldBlock && !wasBlocked) {
          const { error: blockError } = await appSupabase.from("user_blocks").insert({
            blocker_id: appUser.id, blocked_id: providerId,
          });
          if (blockError) throw blockError;
        }
        await refreshSupabaseState();
        event.target.closest("dialog").close();
        renderAll();
        showToast(shouldBlock ? "Report submitted and student blocked." : "Report submitted to the safety team.", "success");
      } catch (error) {
        if (shouldBlock && !wasBlocked) state.blocked = state.blocked.filter((id) => id !== providerId);
        renderAll();
        throw error;
      }
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
    const id = button.dataset.unblock;
    runAction(async () => {
      const { error } = await appSupabase.from("user_blocks").delete()
        .eq("blocker_id", appUser.id).eq("blocked_id", button.dataset.unblock);
      if (error) throw error;
      await reconcileSavedChange();
      renderAll();
      renderBlocked();
      showToast("Student unblocked.");
    }, "Could not unblock this student.", "Unblocking student…", {
      optimistic: () => { state.blocked = state.blocked.filter(blockedId => blockedId !== id); },
      rollback: () => { if (!state.blocked.includes(id)) state.blocked.push(id); },
      renderOptimistic: () => { renderAll(); renderBlocked(); },
    });
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
  if (handleNegotiationChatAction(event)) return;
  if (handleAppointmentActions(event)) return;
  const decision = event.target.closest("[data-decision]");
  if (decision) {
    const booking = state.bookings.find((item) => item.id === decision.dataset.bookingId);
    if (!booking) return;
    if (decision.dataset.decision === "Completed" && !isOwnBooking(booking)
      && !window.confirm("Confirm that the provider has completed this service?")) return;
    const completionMessage = isOwnBooking(booking)
      ? "Marked complete. The client must verify the service."
      : "Service completion verified.";
    if (appSupabase) {
      runAction(async () => {
        await persistBookingStatus(booking.id, decision.dataset.decision);
        showToast(decision.dataset.decision === "Confirmed"
          ? "Booking accepted. The student can see the confirmation."
          : decision.dataset.decision === "Declined"
            ? "Booking request declined."
            : decision.dataset.decision === "Completed"
              ? completionMessage
              : decision.dataset.decision === "In progress" ? "Work started. The customer can see the update." : "Booking cancelled.");
      }, "Could not update this booking.");
    } else {
      booking.status = decision.dataset.decision === "Completed" && isOwnBooking(booking)
        ? "Awaiting verification" : decision.dataset.decision;
      if (booking.status === "In progress") booking.workStartedAt = new Date().toISOString();
      saveState();
      renderAll();
      showToast(decision.dataset.decision === "Confirmed"
        ? "Booking accepted. The student can see the confirmation."
        : decision.dataset.decision === "Declined"
          ? "Booking request declined."
          : decision.dataset.decision === "Completed"
            ? completionMessage
            : decision.dataset.decision === "In progress" ? "Work started. The customer can see the update." : "Booking cancelled.");
    }
    return;
  }
  const button = event.target.closest("[data-review]");
  if (!button) return;
  const booking = state.bookings.find((item) => item.id === button.dataset.review);
  openBookingReview(booking);
});
document.querySelector("#required-review-reminder").addEventListener("click", (event) => {
  const button = event.target.closest("[data-review]");
  if (button) openBookingReview(state.bookings.find((item) => item.id === button.dataset.review));
});
document.querySelector("#review-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const booking = state.bookings.find((item) => item.id === document.querySelector("#review-booking-id").value);
  if (!booking) return;
  if (appSupabase) {
    const review = { bookingId: booking.id, providerId: booking.providerId, rating: Number(document.querySelector("#review-rating").value), text: document.querySelector("#review-text").value.trim(), date: new Date().toISOString() };
    const wasReviewed = booking.reviewed;
    runAction(async () => {
      const { error } = await appSupabase.from("reviews").insert({
        booking_id: booking.id, reviewer_id: appUser.id, provider_id: booking.providerId,
        rating: review.rating,
        body: review.text,
      });
      if (error) throw error;
      await reconcileSavedChange();
      renderAll();
      event.target.closest("dialog").close();
      showToast("Thank you. Your review has been added.");
    }, "Could not post your review.", "Posting review…", {
      optimistic: () => { booking.reviewed = true; state.reviews.unshift(review); },
      rollback: () => {
        const current = state.bookings.find(item => item.id === booking.id);
        if (current) current.reviewed = wasReviewed;
        state.reviews = state.reviews.filter(item => item !== review);
      },
      renderOptimistic: renderAll,
    });
    return;
  }
  booking.reviewed = true;
  state.reviews.unshift({ bookingId: booking.id, providerId: booking.providerId, rating: Number(document.querySelector("#review-rating").value), text: document.querySelector("#review-text").value.trim(), date: new Date().toISOString() });
  saveState();
  renderAll();
  event.target.closest("dialog").close();
  showToast("Thank you. Your review has been added to your demo booking record.");
});
document.querySelector("#earnings-list").addEventListener("click", (event) => {
  const messageButton = event.target.closest("[data-message]");
  if (messageButton) {
    openMessage(messageButton.dataset.message);
    return;
  }
  if (handleNegotiationChatAction(event)) return;
  if (handleAppointmentActions(event)) return;
  const button = event.target.closest("[data-decision]");
  if (!button) return;
  const booking = state.bookings.find((item) => item.id === button.dataset.bookingId);
  if (!booking) return;
  if (appSupabase) {
    runAction(async () => {
      await persistBookingStatus(booking.id, button.dataset.decision);
      showToast(isOwnBooking(booking) ? "Marked complete. The client must verify the service." : "Service completion verified.");
    }, "Could not update this booking.");
    return;
  }
  booking.status = button.dataset.decision === "Completed" && isOwnBooking(booking)
    ? "Awaiting verification" : button.dataset.decision;
  if (booking.status === "In progress") booking.workStartedAt = new Date().toISOString();
  saveState();
  renderEarnings();
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
  const csv = window.skillflexCsv.encode(rows);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = "skillflex-earnings.csv"; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(appSupabase ? "Your completed earnings were exported." : "Your completed demo earnings were exported.");
});
document.querySelector("#signout-button").addEventListener("click", () => {
  if (!appSupabase) {
    showToast("Demo mode has no account to sign out of.");
    return;
  }
  runAction(async () => {
    await window.skillflexSignOut();
  }, "Could not sign out.");
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (state.activePage !== "home") showPage("home"); globalSearch.focus(); }
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
startDashboardLoading();
function showStartupFailure(message) {
  const status = document.querySelector("#app-auth-status");
  finishDashboardLoading();
  status.hidden = false;
  status.querySelectorAll("#dashboard-loading-skeleton, #dashboard-loading-progress").forEach(element => { element.hidden = true; });
  status.querySelector(".startup-failure")?.remove();
  const failure = document.createElement("div");
  failure.className = "startup-failure";
  status.append(failure);
  window.skillflexLoading.showError(failure, {
    title: "We couldn’t load your account",
    message,
    linkHref: "login.html",
    linkLabel: "Return to sign in",
    page: true,
    focus: true,
    onRetry: () => window.location.reload(),
  });
}
// A hung request must never leave the startup skeleton on screen forever.
const STARTUP_STUCK_MS = 45000;
const startupStuckTimer = window.setTimeout(() => {
  if (document.body.classList.contains("app-auth-pending")) {
    showStartupFailure("This is taking longer than expected. Check your connection and try again.");
  }
}, STARTUP_STUCK_MS);
bootstrapStudentApp().then(() => window.clearTimeout(startupStuckTimer), (error) => {
  window.clearTimeout(startupStuckTimer);
  console.error("Could not initialize the Skill Flex student dashboard.", error);
  if (error?.message === "SESSION_CHECK_TIMEOUT") {
    window.location.replace("login.html");
    return;
  }
  showStartupFailure("Check your connection and try again. Your data is safe.");
});

function updateGroupPrice() {
  const selectedId = document.querySelector("#group-service").value;
  const service = appSupabase ? connectedServices.find((item) => item.id === selectedId) : providerServices(selectedId)[0];
  const priceInput = document.querySelector("#group-price");
  if (service) priceInput.value = Math.max(1, Math.round(service.price * 0.85));
}
