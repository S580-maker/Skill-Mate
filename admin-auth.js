const adminClient = window.skillflexSupabase;
const adminStatus = document.querySelector("#admin-auth-status");

function showAdminGate(message, withLogin = false, withReload = false) {
  document.querySelector("#admin-auth-gate")?.removeAttribute("aria-busy");
  document.querySelector("#admin-auth-gate")?.classList.add("is-error");
  adminStatus.replaceChildren(document.createTextNode(message));
  if (withLogin) {
    const link = document.createElement("a");
    link.href = "login.html?next=admin";
    link.textContent = "Sign in as an administrator";
    adminStatus.append(link);
  }
  if (withReload) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Try again";
    button.addEventListener("click", () => window.location.reload());
    adminStatus.append(button);
  }
}

function withAdminTimeout(promise, message, timeoutMs = 15000) {
  let timeoutId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => window.clearTimeout(timeoutId));
}

function initials(name) {
  return (name || "Student").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function escapeAdminText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatAdminDate(value) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function showAdminToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 3000);
}

function updateAdminNavCount(viewId, count) {
  const badge = document.querySelector(`.side-nav .nav-link[href="#${viewId}"] .nav-count`);
  if (!badge) return;

  const total = Number(count);
  if (!Number.isFinite(total) || total < 1) {
    badge.hidden = true;
    badge.textContent = "";
    badge.removeAttribute("aria-label");
    return;
  }

  badge.hidden = false;
  badge.textContent = total > 99 ? "99+" : String(total);
  badge.setAttribute("aria-label", `${total} ${total === 1 ? "item" : "items"} need attention`);
}

function updateAdminNotificationBadge(count) {
  const badge = document.querySelector(".notification-dot");
  const button = document.querySelector(".notification-button");
  if (!badge || !button) return;
  const total = Number(count);
  const unread = Number.isFinite(total) && total > 0 ? total : 0;
  badge.hidden = unread === 0;
  button.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications");
}

function buildAdminDemandGapRows(requests, services) {
  const categories = new Map();
  const getCategory = (value) => {
    if (typeof value !== "string" || !value.trim()) return null;
    const label = value.trim();
    const key = label.toLocaleLowerCase();
    if (!categories.has(key)) {
      categories.set(key, { category: label, buyers: new Set(), requestCount: 0, providers: new Set() });
    }
    return categories.get(key);
  };

  for (const request of requests) {
    const category = getCategory(request.category);
    if (!category) continue;
    category.requestCount += 1;
    if (request.requester_id) category.buyers.add(request.requester_id);
  }
  for (const service of services) {
    const category = getCategory(service.category);
    if (category && service.provider_id) category.providers.add(service.provider_id);
  }

  return [...categories.values()].map(({ category, buyers, requestCount, providers }) => {
    const buyerCount = buyers.size;
    const providerCount = providers.size;
    const gap = Math.max(0, buyerCount - providerCount);
    return {
      category,
      buyerCount,
      requestCount,
      providerCount,
      gap,
      priority: gap > 0 && buyerCount >= 3 ? "Recruit now" : gap > 0 ? "Build supply" : buyerCount ? "Supply ahead" : "No open demand",
    };
  }).sort((left, right) => (
    Number(right.priority === "Recruit now") - Number(left.priority === "Recruit now")
    || Number(right.gap > 0) - Number(left.gap > 0)
    || right.buyerCount - left.buyerCount
    || right.gap - left.gap
    || left.category.localeCompare(right.category)
  ));
}

async function fetchAllAdminRows(query) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function renderAdminDemandGaps(rows) {
  const list = document.querySelector("#demand-gap-rows");
  list.replaceChildren();
  const recruitmentCount = rows.filter((row) => row.gap > 0).length;
  const openRequestCount = rows.reduce((total, row) => total + row.requestCount, 0);
  document.querySelector("#demand-gap-focus-count").textContent = recruitmentCount.toLocaleString();
  document.querySelector("#demand-gap-request-count").textContent = openRequestCount.toLocaleString();
  document.querySelector("#demand-gap-category-count").textContent = rows.length.toLocaleString();
  document.querySelector("#demand-gap-updated").textContent = `Updated ${new Date().toLocaleTimeString()}`;
  document.querySelector("#demand-gap-status").textContent = recruitmentCount
    ? `${recruitmentCount} ${recruitmentCount === 1 ? "category needs" : "categories need"} more providers. Highest buyer interest appears first.`
    : "No category currently has more interested buyers than active providers.";

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "demand-gap-empty";
    empty.textContent = "No buyer requests or active service listings yet. New activity will appear here.";
    list.append(empty);
    return;
  }

  for (const row of rows) {
    const item = document.createElement("article");
    item.className = "demand-gap-row";
    item.dataset.priority = row.gap > 0 ? (row.buyerCount >= 3 ? "high" : "recruit") : "covered";
    item.setAttribute("role", "row");

    const categoryCell = document.createElement("div");
    categoryCell.className = "demand-gap-category";
    categoryCell.setAttribute("role", "cell");
    const category = document.createElement("strong");
    category.textContent = row.category;
    const requestCount = document.createElement("small");
    requestCount.textContent = `${row.requestCount.toLocaleString()} open ${row.requestCount === 1 ? "request" : "requests"}`;
    categoryCell.append(category, requestCount);

    const buyerCell = document.createElement("div");
    buyerCell.className = "demand-gap-number";
    buyerCell.setAttribute("role", "cell");
    buyerCell.dataset.label = "Interested buyers";
    const buyerCount = document.createElement("strong");
    buyerCount.textContent = row.buyerCount.toLocaleString();
    buyerCell.append(buyerCount);

    const providerCell = document.createElement("div");
    providerCell.className = "demand-gap-number";
    providerCell.setAttribute("role", "cell");
    providerCell.dataset.label = "Active providers";
    const providerCount = document.createElement("strong");
    providerCount.textContent = row.providerCount.toLocaleString();
    providerCell.append(providerCount);

    const actionCell = document.createElement("div");
    actionCell.className = "demand-gap-action";
    actionCell.setAttribute("role", "cell");
    const priority = document.createElement("span");
    priority.className = "demand-gap-priority";
    priority.textContent = row.priority;
    const recommendation = document.createElement("p");
    if (row.gap) {
      recommendation.textContent = `Short by ${row.gap} ${row.gap === 1 ? "provider" : "providers"} based on current buyer interest.`;
    } else if (row.buyerCount) {
      recommendation.textContent = "No recruitment needed right now.";
    } else {
      recommendation.textContent = "Wait for buyer requests before recruiting.";
    }
    actionCell.append(priority, recommendation);
    item.append(categoryCell, buyerCell, providerCell, actionCell);
    list.append(item);
  }
}

async function refreshAdminDemandGaps() {
  const button = document.querySelector("#demand-gap-refresh");
  const status = document.querySelector("#demand-gap-status");
  const notice = document.querySelector("#demand-gap-error");
  button.disabled = true;
  notice.hidden = true;
  status.textContent = "Loading live buyer requests and active providers…";
  try {
    const [requests, services] = await Promise.all([
      fetchAllAdminRows(adminClient.from("campus_requests")
        .select("id, category, requester_id")
        .eq("status", "open")
        .gt("expires_at", new Date().toISOString())
        .order("id", { ascending: true })),
      fetchAllAdminRows(adminClient.from("services")
        .select("id, category, provider_id")
        .eq("is_active", true)
        .order("id", { ascending: true })),
    ]);
    const rows = buildAdminDemandGapRows(requests, services);
    renderAdminDemandGaps(rows);
  } catch (error) {
    console.error("Could not load live marketplace demand gaps.", error);
    document.querySelector("#demand-gap-rows").replaceChildren();
    document.querySelector("#demand-gap-focus-count").textContent = "—";
    document.querySelector("#demand-gap-request-count").textContent = "—";
    document.querySelector("#demand-gap-category-count").textContent = "—";
    document.querySelector("#demand-gap-updated").textContent = "Live marketplace data could not be refreshed.";
    status.textContent = "Demand-gap data is unavailable.";
    notice.hidden = false;
    notice.textContent = ["42P01", "PGRST205", "PGRST200"].includes(error.code)
      ? "The buyer-request table is unavailable. Apply supabase/migrations/20261106100000_marketplace_growth.sql, then refresh."
      : "Could not load live buyer requests and active providers. Check administrator access and your Supabase connection, then refresh.";
  } finally {
    button.disabled = false;
  }
}

async function refreshAdminNotificationBadge() {
  const userId = window.adminProfile?.id;
  if (!userId) return;
  const { count, error } = await adminClient.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) {
    console.error("Could not load the administrator notification count.", error);
    return;
  }
  updateAdminNotificationBadge(count || 0);
}

async function refreshAdminSystemStatus() {
  const status = document.querySelector("#system-status");
  const label = status.querySelector("span");
  const authStatus = document.querySelector("#auth-service-status");
  const databaseStatus = document.querySelector("#database-service-status");
  const configurationStatus = document.querySelector("#configuration-service-status");
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const result = await response.json();
    const authReady = result.services?.auth === "ok";
    const databaseReady = result.services?.database === "ok";
    authStatus.textContent = authReady ? "Operational" : "Unavailable";
    databaseStatus.textContent = databaseReady ? "Operational" : "Unavailable";
    configurationStatus.textContent = result.supabaseConfigured ? "Configured" : "Not configured";
    if (response.ok && result.status === "ok" && authReady && databaseReady) {
      status.dataset.status = "ok";
      label.textContent = "All systems operational";
      return;
    }
    status.dataset.status = "degraded";
    const unavailable = [
      !authReady && "authentication",
      !databaseReady && "database",
      !result.supabaseConfigured && "Supabase configuration",
    ].filter(Boolean);
    label.textContent = unavailable.length
      ? `Service issue: ${unavailable.join(" and ")} unavailable`
      : "Some services are unavailable";
  } catch (error) {
    console.error("Could not check Skill Flex system status.", error);
    status.dataset.status = "unavailable";
    label.textContent = "System status unavailable";
    authStatus.textContent = "Unavailable";
    databaseStatus.textContent = "Unavailable";
    configurationStatus.textContent = "Could not verify";
  }
}

function formatOperationsBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let scaled = bytes;
  let unitIndex = -1;
  do {
    scaled /= 1024;
    unitIndex += 1;
  } while (scaled >= 1024 && unitIndex < units.length - 1);
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function renderOperationsMeter(id, usage, limit, valueId, labelId) {
  const meter = document.querySelector(`#${id}`);
  const value = document.querySelector(`#${valueId}`);
  const label = document.querySelector(`#${labelId}`);
  const numericUsage = Number(usage);
  const numericLimit = Number(limit);
  value.textContent = formatOperationsBytes(numericUsage);
  if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
    label.textContent = "Plan quota not configured";
    meter.hidden = true;
    return;
  }
  const percentage = Math.max(0, numericUsage / numericLimit * 100);
  label.textContent = `${percentage.toFixed(1)}% of configured ${formatOperationsBytes(numericLimit)} limit`;
  meter.hidden = false;
  meter.setAttribute("aria-label", `${percentage.toFixed(1)} percent of configured quota used`);
  meter.querySelector("span").style.width = `${Math.min(100, percentage)}%`;
  meter.dataset.status = percentage >= 95 ? "critical" : percentage >= 80 ? "warning" : "ok";
}

function renderOperationsAlerts(analysis) {
  const container = document.querySelector("#operations-alerts");
  container.replaceChildren();
  const alerts = analysis.alerts || [];
  if (!alerts.length) {
    const message = document.createElement("p");
    message.textContent = analysis.sampleCount < 3
      ? "No active capacity alert. At least 3 samples are needed before trend forecasts are available."
      : "No configured capacity threshold is currently forecast to be crossed.";
    container.append(message);
    return;
  }
  for (const alert of alerts) {
    const item = document.createElement("p");
    item.className = "operations-alert";
    item.dataset.severity = alert.severity;
    item.textContent = `${alert.severity === "critical" ? "Critical" : "Warning"} · ${alert.message}`;
    container.append(item);
  }
}

function renderOperationsHistory(samples) {
  const body = document.querySelector("#operations-history");
  body.replaceChildren();
  const recent = [...samples].sort((a, b) => Date.parse(b.sampled_at) - Date.parse(a.sampled_at)).slice(0, 12);
  if (!recent.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.textContent = "No telemetry yet. Start the collector to record samples.";
    return;
  }
  for (const sample of recent) {
    const row = body.insertRow();
    row.insertCell().textContent = new Date(sample.sampled_at).toLocaleString();
    row.insertCell().textContent = formatOperationsBytes(sample.database_bytes);
    row.insertCell().textContent = formatOperationsBytes(sample.storage_bytes);
    row.insertCell().textContent = `${sample.active_connections} / ${sample.max_connections}`;
    row.insertCell().textContent = `Auth ${sample.auth_ok ? "OK" : "FAIL"} · DB ${sample.database_ok ? "OK" : "FAIL"}`;
  }
}

async function refreshAdminOperations() {
  const button = document.querySelector("#operations-refresh");
  const updated = document.querySelector("#operations-updated");
  const activityView = document.querySelector("#activity");
  if (!activityView || activityView.hidden || document.visibilityState === "hidden") return;
  if (button) button.disabled = true;
  updated.textContent = "Loading database telemetry…";
  try {
    const response = await fetch("/api/admin-observability", { cache: "no-store", credentials: "same-origin" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Telemetry request failed (${response.status}).`);
    const analysis = result.analysis;
    const current = analysis?.current;
    if (!current) {
      updated.textContent = "No telemetry samples yet. Apply the system telemetry migration and schedule its collector.";
      renderOperationsAlerts({ alerts: [], sampleCount: 0 });
      renderOperationsHistory([]);
      return;
    }

    renderOperationsMeter(
      "operations-database-meter",
      current.database_bytes,
      result.limits?.databaseBytes,
      "operations-database-usage",
      "operations-database-limit",
    );
    renderOperationsMeter(
      "operations-storage-meter",
      current.storage_bytes,
      result.limits?.storageBytes,
      "operations-storage-usage",
      "operations-storage-limit",
    );
    document.querySelector("#operations-connections").textContent =
      `${current.active_connections} / ${current.max_connections}`;
    document.querySelector("#operations-sample-window").textContent = analysis.sampleCount >= 3
      ? `${analysis.sampleCount} samples · ${analysis.windowHours.toFixed(1)}h`
      : `Insufficient history · ${analysis.sampleCount}/3`;
    updated.textContent = `Latest sample ${new Date(current.sampled_at).toLocaleString()} · Auth ${current.auth_ok ? "OK" : "FAIL"} (${current.auth_probe_ms}ms) · DB ${current.database_ok ? "OK" : "FAIL"} (${current.database_probe_ms}ms)`;
    renderOperationsAlerts(analysis);
    renderOperationsHistory(result.samples || []);
  } catch (error) {
    console.error("Could not load capacity and failure signals.", error);
    updated.textContent = error.message || "System telemetry is temporarily unavailable.";
    const alert = document.createElement("p");
    alert.className = "operations-alert";
    alert.dataset.severity = "warning";
    alert.textContent = "Check that the telemetry migration is applied, the server role key is configured, and the five-minute collector is scheduled.";
    document.querySelector("#operations-alerts").replaceChildren(alert);
  } finally {
    if (button) button.disabled = false;
  }
}

let supportTicketsRequest = 0;
async function fetchSupportTickets() {
  const requestId = ++supportTicketsRequest;
  const status = document.querySelector("#support-queue-status");
  const rows = document.querySelector("#support-ticket-rows");
  status.textContent = "Loading support tickets…";
  updateAdminNavCount("support-tickets", null);
  try {
    const { data, error, count } = await adminClient.from("support_tickets")
      .select("id, user_id, category, message, status, screenshot_url, created_at", { count: "exact" })
      .in("status", ["open", "reviewing"]).order("created_at", { ascending: true }).limit(50);
    if (requestId !== supportTicketsRequest) return;
    if (error) throw error;
    updateAdminNavCount("support-tickets", count);
    rows.replaceChildren();
    for (const ticket of data || []) {
      const article = document.createElement("article");
      article.className = "admin-report-row";
      article.innerHTML = `<div><strong>${escapeAdminText(ticket.category)}</strong><small>${escapeAdminText(ticket.user_id)} · ${escapeAdminText(formatAdminDate(ticket.created_at))} · ${escapeAdminText(ticket.status)}</small><p class="support-ticket-message">${escapeAdminText(ticket.message)}</p></div><span class="report-actions"></span>`;
      const actions = article.querySelector(".report-actions");
      if (ticket.screenshot_url) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "review-button";
        button.textContent = "View screenshot";
        button.addEventListener("click", async () => {
          button.disabled = true;
          try {
            const { data: signed, error: signError } = await adminClient.storage
              .from("support-screenshots").createSignedUrl(ticket.screenshot_url, 300);
            if (signError) throw signError;
            const link = document.createElement("a");
            link.href = signed.signedUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Open screenshot (expires in 5 minutes)";
            button.replaceWith(link);
          } catch (error) {
            console.error("Could not open support screenshot.", error);
            showAdminToast("Could not open the screenshot. Try again.");
            button.disabled = false;
          }
        });
        actions.append(button);
      }
      for (const [value, label] of [["reviewing", "Review"], ["resolved", "Resolve"], ["dismissed", "Dismiss"]]) {
        if (value === ticket.status) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "review-button";
        button.textContent = label;
        button.addEventListener("click", async () => {
          const controls = [...actions.querySelectorAll("button")];
          controls.forEach((control) => { control.disabled = true; });
          try {
            const { data: updated, error: updateError } = await adminClient.from("support_tickets")
              .update({ status: value }).eq("id", ticket.id).eq("status", ticket.status).select("id");
            if (updateError) throw updateError;
            if (!updated?.length) throw new Error("The ticket changed. Refresh the queue.");
            showAdminToast("Support ticket updated.");
            await fetchSupportTickets();
          } catch (error) {
            console.error("Could not update support ticket.", error);
            showAdminToast("Could not update the ticket. Refresh and try again.");
            controls.forEach((control) => { control.disabled = false; });
          }
        });
        actions.append(button);
      }
      rows.append(article);
    }
    status.textContent = data?.length ? `${data.length} oldest active tickets (up to 50 shown).` : "No active support tickets.";
  } catch (error) {
    rows.replaceChildren();
    updateAdminNavCount("support-tickets", null);
    console.error("Could not load support tickets.", error);
    status.textContent = ["PGRST205", "42P01"].includes(error.code)
      ? "Support tickets require the settings and support database migration."
      : "Could not load support tickets. Refresh to try again.";
    if (!rows.children.length) window.skillflexLoading.showError(rows, { message: status.textContent, onRetry: fetchSupportTickets });
  }
}

async function fetchModerationHistory() {
  const status = document.querySelector("#moderation-history-status");
  const list = document.querySelector("#moderation-history");
  status.textContent = "Loading moderation history…";
  list.replaceChildren();
  try {
    const { data, error } = await adminClient.from("moderation_actions")
      .select("id, action_type, reason, message, moderation_until, auth_ban_applied, created_at, reported_user_id, report_id, reported:profiles!moderation_actions_reported_user_id_fkey(full_name, moderation_status), administrator:profiles!moderation_actions_admin_id_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(25);
    if (error) throw error;

    for (const action of data || []) {
      const row = document.createElement("article");
      row.className = "moderation-history-row";
      const summary = document.createElement("div");
      const heading = document.createElement("strong");
      const target = action.reported?.full_name || "Student account";
      heading.textContent = `${action.action_type[0].toUpperCase()}${action.action_type.slice(1)} · ${target}`;
      const details = document.createElement("small");
      details.textContent = `${formatAdminDate(action.created_at)} · ${action.administrator?.full_name || "Administrator"}${action.moderation_until ? ` · until ${new Date(action.moderation_until).toLocaleString()}` : ""}`;
      const reason = document.createElement("p");
      reason.textContent = action.reason;
      const message = document.createElement("p");
      message.textContent = `Message sent: ${action.message}`;
      summary.append(heading, details, reason, message);
      row.append(summary);

      if (["suspended", "banned"].includes(action.reported?.moderation_status)
        || (action.action_type === "restore" && action.auth_ban_applied === false)) {
        const restore = document.createElement("button");
        restore.type = "button";
        restore.className = "review-button";
        restore.textContent = action.action_type === "restore" ? "Retry restore" : "Restore account";
        restore.dataset.restoreUserId = action.reported_user_id;
        restore.dataset.restoreUserName = target;
        row.append(restore);
      } else if (action.auth_ban_applied === false
        && ["suspension", "ban"].includes(action.action_type)) {
        const warning = document.createElement("small");
        warning.className = "moderation-history-warning";
        warning.textContent = "Skillmate access is restricted, but the Supabase sign-in block was not confirmed.";
        row.append(warning);
      }
      list.append(row);
    }
    status.textContent = data?.length ? `${data.length} most recent moderation actions.` : "No moderation actions yet.";
  } catch (error) {
    console.error("Could not load moderation history.", error);
    status.textContent = ["42P01", "PGRST205", "PGRST200", "PGRST202"].includes(error.code)
      ? "Moderation history requires supabase/migrations/20261108180000_admin_moderation.sql. Apply it, then refresh."
      : "Could not load moderation history. Refresh to try again.";
  }
}

document.querySelector("#support-queue-refresh").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await fetchSupportTickets(); } finally { button.disabled = false; }
});

async function fetchAdminDashboard() {
  const ninetyDaysAgo = new Date();
  const activityStart = new Date();
  activityStart.setDate(activityStart.getDate() - 180);
  const [students, services, bookingsCount, groups, bookings, verifications, reports, pendingBookings, verifiedStudents, reportRows, activityBookings, activityStudents] = await Promise.all([
    adminClient.from("profiles").select("id", { count: "exact", head: true }),
    adminClient.from("services").select("provider_id, category").eq("is_active", true),
    adminClient.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    adminClient.from("group_bookings").select("id", { count: "exact", head: true }),
    adminClient.from("bookings")
      .select("id, created_at, scheduled_at, status, agreed_price, currency, customer:profiles!bookings_customer_id_fkey(full_name), provider:profiles!bookings_provider_id_fkey(full_name), service:services(title), group_booking_id")
      .order("created_at", { ascending: false }).limit(25),
    adminClient.from("verification_requests")
      .select("id, university_email, id_photo_path, created_at, profile:profiles!verification_requests_student_id_fkey(id, full_name, university)")
      .eq("status", "open").order("created_at", { ascending: true }),
    adminClient.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    adminClient.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("campus_verified", true),
    adminClient.from("reports")
      .select("*, reporter:profiles!reports_reporter_id_fkey(full_name), reported:profiles!reports_reported_user_id_fkey(full_name)")
      .eq("status", "open").order("created_at", { ascending: false }).limit(10),
    adminClient.from("bookings").select("created_at").gte("created_at", activityStart.toISOString()),
    adminClient.from("profiles").select("created_at").gte("created_at", activityStart.toISOString()),
  ]);
  for (const result of [students, services, bookingsCount, groups, bookings, verifications, reports, pendingBookings, verifiedStudents, reportRows, activityBookings, activityStudents]) {
    if (result.error) throw result.error;
  }

  let awaitingVerificationCount = 0;
  let completionVerificationAvailable = true;
  const completionNotice = document.querySelector("#booking-completion-migration-notice");
  completionNotice.hidden = true;
  try {
    const result = await adminClient.from("bookings").select("id", { count: "exact" })
      .eq("status", "confirmed").not("provider_completed_at", "is", null).limit(1);
    if (result.error) throw result.error;
    awaitingVerificationCount = result.count || 0;
  } catch (error) {
    completionVerificationAvailable = false;
    const missingMigration = ["42703", "PGRST204"].includes(error.code)
      && String(error.message || "").includes("provider_completed_at");
    console.error("Could not load bookings awaiting client verification.", error);
    completionNotice.hidden = false;
    completionNotice.textContent = missingMigration
      ? "Client-confirmation counts are unavailable because the database is missing provider_completed_at. Apply supabase/migrations/20261107120000_client_completion_verification.sql, then reload this dashboard."
      : "Could not load the number of bookings awaiting client confirmation. The related attention badges are hidden until the count is available.";
  }

  const statValues = document.querySelectorAll(".stats-grid .stat-value");
  [students.count, new Set((services.data || []).map((row) => row.provider_id)).size, bookingsCount.count, groups.count]
    .forEach((value, index) => { statValues[index].textContent = Number(value || 0).toLocaleString(); });
  const verificationCount = verifications.data?.length || 0;
  const openReportCount = reports.count || 0;
  const pendingBookingCount = pendingBookings.count || 0;
  updateAdminNavCount("bookings", completionVerificationAvailable ? pendingBookingCount + awaitingVerificationCount : null);
  updateAdminNavCount("students", completionVerificationAvailable
    ? verificationCount + openReportCount + pendingBookingCount + awaitingVerificationCount
    : null);
  updateAdminNavCount("verification", verificationCount);
  updateAdminNavCount("safety", openReportCount);
  const demoPill = document.querySelector(".welcome-row .demo-pill");
  if (demoPill) demoPill.textContent = "LIVE DATA";
  const adminDate = document.querySelector("#admin-date");
  if (adminDate) {
    if (!adminDate.firstChild) adminDate.append(document.createTextNode(""));
    adminDate.firstChild.textContent = new Date().toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  }
  const overviewTitle = document.querySelector(".welcome-row h1");
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = String(window.adminProfile?.full_name || "Admin").trim().split(/\s+/)[0] || "Admin";
  if (overviewTitle) overviewTitle.textContent = `${timeOfDay}, ${firstName}`;
  const profileName = document.querySelector(".profile-copy strong");
  if (profileName) profileName.textContent = window.adminProfile.full_name;
  const profileAvatar = document.querySelector(".profile-avatar");
  if (profileAvatar) profileAvatar.textContent = initials(window.adminProfile.full_name);
  const rows = bookings.data || [];
  document.querySelector("#booking-rows").innerHTML = rows.length ? rows.map((booking) => {
    const customer = booking.customer?.full_name || "Student account";
    const provider = booking.provider?.full_name || "Provider";
    const service = booking.service?.title || "Service";
    const status = booking.status || "pending";
    const statusClass = ["confirmed", "pending", "completed", "declined", "cancelled"].includes(status) ? status : "pending";
    const type = booking.group_booking_id ? "group booking group" : "individual booking";
    const search = [customer, provider, service, status, type, booking.scheduled_at].join(" ").toLocaleLowerCase();
    return `<tr data-search="${escapeAdminText(search)}"><td><span class="person"><span class="person-avatar avatar-blue">${escapeAdminText(initials(customer))}</span><span><strong>${escapeAdminText(customer)}</strong><small>Booking customer</small></span></span></td><td><span class="service-cell"><strong>${escapeAdminText(service)}</strong><small>${escapeAdminText(provider)}</small></span></td><td><span class="date-cell">${escapeAdminText(formatAdminDate(booking.scheduled_at))}<small>${booking.group_booking_id ? "Group booking" : "Individual"}</small></span></td><td><span class="booking-type">${booking.group_booking_id ? "Group" : "Individual"}</span></td><td><span class="status status-${statusClass}"><i></i>${escapeAdminText(status[0].toUpperCase() + status.slice(1))}</span></td></tr>`;
  }).join("") : "";
  document.querySelector("#empty-state").hidden = rows.length > 0;
  document.querySelector(".bookings-panel .panel-heading p").textContent = `${rows.length} most recent bookings`;
  window.applyAdminBookingSearch?.();

  const categories = new Map();
  for (const service of services.data || []) categories.set(service.category, (categories.get(service.category) || 0) + 1);
  document.querySelector("#service-category-rows").innerHTML = categories.size
    ? [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, count]) =>
      `<div class="popular-service"><span class="service-icon service-design">${escapeAdminText(category.slice(0, 1).toUpperCase())}</span><span class="popular-copy"><strong>${escapeAdminText(category)}</strong><small>${count} active ${count === 1 ? "listing" : "listings"}</small></span></div>`).join("")
    : '<p class="empty-state">No active service listings yet.</p>';

  const verificationPanel = document.querySelector(".verification-panel");
  const requests = verifications.data || [];
  verificationPanel.querySelector(".queue-count").textContent = `${requests.length} pending`;
  verificationPanel.querySelectorAll(".verification-row").forEach((row) => row.remove());
  const queueLink = verificationPanel.querySelector(".text-link");
  verificationPanel.querySelector(".empty-state").hidden = requests.length > 0;
  requests.forEach((request) => {
    const profile = request.profile || {};
    const row = document.createElement("div");
    row.className = "verification-row";
    row.innerHTML = `<span class="person-avatar avatar-sky">${escapeAdminText(initials(profile.full_name))}</span><span class="verification-copy"><strong>${escapeAdminText(profile.full_name || "Student")}</strong><small>${escapeAdminText(profile.university || "University not provided")}</small></span><span class="verified-doc">${escapeAdminText(request.university_email)}</span><button class="review-button" type="button" data-verification-id="${escapeAdminText(request.id)}" data-verification-photo="${escapeAdminText(request.id_photo_path || "")}" data-verification-student="${escapeAdminText(profile.full_name || "Student")}">Review ID</button>`;
    verificationPanel.insertBefore(row, queueLink);
  });
  const attention = document.querySelectorAll(".attention-item .attention-copy small");
  if (attention[0]) attention[0].textContent = `${requests.length} profiles waiting for review`;
  if (attention[1]) attention[1].textContent = `${openReportCount} open community reports`;
  if (attention[2]) {
    const bookingTasks = [];
    if (pendingBookingCount) bookingTasks.push(`${pendingBookingCount} pending booking requests`);
    if (completionVerificationAvailable && awaitingVerificationCount) {
      bookingTasks.push(`${awaitingVerificationCount} awaiting client verification`);
    }
    attention[2].textContent = !completionVerificationAvailable
      ? "Client-confirmation count unavailable; check the notice in Bookings"
      : bookingTasks.length ? bookingTasks.join(" · ") : "No booking requests need review";
  }
  document.querySelector(".attention-total").textContent = completionVerificationAvailable
    ? String(verificationCount + openReportCount + pendingBookingCount + awaitingVerificationCount)
    : "—";
  const verifiedRate = students.count ? Math.round((verifiedStudents.count || 0) / students.count * 100) : 0;
  document.querySelector("#verified-rate").textContent = String(verifiedRate);
  document.querySelector("#verified-progress").style.width = `${verifiedRate}%`;
  document.querySelector("#open-reports").textContent = String(openReportCount);
  const reportList = document.querySelector("#report-rows");
  reportList.innerHTML = reportRows.data?.length ? reportRows.data.map((report) =>
    `<article class="admin-report-row"><div><strong>${escapeAdminText(report.reason)}</strong><small>${escapeAdminText(report.reporter?.full_name || "Student")} reported ${escapeAdminText(report.reported?.full_name || "a student")} · ${escapeAdminText(formatAdminDate(report.created_at))}</small><p>${escapeAdminText(report.details)}</p></div><span class="report-actions">${report.campus_request_id ? `<button class="review-button" type="button" data-remove-campus-request="${escapeAdminText(report.campus_request_id)}">Remove request</button>` : ""}<button class="review-button" type="button" data-open-moderation data-report-id="${escapeAdminText(report.id)}" data-reported-user-id="${escapeAdminText(report.reported_user_id)}" data-reported-user-name="${escapeAdminText(report.reported?.full_name || "Student")}">Take action</button><button class="review-button" type="button" data-report-action="resolved" data-report-id="${escapeAdminText(report.id)}">Resolve</button><button class="review-button" type="button" data-report-action="dismissed" data-report-id="${escapeAdminText(report.id)}">Dismiss</button></span></article>`).join("")
    : '<p class="empty-state">No open safety reports.</p>';
  await fetchModerationHistory();
  window.adminActivity = {
    bookings: activityBookings.data || [],
    students: activityStudents.data || [],
  };
  updateAdminChart(Number(document.querySelector("#period-select").value));
  await fetchSupportTickets();

}

function updateAdminChart(days) {
  const activity = window.adminActivity;
  if (!activity) return;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const countBins = (rows) => {
    const values = Array(6).fill(0);
    rows.forEach((row) => {
      const date = new Date(row.created_at);
      if (date < start) return;
      const offset = Math.floor((date - start) / 86400000);
      const index = Math.min(5, Math.floor(offset / days * 6));
      values[index] += 1;
    });
    return values;
  };
  const bookings = countBins(activity.bookings);
  const students = countBins(activity.students);
  const maxCount = Math.max(0, ...bookings, ...students);
  const chartMaximum = Math.max(4, Math.ceil(maxCount / 4) * 4);
  document.querySelectorAll(".chart-y-labels span").forEach((label, index) => {
    label.textContent = (chartMaximum - index * chartMaximum / 4).toLocaleString();
  });
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - days);
  const countSince = (rows, from, to) => rows.filter((row) => {
    const date = new Date(row.created_at);
    return date >= from && date < to;
  }).length;
  const currentBookings = countSince(activity.bookings, start, new Date());
  const previousBookings = countSince(activity.bookings, previousStart, start);
  const change = previousBookings
    ? `${currentBookings >= previousBookings ? "+" : ""}${((currentBookings - previousBookings) / previousBookings * 100).toFixed(1)}%`
    : currentBookings ? "New" : "0%";
  document.querySelector("#activity-change").textContent = change;
  const line = (values) => values
    .map((value, index) => `${index ? "L" : "M"}${index * 140} ${180 - value / chartMaximum * 160}`)
    .join(" ");
  const bookingPath = line(bookings);
  const studentPath = line(students);
  document.querySelector(".chart-line-bookings").setAttribute("d", bookingPath);
  document.querySelector(".chart-line-students").setAttribute("d", studentPath);
  document.querySelector(".chart-area-fill").setAttribute("d", `${bookingPath} L700 190 H0Z`);
  const points = [
    [".point-bookings", bookings[5]], [".point-students", students[5]],
  ];
  points.forEach(([selector, value]) => {
    document.querySelector(selector).setAttribute("cy", String(180 - value / chartMaximum * 160));
  });
  document.querySelectorAll("#chart-x-labels span").forEach((label, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + Math.floor(index * (days - 1) / 5));
    label.textContent = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  document.querySelector("#period-comparison").textContent = `${currentBookings} bookings · ${countSince(activity.students, start, new Date())} new students`;
}

async function protectAdminDashboard() {
  if (!adminClient) {
    showAdminGate(window.skillflexSupabaseError
      ? `Admin access is locked. ${window.skillflexSupabaseError}`
      : "Admin access is locked. Configure the Supabase Project URL and public key in the server environment.", true);
    return;
  }
  try {
    adminStatus.textContent = "Checking your sign-in session…";
    const { data: sessionData, error: sessionError } = await withAdminTimeout(
      adminClient.auth.getSession(),
      "Checking your sign-in session timed out. Check your connection and try again.",
    );
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      window.location.replace("login.html?next=admin");
      return;
    }
    adminStatus.textContent = "Securing your session…";
    await withAdminTimeout(
      window.syncSkillflexServerSession(sessionData.session),
      "Securing your session timed out. Check your connection and try again.",
    );
    adminStatus.textContent = "Verifying administrator role…";
    const { data: profile, error: profileError } = await withAdminTimeout(
      adminClient.from("profiles").select("id, full_name, role").eq("id", sessionData.session.user.id).single(),
      "Verifying your administrator role timed out. Check your connection and try again.",
    );
    if (profileError) throw profileError;
    if (profile.role !== "admin") {
      window.location.replace("index.html");
      return;
    }
    window.adminProfile = profile;
    adminStatus.textContent = "Loading administrator dashboard…";
    await withAdminTimeout(
      fetchAdminDashboard(),
      "Loading administrator data timed out. Check your Supabase connection and try again.",
      30000,
    );
    document.body.classList.remove("admin-locked");
    document.body.classList.add("admin-ready");
    adminStatus.hidden = true;
    refreshAdminNotificationBadge();
    document.querySelector("#demand-gap-refresh").addEventListener("click", refreshAdminDemandGaps);
    refreshAdminDemandGaps();
    refreshAdminSystemStatus();
    window.setInterval(refreshAdminSystemStatus, 60000);
    refreshAdminOperations();
    window.setInterval(refreshAdminOperations, 300000);
    document.querySelector("#operations-refresh")?.addEventListener("click", refreshAdminOperations);
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#activity") refreshAdminOperations();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && window.location.hash === "#activity") {
        refreshAdminOperations();
      }
    });
    const studentDashboardLink = document.createElement("a");
    studentDashboardLink.href = "index.html";
    studentDashboardLink.className = "student-dashboard-link";
    studentDashboardLink.textContent = "Student dashboard";
    const signout = document.createElement("button");
    signout.type = "button";
    signout.className = "admin-signout-button";
    signout.textContent = "Sign out";
    signout.addEventListener("click", async () => {
      signout.disabled = true;
      try {
        await window.skillflexSignOut();
        window.location.replace("/");
      } catch (error) {
        console.error("Could not sign out.", error);
        showAdminToast(error.message || "Could not sign out.");
        signout.disabled = false;
      }
    });
    document.querySelector(".sidebar-bottom").prepend(studentDashboardLink, signout);
    const notificationsDialog = document.querySelector("#admin-notifications-dialog");
    const notificationsList = document.querySelector("#admin-notifications-list");
    const notificationsStatus = document.querySelector("#admin-notifications-status");
    document.querySelector(".notification-button").addEventListener("click", async () => {
      notificationsDialog.showModal();
      notificationsList.replaceChildren();
      notificationsStatus.textContent = "Loading notifications…";
      const { data, error } = await adminClient.from("notifications")
        .select("id, title, body, read_at, created_at")
        .eq("user_id", window.adminProfile.id)
        .order("created_at", { ascending: false }).limit(10);
      if (error) {
        console.error("Could not load administrator notifications.", error);
        notificationsStatus.textContent = "Could not load notifications. Please try again.";
        return;
      }
      if (!data?.length) {
        notificationsStatus.textContent = "No notifications yet.";
        updateAdminNotificationBadge(0);
        return;
      }
      notificationsStatus.textContent = "Your 10 most recent notifications.";
      let unreadCount = 0;
      for (const notification of data) {
        const item = document.createElement("li");
        item.className = "admin-notification-item";
        const title = document.createElement("strong");
        title.textContent = notification.title;
        const body = document.createElement("p");
        body.textContent = notification.body || "";
        const time = document.createElement("time");
        time.dateTime = notification.created_at;
        time.textContent = new Date(notification.created_at).toLocaleString();
        item.append(title, body, time);
        if (!notification.read_at) {
          unreadCount += 1;
          const markRead = document.createElement("button");
          markRead.type = "button";
          markRead.className = "button button-outline button-small";
          markRead.textContent = "Mark as read";
          markRead.addEventListener("click", async () => {
            markRead.disabled = true;
            const readAt = new Date().toISOString();
            const { data: updatedRows, error: updateError } = await adminClient.from("notifications")
              .update({ read_at: readAt }).eq("id", notification.id).eq("user_id", window.adminProfile.id).select("id");
            if (updateError || !updatedRows?.length) {
              console.error("Could not mark the administrator notification as read.", updateError || new Error("No notification row was updated."));
              showAdminToast("Could not mark notification as read. Refresh and try again.");
              markRead.disabled = false;
              return;
            }
            notification.read_at = readAt;
            markRead.remove();
            unreadCount -= 1;
            updateAdminNotificationBadge(unreadCount);
          });
          item.append(markRead);
        }
        notificationsList.append(item);
      }
      updateAdminNotificationBadge(unreadCount);
    });
    document.querySelector("[data-close-admin-notifications]").addEventListener("click", () => {
      notificationsDialog.close();
    });
    const verificationDialog = document.querySelector("#verification-review-dialog");
    const verificationImage = document.querySelector("#verification-review-image");
    const verificationStatus = document.querySelector("#verification-review-status");
    const approveButton = document.querySelector("#verification-approve");
    const rejectButton = document.querySelector("#verification-reject");
    verificationDialog.addEventListener("close", () => {
      verificationDialog.dataset.requestId = "";
      verificationDialog.dataset.photoPath = "";
      verificationImage.hidden = true;
      verificationImage.removeAttribute("src");
    });
    document.querySelector(".verification-panel").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-verification-id]");
      if (!button) return;
      verificationDialog.dataset.requestId = button.dataset.verificationId;
      verificationDialog.dataset.photoPath = button.dataset.verificationPhoto || "";
      document.querySelector("#verification-review-student").textContent = button.dataset.verificationStudent;
      verificationImage.hidden = true;
      verificationImage.removeAttribute("src");
      approveButton.disabled = true;
      rejectButton.disabled = false;
      verificationDialog.showModal();
      if (!verificationDialog.dataset.photoPath) {
        verificationStatus.textContent = "This request has no ID photo. It cannot be approved.";
        return;
      }
      verificationStatus.textContent = "Loading the private ID photo…";
      try {
        const { data, error } = await adminClient.storage.from("student-verification-ids")
          .createSignedUrl(verificationDialog.dataset.photoPath, 300);
        if (error) throw error;
        if (verificationDialog.dataset.requestId !== button.dataset.verificationId) return;
        verificationImage.src = data.signedUrl;
        await verificationImage.decode();
        if (verificationDialog.dataset.requestId !== button.dataset.verificationId) return;
        verificationImage.hidden = false;
        verificationStatus.textContent = "Review the student ID, then approve or reject the request.";
        approveButton.disabled = false;
      } catch (error) {
        console.error("Could not load the private student ID photo.", error);
        verificationStatus.textContent = "The ID photo could not be loaded. Close this review and try again.";
        showAdminToast(error.message || "Could not load the ID photo.");
      }
    });
    document.querySelector(".verification-review-actions").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-verification-decision]");
      if (!button) return;
      const requestId = verificationDialog.dataset.requestId;
      const photoPath = verificationDialog.dataset.photoPath;
      const approve = button.dataset.verificationDecision === "approve";
      button.disabled = true;
      rejectButton.disabled = true;
      let reviewError;
      try {
        const result = await adminClient.rpc("review_verification_request", {
          p_request_id: requestId,
          p_approve: approve,
        });
        reviewError = result.error;
      } catch (error) {
        reviewError = error;
      }
      if (reviewError) {
        console.error("Could not review the verification request.", reviewError);
        showAdminToast(reviewError.message || "Could not update the verification request.");
        button.disabled = false;
        rejectButton.disabled = false;
        return;
      }
      let cleanupFailed = false;
      if (photoPath) {
        try {
          const { error: cleanupError } = await adminClient.storage.from("student-verification-ids").remove([photoPath]);
          if (cleanupError) throw cleanupError;
        } catch (cleanupError) {
          console.error("The verification request was reviewed, but its ID photo could not be deleted.", cleanupError);
          cleanupFailed = true;
        }
      }
      verificationDialog.close();
      verificationImage.removeAttribute("src");
      try {
        await fetchAdminDashboard();
        showAdminToast(cleanupFailed
          ? "Request reviewed, but the ID photo could not be deleted. Remove it from the private verification bucket."
          : approve ? "Student verified. The ID photo was deleted." : "Request rejected. The ID photo was deleted.");
      } catch (refreshError) {
        console.error("Could not refresh the administrator dashboard.", refreshError);
        showAdminToast(refreshError.message || "The request was saved, but the dashboard could not refresh.");
      }
    });
    const moderationDialog = document.querySelector("#moderation-dialog");
    const moderationForm = document.querySelector("#moderation-form");
    const moderationAction = document.querySelector("#moderation-action");
    const moderationReason = document.querySelector("#moderation-reason");
    const moderationMessage = document.querySelector("#moderation-message");
    const moderationStatus = document.querySelector("#moderation-status");
    const moderationSubmit = document.querySelector("#moderation-submit");
    function openModerationDialog({ reportId = "", userId, userName, restore = false }) {
      moderationDialog.dataset.reportId = reportId;
      moderationDialog.dataset.reportedUserId = userId;
      moderationDialog.dataset.restore = String(restore);
      document.querySelector("#moderation-subtitle").textContent = restore
        ? `Restore Skillmate access for ${userName}?`
        : `Report against ${userName}. Review the details before taking action.`;
      document.querySelector('label[for="moderation-action"]').hidden = restore;
      moderationAction.hidden = restore;
      moderationAction.value = "warning";
      moderationAction.disabled = restore;
      moderationReason.value = restore ? "Account access restored after administrator review." : "";
      moderationMessage.value = restore
        ? "Your Skillmate account access has been restored. Thank you for your patience."
        : "Please review Skillmate's community guidelines. If you believe this action was a mistake, contact support.";
      moderationStatus.textContent = "";
      moderationSubmit.disabled = false;
      moderationDialog.showModal();
    }
    moderationDialog.querySelectorAll("[data-close-moderation]").forEach((button) => {
      button.addEventListener("click", () => moderationDialog.close());
    });
    document.querySelector("#report-rows").addEventListener("click", async (event) => {
      const review = event.target.closest("[data-open-moderation]");
      if (review) {
        openModerationDialog({
          reportId: review.dataset.reportId,
          userId: review.dataset.reportedUserId,
          userName: review.dataset.reportedUserName,
        });
        return;
      }
      const remove = event.target.closest("[data-remove-campus-request]");
      if (remove) {
        remove.disabled = true;
        const result = await adminClient.rpc("close_campus_request", {p_request_id: remove.dataset.removeCampusRequest, p_remove: true});
        if (result.error) { showAdminToast(result.error.message || "Could not remove the request."); remove.disabled = false; }
        else { remove.textContent = "Request removed"; showAdminToast("Request removed. You can now resolve the report."); }
        return;
      }
      const button = event.target.closest("[data-report-action]");
      if (!button) return;
      button.disabled = true;
      const { data: updatedRows, error } = await adminClient.from("reports").update({
        status: button.dataset.reportAction,
        resolved_by: window.adminProfile.id,
        resolved_at: new Date().toISOString(),
      }).eq("id", button.dataset.reportId).select("id");
      if (error || !updatedRows?.length) {
        console.error("Could not update the safety report.", error || new Error("No safety report row was updated."));
        showAdminToast("Could not update the safety report. Refresh and try again.");
        button.disabled = false;
        return;
      }
      showAdminToast(button.dataset.reportAction === "resolved" ? "Safety report resolved." : "Safety report dismissed.");
      try {
        await fetchAdminDashboard();
      } catch (refreshError) {
        console.error("Could not refresh the administrator dashboard.", refreshError);
        showAdminToast(refreshError.message || "The report was updated, but the dashboard could not refresh.");
      }
    });
    document.querySelector("#moderation-history").addEventListener("click", (event) => {
      const restore = event.target.closest("[data-restore-user-id]");
      if (!restore) return;
      openModerationDialog({
        userId: restore.dataset.restoreUserId,
        userName: restore.dataset.restoreUserName,
        restore: true,
      });
    });
    moderationForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const action = moderationDialog.dataset.restore === "true" ? "restore" : moderationAction.value;
      if (action === "ban" && !window.confirm("Ban this account? The person will be notified, and only an administrator can restore access.")) {
        return;
      }
      moderationSubmit.disabled = true;
      moderationStatus.textContent = "Recording the official Skillmate Trust & Safety action…";
      try {
        const response = await fetch("/api/admin-moderation", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reportId: moderationDialog.dataset.reportId || null,
            action,
            reportedUserId: moderationDialog.dataset.reportedUserId,
            reason: moderationReason.value.trim(),
            message: moderationMessage.value.trim(),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (!result.actionApplied) {
            moderationStatus.textContent = result.error || "Could not apply this action. Review the report and try again.";
            moderationSubmit.disabled = false;
            return;
          }
          showAdminToast(result.error || "The in-app restriction is active, but the sign-in restriction needs administrator attention.");
        } else {
          showAdminToast(action === "restore"
            ? "Account restored and the person has been notified."
            : "Action recorded and the person has been notified by Skillmate.");
        }
        moderationDialog.close();
        moderationForm.reset();
        await fetchAdminDashboard();
      } catch (error) {
        console.error("Could not submit the moderation action.", error);
        moderationStatus.textContent = "Could not reach Skillmate. The action was not confirmed; check the report before retrying.";
        moderationSubmit.disabled = false;
      }
    });
  } catch (error) {
    console.error("Administrator access check failed.", error);
    if (error.status === 401) {
      await window.clearExpiredSkillmateSession();
      window.location.replace("login.html?next=admin");
      return;
    }
    showAdminGate(
      `Could not verify administrator access. ${error.message || "Check your Supabase connection, then try again."}`,
      false,
      true,
    );
  }
}

if (adminClient) {
  adminClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.clearSkillflexServerSession()
        .catch((sessionError) => console.error("Could not clear the secure Skill Flex session.", sessionError))
        .finally(() => window.location.replace("login.html?next=admin"));
    }
    if (event === "TOKEN_REFRESHED" && session) {
      window.syncSkillflexServerSession(session).catch((syncError) => {
        console.error("Could not refresh the secure Skill Flex session.", syncError);
      });
    }
  });
}

protectAdminDashboard();
