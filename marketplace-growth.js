/* Extra marketplace flows. All connected writes go through verified-session RPCs. */
(() => {
  const utils = window.skillmateGrowthUtils;
  const $ = selector => document.querySelector(selector);
  const filters = $("#marketplace-filters");
  const filtersToggle = $("#marketplace-filter-trigger");
  const ownId = () => appUser?.id || ownProviderId();
  const demoKey = "skillmate-marketplace-growth-v1";
  let schedules = [];
  let requests = [];
  let responses = [];
  let boardLoading = null;
  let schedulesReady = !appSupabase;
  let schedulesAvailable = !appSupabase;
  let slotRequest = 0;
  let slotLoading = false;
  let failedSlots = false;
  let reviewDismissal = "";
  let boardLimit = 24;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const feedback = (id, message, error = false) => {
    const node = $(id);
    node.textContent = message;
    node.dataset.state = error ? "error" : "info";
  };
  const readFilters = () => ({
    min: filters.elements.min.value, max: filters.elements.max.value,
    delivery: filters.elements.delivery.value, sort: filters.elements.sort.value,
    verified: filters.elements.verified.checked, scheduled: filters.elements.scheduled.checked,
  });
  const scheduleFor = id => schedules.find(item => item.provider_id === id && item.is_published);
  function saveDemo() {
    if (!appSupabase) {
      try { localStorage.setItem(demoKey, JSON.stringify({ schedules, requests, responses })); }
      catch { showToast("Your browser could not save this change. Please try again.", "error"); }
    }
  }
  if (!appSupabase) {
    try {
      const data = JSON.parse(localStorage.getItem(demoKey) || "{}");
      schedules = Array.isArray(data.schedules) ? data.schedules : [];
      requests = Array.isArray(data.requests) ? data.requests : [];
      responses = Array.isArray(data.responses) ? data.responses : [];
    } catch { /* Start with an empty demo board. */ }
  }
  async function write(form, feedbackId, work, { optimistic, rollback, render } = {}) {
    if (form.dataset.saving) return;
    form.dataset.saving = "true";
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    feedback(feedbackId, "Saving…");
    let applied = false;
    try {
      if (optimistic) { applied = true; optimistic(); render?.(); }
      await work();
    }
    catch (error) {
      if (applied) { rollback?.(); render?.(); }
      feedback(feedbackId, error.message || "Could not save. Your details are still here; please try again.", true);
      if (feedbackId === "#availability-feedback") $("#availability-summary-status").textContent = "Not saved";
    }
    finally { delete form.dataset.saving; submit.disabled = false; }
  }
  async function rpc(name, args) {
    const result = await appSupabase.rpc(name, args);
    if (result.error) throw new Error(["PGRST202", "42P01", "PGRST205"].includes(result.error.code)
      ? "This feature is not available yet. Please try again later."
      : result.error.code === "23505" ? "You have already submitted a response or report for this request."
      : result.error.message || "Could not save. Please try again.");
    return result.data;
  }
  function populateHours() {
    const schedule = schedules.find(item => item.provider_id === ownId());
    $("#availability-summary-status").textContent = schedule
      ? schedule.is_published ? "Published" : "Saved privately"
      : schedulesAvailable ? "Optional" : "Unavailable";
    $("#availability-timezone").value = schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Accra";
    $("#availability-duration").value = String(schedule?.slot_minutes || 60);
    $("#availability-enabled").checked = Boolean(schedule?.is_published);
    $("#availability-days-off").value = (schedule?.blocked_dates || []).join(", ");
    $("#availability-week").innerHTML = dayNames.map((name, index) => {
      const hours = schedule?.weekly_hours.find(item => item.day === index);
      return `<div class="availability-row" data-hours-day="${index}"><label class="availability-day-toggle"><input type="checkbox" aria-label="${name}" ${hours ? "checked" : ""} /><span aria-hidden="true">${name.slice(0, 3)}</span></label><div class="availability-time-range"><input id="hours-start-${index}" aria-label="${name} start" type="time" value="${escapeHTML(hours?.start || "09:00")}" /><span aria-hidden="true">to</span><input id="hours-end-${index}" aria-label="${name} end" type="time" value="${escapeHTML(hours?.end || "17:00")}" /></div></div>`;
    }).join("");
    syncAvailabilityRows();
  }
  function syncAvailabilityRows() {
    document.querySelectorAll("[data-hours-day]").forEach(row => {
      const enabled = row.querySelector('[type="checkbox"]').checked;
      const range = row.querySelector(".availability-time-range");
      range.hidden = !enabled;
      range.querySelectorAll("input").forEach(input => {
        input.disabled = !enabled;
        input.required = enabled;
      });
    });
  }
  $("#availability-week").addEventListener("change", syncAvailabilityRows);
  $("#availability-form").addEventListener("input", () => {
    $("#availability-summary-status").textContent = "Unsaved changes";
  });
  $("#availability-form").addEventListener("change", () => {
    $("#availability-summary-status").textContent = "Unsaved changes";
  });
  function reviewKey() { return `${ownId()}:${pendingCustomerReviews().map(item => item.id).sort().join(",")}`; }
  const growth = window.skillmateGrowth = {
    matches(provider) { return utils.matchesFilters(provider, readFilters(), Boolean(scheduleFor(provider.id))); },
    compare(left, right) { return utils.compareServices(left, right, readFilters().sort); },
    reviewDismissed() { return reviewDismissal === reviewKey(); },
    progress(booking, providerView) {
      const progress = utils.bookingProgress(booking, providerView);
      const stages = ["Requested", "Confirmed", "In progress", "Client verification", "Completed"];
      return `${progress.step < 0 ? "" : `<ol class="booking-progress" aria-label="Booking progress">${stages.map((label, index) => `<li${index === progress.step ? ' aria-current="step"' : ""} class="${index < progress.step ? "is-done" : ""}">${index < progress.step ? "✓ " : ""}${label}</li>`).join("")}</ol>`}<small class="booking-next-step">${escapeHTML(progress.next)}</small>`;
    },
    canStartWork() { return !appSupabase || schedulesAvailable; },
    async refresh() {
      if (!appSupabase || !appUser) return;
      try {
        const result = await appSupabase.from("provider_availability").select("*").limit(1000);
        if (result.error) throw result.error;
        schedules = result.data || [];
        schedulesAvailable = true;
        feedback("#availability-feedback", "Confirmed appointments are removed from your available times. Pending requests still need your reply.");
      } catch {
        schedulesAvailable = false;
        feedback("#availability-feedback", "Published hours are not available yet. Students can still request a preferred time.");
      }
      schedulesReady = true;
      if ($("#booking-modal").open) growth.refreshSlots();
      if (!$("#availability-form").matches(":focus-within")) populateHours();
      $("#availability-form button[type=submit]").disabled = !schedulesAvailable;
      if (state.activePage === "requests") await growth.refreshBoard();
      growth.render();
      renderMarketplace();
    },
    render() {
      const pending = pendingCustomerReviews();
      const reminder = $("#required-review-reminder");
      if (reminder) {
        reminder.hidden = !pending.length || growth.reviewDismissed();
        if (pending.length) reminder.innerHTML = `<span><strong>How did your completed booking go?</strong><small>Your feedback helps other students. You can book again at any time.</small></span><button class="button button-primary button-small" type="button" data-review="${escapeHTML(pending[0].id)}">Write review</button><button class="subtle-button" type="button" data-dismiss-reviews>Not now</button>`;
      }
      const stats = utils.metrics(state.bookings.filter(isOwnBooking));
      $("#growth-metrics").innerHTML = [[stats.requests,"Requests received"],[stats.confirmed,"Confirmed or finished"],[stats.completed,"Completed jobs"],[stats.repeatCustomers,"Repeat customers"]]
        .map(([value, label]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join("");
    },
    async refreshSlots() {
      const token = ++slotRequest;
      const provider = $("#booking-provider-id").value;
      const date = $("#booking-date").value;
      const schedule = scheduleFor(provider);
      const note = $("#booking-availability-note");
      const label = $("#booking-slot-label");
      const manual = $("#booking-time");
      failedSlots = false;
      label.hidden = !schedule;
      manual.closest("label").hidden = Boolean(schedule);
      manual.required = !schedule;
      $("#booking-slot").required = Boolean(schedule);
      $("#booking-slot").replaceChildren(new Option("Choose a time", ""));
      if (!schedulesReady) { slotLoading = true; note.textContent = "Checking the provider’s available hours…"; return; }
      if (!schedule) { slotLoading = false; note.textContent = "Choose a preferred time. The provider must confirm your request."; return; }
      slotLoading = true;
      note.textContent = "Loading available appointments…";
      try {
        const slots = appSupabase ? await rpc("available_provider_slots", { p_provider_id: provider, p_day: date })
          : utils.slotsForDate(schedule, date, state.bookings.filter(item => item.providerId === provider));
        if (token !== slotRequest) return;
        const formatter = new Intl.DateTimeFormat(undefined, { timeZone: schedule.timezone, hour: "numeric", minute: "2-digit" });
        (slots || []).forEach(slot => $("#booking-slot").add(new Option(`${formatter.format(new Date(slot.starts_at))} · ${slot.duration_minutes} min`, slot.starts_at)));
        note.textContent = slots?.length ? `Times use ${schedule.timezone}. These are available now; your provider still confirms your request.` : "No appointments on this date. Try another day or message the provider.";
      } catch (error) {
        if (token !== slotRequest) return;
        failedSlots = true;
        note.textContent = `${error.message} Change the date to retry.`;
      } finally { if (token === slotRequest) slotLoading = false; }
    },
    appointment(date, time) {
      if (slotLoading || failedSlots || !schedulesReady) { showToast("Please wait for available times, or change the date to retry.", "error"); return null; }
      if (!$("#booking-slot-label").hidden) return $("#booking-slot").value ? new Date($("#booking-slot").value) : null;
      return parseLocalAppointment(date, time);
    },
    async refreshBoard() {
      if (boardLoading) return boardLoading;
      if (appSupabase && !appUser) return;
      boardLoading = (async () => {
      $("#request-board-refresh").disabled = true;
      const finishLoading = !requests.length && window.skillmateLoading
        ? window.skillmateLoading.show($("#request-board-grid"), { count: 6, variant: "cards", label: "Loading campus requests" })
        : () => {};
      feedback("#request-board-feedback", "Loading campus requests…");
      try {
        if (appSupabase) {
          const result = await appSupabase.from("campus_request_directory").select("*").order("created_at", { ascending: false }).range(0, boardLimit - 1);
          if (result.error) throw result.error;
          requests = result.data || [];
          const replyResult = requests.length ? await appSupabase.from("campus_request_response_directory").select("*").in("request_id", requests.map(item => item.id)).order("created_at", { ascending: false }).limit(500) : { data: [] };
          if (replyResult.error) throw replyResult.error;
          responses = replyResult.data || [];
        }
        feedback("#request-board-feedback", appSupabase ? "Requests expire at the end of their chosen day in Ghana time. Keep personal and payment details out of public posts." : "Demo board: posts and replies stay in this browser and are not sent to other students.");
        renderBoard();
      } catch {
        feedback("#request-board-feedback", "Campus requests could not load. Try Refresh in a moment.", true);
        $("#request-board-grid").innerHTML = '<div class="empty-card"><strong>Requests are temporarily unavailable</strong><small>Your existing bookings and messages are still available.</small></div>';
      } finally { finishLoading(); $("#request-board-refresh").disabled = false; }
      })();
      try { return await boardLoading; }
      finally { boardLoading = null; }
    },
  };
  function renderBoard() {
    const mine = ownId();
    const view = $("#request-board-filter").value;
    const visible = requests.filter(item => {
      if (view === "mine") return item.requester_id === mine;
      if (view === "responses") return responses.some(reply => reply.request_id === item.id && reply.responder_id === mine);
      return item.status === "open" && Date.parse(item.expires_at) > Date.now() && item.campus === state.profile.university && !state.blocked.includes(item.requester_id);
    });
    $("#request-board-grid").innerHTML = visible.length ? visible.map(item => {
      const own = item.requester_id === mine;
      const open = item.status === "open" && Date.parse(item.expires_at) > Date.now();
      const replies = responses.filter(reply => reply.request_id === item.id && (own || reply.responder_id === mine));
      const responded = replies.some(reply => reply.responder_id === mine);
      return `<article class="request-card"><small>${escapeHTML(item.category)} · ${escapeHTML(item.campus)}</small><h2>${escapeHTML(item.title)}</h2><p>${escapeHTML(item.description)}</p><div class="request-meta"><span>${item.budget ? `Budget ${currency(item.budget)}` : "Budget to discuss"}</span><span>${escapeHTML(item.delivery_method === "online" ? "Online" : item.delivery_method === "in_person" ? "In person" : "Either")}</span><span>${open ? `Until ${escapeHTML(new Date(item.expires_at).toLocaleDateString(undefined, { timeZone: "Africa/Accra" }))}` : item.status === "removed" ? "Removed" : item.status === "closed" ? "Closed" : "Expired"}</span></div><small>Posted by ${own ? "you" : escapeHTML(item.requester_name || "a student")}</small>
        <div class="request-actions">${own ? open ? `<button class="button button-outline button-small" type="button" data-close-request="${escapeHTML(item.id)}">Close request</button>` : "" : open ? `<button class="button button-primary button-small" type="button" data-reply-request="${escapeHTML(item.id)}" ${responded ? "disabled" : ""}>${responded ? "Response sent" : "Offer to help"}</button><button class="subtle-button" type="button" data-report-request="${escapeHTML(item.id)}">Report</button>` : ""}</div>
        ${replies.map(reply => `<div class="request-response"><strong>${escapeHTML(own ? reply.responder_name || "Student" : "Your response")}</strong><p>${escapeHTML(reply.message)}</p><small>${reply.price ? `Suggested price: ${currency(reply.price)}` : "Price to discuss"}</small>${own ? `<button class="subtle-button" type="button" data-request-chat="${escapeHTML(item.id)}" data-responder="${escapeHTML(reply.responder_id)}">Message student</button>` : ""}</div>`).join("")}</article>`;
    }).join("") : '<div class="empty-card"><strong>No requests here yet</strong><small>Need help? Post a clear task with your deadline and budget so students know how to help.</small><button class="button button-primary" type="button" data-new-request>Post a request</button></div>';
    if (appSupabase && requests.length === boardLimit) $("#request-board-grid").insertAdjacentHTML("beforeend", '<button class="button button-outline" type="button" data-more-requests>Load more requests</button>');
  }
  filtersToggle.addEventListener("click", () => {
    const expanded = filtersToggle.getAttribute("aria-expanded") === "true";
    filters.hidden = expanded;
    filtersToggle.setAttribute("aria-expanded", String(!expanded));
    filtersToggle.setAttribute("aria-label", `${expanded ? "Show" : "Hide"} service filters`);
    filtersToggle.title = `${expanded ? "Show" : "Hide"} service filters`;
    filtersToggle.classList.toggle("is-active", !expanded);
  });
  filters.addEventListener("submit", event => event.preventDefault());
  filters.addEventListener("input", () => { renderMarketplace(); renderSearchSuggestions(); });
  filters.addEventListener("change", () => renderMarketplace());
  filters.addEventListener("reset", () => setTimeout(() => { renderMarketplace(); renderSearchSuggestions(); }, 0));
  document.addEventListener("click", event => {
    if (event.target.closest("[data-clear-search]")) filters.reset();
  });
  $("#availability-form").addEventListener("submit", event => {
    event.preventDefault();
    const schedule = {
      provider_id: ownId(), timezone: $("#availability-timezone").value.trim(), slot_minutes: Number($("#availability-duration").value),
      is_published: $("#availability-enabled").checked,
      weekly_hours: [...document.querySelectorAll("[data-hours-day]")].filter(row => row.querySelector('[type=checkbox]').checked)
        .map(row => ({ day: Number(row.dataset.hoursDay), start: row.querySelector('[id^=hours-start]').value, end: row.querySelector('[id^=hours-end]').value })),
      blocked_dates: $("#availability-days-off").value.split(",").map(item => item.trim()).filter(Boolean),
    };
    if (!utils.validSchedule(schedule) || (schedule.is_published && !schedule.weekly_hours.length)
      || schedule.blocked_dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10) !== date)) {
      feedback("#availability-feedback", "Check the time zone, working hours and dates off. Each day must fit a full appointment.", true); return;
    }
    const previousSchedule = schedules.find(item => item.provider_id === schedule.provider_id);
    write(event.target, "#availability-feedback", async () => {
      if (appSupabase) await rpc("save_provider_availability", { p_timezone: schedule.timezone, p_slot_minutes: schedule.slot_minutes, p_weekly_hours: schedule.weekly_hours, p_blocked_dates: schedule.blocked_dates, p_is_published: schedule.is_published });
      schedules = schedules.filter(item => item.provider_id !== schedule.provider_id).concat(schedule);
      saveDemo(); renderMarketplace();
      feedback("#availability-feedback", schedule.is_published ? "Your hours are published. Existing appointments keep their agreed time and length." : "Your hours are saved privately. Students can request a preferred time.");
      $("#availability-summary-status").textContent = schedule.is_published ? "Published" : "Saved privately";
    }, {
      optimistic: () => {
        schedules = schedules.filter(item => item.provider_id !== schedule.provider_id).concat(schedule);
        $("#availability-summary-status").textContent = schedule.is_published ? "Publishing…" : "Saving privately…";
      },
      rollback: () => {
        schedules = schedules.filter(item => item.provider_id !== schedule.provider_id);
        if (previousSchedule) schedules.push(previousSchedule);
      },
      render: renderMarketplace,
    });
  });
  $("#booking-date").addEventListener("change", growth.refreshSlots);
  $("#booking-service").addEventListener("change", growth.refreshSlots);
  function openPost() {
    $("#request-post-form").reset();
    $("#request-category").innerHTML = serviceCategories.map(category => `<option>${escapeHTML(category)}</option>`).join("");
    $("#request-deadline").min = localDateInputValue();
    $("#request-deadline").max = localDateInputValue(new Date(Date.now() + 30 * 86400000));
    $("#request-deadline").value = localDateInputValue(new Date(Date.now() + 7 * 86400000));
    feedback("#request-post-feedback", ""); openModal("request-post-modal");
  }
  $("#request-post-open").addEventListener("click", openPost);
  $("#request-board-refresh").addEventListener("click", growth.refreshBoard);
  $("#request-board-filter").addEventListener("change", renderBoard);
  $("#request-post-form").addEventListener("submit", event => {
    event.preventDefault();
    write(event.target, "#request-post-feedback", async () => {
      if (!state.profile.university) throw new Error("Add your campus to your profile first.");
      const title = $("#request-title").value.trim(), description = $("#request-description").value.trim();
      if (title.length < 5 || description.length < 20) throw new Error("Add a title of at least 5 characters and details of at least 20 characters.");
      const args = { p_title: title, p_category: $("#request-category").value, p_description: description,
        p_budget: $("#request-budget").value ? Number($("#request-budget").value) : null, p_delivery: $("#request-delivery").value, p_deadline: $("#request-deadline").value };
      if (appSupabase) await rpc("post_campus_request", args);
      else requests.unshift({ id: crypto.randomUUID(), requester_id: ownId(), campus: state.profile.university, title, description, category: args.p_category, budget: args.p_budget, delivery_method: args.p_delivery,
        expires_at: new Date(Date.parse(`${args.p_deadline}T00:00:00Z`) + 86400000).toISOString(), status: "open", created_at: new Date().toISOString() });
      saveDemo();
      $("#request-post-modal").close();
      $("#request-board-filter").value = "mine";
      if (boardLoading) await boardLoading;
      showPage("requests");
      await growth.refreshBoard();
      showToast("Your request is posted.");
    });
  });
  $("#request-reply-form").addEventListener("submit", event => {
    event.preventDefault();
    write(event.target, "#request-reply-feedback", async () => {
      const id = $("#request-reply-id").value, message = $("#request-reply-message").value.trim();
      const price = $("#request-reply-price").value ? Number($("#request-reply-price").value) : null;
      if (message.length < 10) throw new Error("Explain how you can help in at least 10 characters.");
      if (appSupabase) await rpc("respond_campus_request", { p_request_id: id, p_message: message, p_price: price });
      else {
        if (responses.some(item => item.request_id === id && item.responder_id === ownId())) throw new Error("You already replied to this request.");
        responses.push({ id: crypto.randomUUID(), request_id: id, responder_id: ownId(), responder_name: state.profile.name, message, price });
      }
      saveDemo(); $("#request-reply-modal").close(); await growth.refreshBoard(); showToast("Your response has been sent.");
    });
  });
  $("#request-report-form").addEventListener("submit", event => {
    event.preventDefault();
    write(event.target, "#request-report-feedback", async () => {
      if (appSupabase) await rpc("report_campus_request", { p_request_id: $("#request-report-id").value, p_details: $("#request-report-message").value.trim() });
      $("#request-report-modal").close(); showToast(appSupabase ? "Your report was sent for review." : "Demo only: no report was sent.");
    });
  });
  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-dismiss-reviews], [data-rebook], [data-new-request], [data-close-request], [data-reply-request], [data-report-request], [data-request-chat], [data-more-requests]");
    if (!button) return;
    if (button.hasAttribute("data-dismiss-reviews")) { reviewDismissal = reviewKey(); growth.render(); }
    else if (button.hasAttribute("data-new-request")) openPost();
    else if (button.dataset.rebook) {
      const booking = state.bookings.find(item => item.id === button.dataset.rebook);
      if (!booking) return;
      const services = providerServices(booking.providerId);
      const service = services.find(item => booking.serviceId ? item.id === booking.serviceId : item.title === booking.service);
      if (!service) { showToast("This service is no longer listed. Browse another service from the provider.", "error"); return; }
      openBooking(booking.providerId, service.id); // A fresh request uses today's listing and price, never the old agreement.
      $("#booking-description").textContent = "Book this service again. Check the current price, choose a new date and confirm the details.";
    } else if (button.dataset.replyRequest) {
      $("#request-reply-form").reset(); $("#request-reply-id").value = button.dataset.replyRequest; feedback("#request-reply-feedback", ""); openModal("request-reply-modal");
    } else if (button.dataset.reportRequest) {
      $("#request-report-form").reset(); $("#request-report-id").value = button.dataset.reportRequest; feedback("#request-report-feedback", ""); openModal("request-report-modal");
    } else if (button.dataset.closeRequest) {
      button.disabled = true;
      const request = requests.find(item => item.id === button.dataset.closeRequest);
      const previousStatus = request?.status;
      if (request) { request.status = "closed"; renderBoard(); }
      try {
        if (appSupabase) await rpc("close_campus_request", { p_request_id: button.dataset.closeRequest, p_remove: false });
        else requests.find(item => item.id === button.dataset.closeRequest).status = "closed";
        saveDemo(); await growth.refreshBoard();
      } catch (error) {
        const current = requests.find(item => item.id === button.dataset.closeRequest);
        if (current) current.status = previousStatus;
        renderBoard();
        showToast(error.message, "error");
      } finally { button.disabled = false; }
    } else if (button.dataset.requestChat) {
      if (!appSupabase) { showToast("A connected account is needed to message a responder."); return; }
      button.disabled = true;
      try {
        const conversationId = await rpc("start_request_conversation", { p_request_id: button.dataset.requestChat, p_responder_id: button.dataset.responder });
        await refreshSupabaseState();
        document.dispatchEvent(new CustomEvent("skillmate:open-conversation", { detail: { conversationId } }));
      } catch(error) { showToast(error.message, "error"); } finally { button.disabled = false; }
    } else if (button.hasAttribute("data-more-requests")) { boardLimit += 24; growth.refreshBoard(); }
  });
  populateHours();
  growth.render();
  if (appSupabase && appUser) growth.refresh();
  else if (!appSupabase) growth.refreshBoard();
})();
