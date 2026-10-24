const adminClient = window.skillmateSupabase;
const adminStatus = document.querySelector("#admin-auth-status");

function showAdminGate(message, withLogin = false) {
  adminStatus.replaceChildren(document.createTextNode(message));
  if (withLogin) {
    const link = document.createElement("a");
    link.href = "login.html?next=admin";
    link.textContent = "Sign in as an administrator";
    adminStatus.append(link);
  }
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
      .select("id, university_email, created_at, profile:profiles!verification_requests_student_id_fkey(id, full_name, university)")
      .eq("status", "open").order("created_at", { ascending: true }),
    adminClient.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    adminClient.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
    adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("campus_verified", true),
    adminClient.from("reports")
      .select("id, reason, details, created_at, reporter:profiles!reports_reporter_id_fkey(full_name), reported:profiles!reports_reported_user_id_fkey(full_name)")
      .eq("status", "open").order("created_at", { ascending: false }).limit(10),
    adminClient.from("bookings").select("created_at").gte("created_at", activityStart.toISOString()),
    adminClient.from("profiles").select("created_at").gte("created_at", activityStart.toISOString()),
  ]);
  for (const result of [students, services, bookingsCount, groups, bookings, verifications, reports, pendingBookings, verifiedStudents, reportRows, activityBookings, activityStudents]) {
    if (result.error) throw result.error;
  }

  const statValues = document.querySelectorAll(".stats-grid .stat-value");
  [students.count, new Set((services.data || []).map((row) => row.provider_id)).size, bookingsCount.count, groups.count]
    .forEach((value, index) => { statValues[index].textContent = Number(value || 0).toLocaleString(); });
  document.querySelector(".nav-count").textContent = Number(bookingsCount.count || 0).toLocaleString();
  const needsAttention = Boolean(reports.count || verifications.data?.length);
  document.querySelector(".nav-dot").hidden = !needsAttention;
  document.querySelector(".nav-dot").style.display = needsAttention ? "" : "none";
  document.querySelector(".welcome-row .demo-pill").textContent = "LIVE DATA";
  document.querySelector("#admin-date").firstChild.textContent = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).toUpperCase() + " ";
  document.querySelector(".welcome-row h1").innerHTML = `Welcome, ${escapeAdminText(window.adminProfile.full_name)} <span aria-hidden="true">✦</span>`;
  document.querySelector(".profile-copy strong").textContent = window.adminProfile.full_name;
  document.querySelector(".profile-avatar").textContent = initials(window.adminProfile.full_name);
  document.querySelector(".topbar-avatar").textContent = initials(window.adminProfile.full_name);
  document.querySelector(".page-footer > span:last-child").lastChild.textContent = " Supabase account connected";

  const rows = bookings.data || [];
  document.querySelector("#booking-rows").innerHTML = rows.length ? rows.map((booking) => {
    const customer = booking.customer?.full_name || "Student account";
    const provider = booking.provider?.full_name || "Provider";
    const service = booking.service?.title || "Service";
    const status = booking.status || "pending";
    const statusClass = ["confirmed", "pending", "completed", "declined", "cancelled"].includes(status) ? status : "pending";
    const search = [customer, provider, service, status].join(" ").toLowerCase();
    return `<tr data-search="${escapeAdminText(search)}"><td><span class="person"><span class="person-avatar avatar-blue">${escapeAdminText(initials(customer))}</span><span><strong>${escapeAdminText(customer)}</strong><small>Booking customer</small></span></span></td><td><span class="service-cell"><strong>${escapeAdminText(service)}</strong><small>${escapeAdminText(provider)}</small></span></td><td><span class="date-cell">${escapeAdminText(formatAdminDate(booking.scheduled_at))}<small>${booking.group_booking_id ? "Group booking" : "Individual"}</small></span></td><td><span class="booking-type">${booking.group_booking_id ? "Group" : "Individual"}</span></td><td><span class="status status-${statusClass}"><i></i>${escapeAdminText(status[0].toUpperCase() + status.slice(1))}</span></td></tr>`;
  }).join("") : "";
  document.querySelector("#empty-state").hidden = rows.length > 0;
  document.querySelector("#empty-state").textContent = "No bookings match your search.";
  document.querySelector(".bookings-panel .panel-heading p").textContent = `${rows.length} most recent bookings`;

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
    row.innerHTML = `<span class="person-avatar avatar-sky">${escapeAdminText(initials(profile.full_name))}</span><span class="verification-copy"><strong>${escapeAdminText(profile.full_name || "Student")}</strong><small>${escapeAdminText(profile.university || "University not provided")}</small></span><span class="verified-doc">${escapeAdminText(request.university_email)}</span><button class="review-button" type="button" data-verification-id="${escapeAdminText(request.id)}">Review</button>`;
    verificationPanel.insertBefore(row, queueLink);
  });
  const attention = document.querySelectorAll(".attention-item .attention-copy small");
  if (attention[0]) attention[0].textContent = `${requests.length} profiles waiting for review`;
  if (attention[1]) attention[1].textContent = `${reports.count || 0} open community reports`;
  if (attention[2]) attention[2].textContent = `${pendingBookings.count || 0} pending booking requests`;
  document.querySelector(".attention-total").textContent = String(requests.length + (reports.count || 0) + (pendingBookings.count || 0));
  const verifiedRate = students.count ? Math.round((verifiedStudents.count || 0) / students.count * 100) : 0;
  document.querySelector("#verified-rate").textContent = String(verifiedRate);
  document.querySelector("#verified-progress").style.width = `${verifiedRate}%`;
  document.querySelector("#open-reports").textContent = String(reports.count || 0);
  const reportList = document.querySelector("#report-rows");
  reportList.innerHTML = reportRows.data?.length ? reportRows.data.map((report) =>
    `<article class="admin-report-row"><div><strong>${escapeAdminText(report.reason)}</strong><small>${escapeAdminText(report.reporter?.full_name || "Student")} reported ${escapeAdminText(report.reported?.full_name || "a student")} · ${escapeAdminText(formatAdminDate(report.created_at))}</small><p>${escapeAdminText(report.details)}</p></div><span class="report-actions"><button class="review-button" type="button" data-report-action="resolved" data-report-id="${escapeAdminText(report.id)}">Resolve</button><button class="review-button" type="button" data-report-action="dismissed" data-report-id="${escapeAdminText(report.id)}">Dismiss</button></span></article>`).join("")
    : '<p class="empty-state">No open safety reports.</p>';
  window.adminActivity = {
    bookings: activityBookings.data || [],
    students: activityStudents.data || [],
  };
  updateAdminChart(Number(document.querySelector("#period-select").value));

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
  const line = (values) => {
    const max = Math.max(1, ...values);
    return values.map((value, index) => `${index ? "L" : "M"}${index * 140} ${180 - value / max * 155}`).join(" ");
  };
  const bookingPath = line(bookings);
  const studentPath = line(students);
  document.querySelector(".chart-line-bookings").setAttribute("d", bookingPath);
  document.querySelector(".chart-line-students").setAttribute("d", studentPath);
  document.querySelector(".chart-area-fill").setAttribute("d", `${bookingPath} L700 190 H0Z`);
  const points = [
    [".point-bookings", bookings[5]], [".point-students", students[5]],
  ];
  points.forEach(([selector, value]) => {
    const max = Math.max(1, ...(selector.includes("bookings") ? bookings : students));
    document.querySelector(selector).setAttribute("cy", String(180 - value / max * 155));
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
    showAdminGate(window.skillmateSupabaseError
      ? `Admin access is locked. ${window.skillmateSupabaseError}`
      : "Admin access is locked. Configure the Supabase Project URL and public key in the server environment.", true);
    return;
  }
  try {
    const { data: sessionData, error: sessionError } = await adminClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      window.location.replace("login.html?next=admin");
      return;
    }
    await window.syncSkillmateServerSession(sessionData.session);
    const { data: profile, error: profileError } = await adminClient.from("profiles")
      .select("id, full_name, role").eq("id", sessionData.session.user.id).single();
    if (profileError) throw profileError;
    if (profile.role !== "admin") {
      window.location.replace("index.html");
      return;
    }
    window.adminProfile = profile;
    await fetchAdminDashboard();
    document.body.classList.remove("admin-locked");
    document.body.classList.add("admin-ready");
    adminStatus.hidden = true;
    const signout = document.createElement("button");
    signout.type = "button";
    signout.className = "signout-button";
    signout.textContent = "Sign out";
    signout.addEventListener("click", async () => {
      const { error } = await adminClient.auth.signOut();
      if (error) {
        console.error("Could not sign out.", error);
        showAdminToast(error.message || "Could not sign out.");
        return;
      }
    });
    document.querySelector(".sidebar-bottom").prepend(signout);
    document.querySelector(".notification-button").addEventListener("click", async () => {
      const { data, error } = await adminClient.from("notifications")
        .select("id, title, body, read_at").order("created_at", { ascending: false }).limit(10);
      if (error) {
        console.error("Could not load administrator notifications.", error);
        showAdminToast(error.message || "Could not load notifications.");
        return;
      }
      const unread = (data || []).filter((notification) => !notification.read_at);
      if (unread.length) {
        const { error: updateError } = await adminClient.from("notifications")
          .update({ read_at: new Date().toISOString() }).in("id", unread.map((item) => item.id));
        if (updateError) {
          console.error("Could not mark notifications as read.", updateError);
          showAdminToast(updateError.message || "Could not mark notifications as read.");
          return;
        }
      }
      showAdminToast(unread[0] ? `${unread[0].title}${unread[0].body ? `: ${unread[0].body}` : ""}` : "You’re all caught up.");
    });
    document.querySelector(".verification-panel").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-verification-id]");
      if (!button) return;
      const action = window.prompt("Type APPROVE to verify this student, or DISMISS to reject the request.");
      if (!action || !["approve", "dismiss"].includes(action.trim().toLowerCase())) return;
      const approve = action.trim().toLowerCase() === "approve";
      button.disabled = true;
      const { error } = await adminClient.rpc("review_verification_request", {
        p_request_id: button.dataset.verificationId,
        p_approve: approve,
      });
      if (error) {
        console.error("Could not review the verification request.", error);
        showAdminToast(error.message || "Could not update the verification request.");
        button.disabled = false;
        return;
      }
      showAdminToast(approve ? "Student verified." : "Verification request dismissed.");
      try {
        await fetchAdminDashboard();
      } catch (refreshError) {
        console.error("Could not refresh the administrator dashboard.", refreshError);
        showAdminToast(refreshError.message || "The request was saved, but the dashboard could not refresh.");
      }
    });
    document.querySelector("#report-rows").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-report-action]");
      if (!button) return;
      button.disabled = true;
      const { error } = await adminClient.from("reports").update({
        status: button.dataset.reportAction,
        resolved_by: window.adminProfile.id,
        resolved_at: new Date().toISOString(),
      }).eq("id", button.dataset.reportId);
      if (error) {
        console.error("Could not update the safety report.", error);
        showAdminToast(error.message || "Could not update the safety report.");
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
  } catch (error) {
    console.error("Administrator access check failed.", error);
    showAdminGate("Could not verify administrator access. Check your Supabase connection, then reload.");
  }
}

if (adminClient) {
  adminClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      window.clearSkillmateServerSession()
        .catch((sessionError) => console.error("Could not clear the secure Skillmate session.", sessionError))
        .finally(() => window.location.replace("login.html?next=admin"));
    }
    if (event === "TOKEN_REFRESHED" && session) {
      window.syncSkillmateServerSession(session).catch((syncError) => {
        console.error("Could not refresh the secure Skillmate session.", syncError);
      });
    }
  });
}

protectAdminDashboard();
