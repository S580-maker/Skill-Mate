/* Booking cards rendered from dashboard state. */
function renderBookingList(targetId, list, options = {}) {
  const target = document.getElementById(targetId);
  if (!target) return;
  if (renderPendingData(target, list.length, "bookings")) return;
  if (!list.length && renderLoadFailure(target)) return;
  if (options.provider) list = window.skillflexMarketplace.filterBookings(list, { direction: "received", ownId: ownProviderId() });
  target.innerHTML = list.length ? list.map((booking) => {
    const provider = getProvider(booking.providerId);
    const status = booking.status;
    const providerView = options.provider || isOwnBooking(booking);
    const appointmentProposalPending = Boolean(booking.pendingAppointmentProposalId);
    const next = window.skillflexBookingPolicy.nextStep(booking, providerView);
    const nextAction = `<section class="booking-next-action" aria-label="Next step"><strong>${escapeHTML(next.owner === "You" ? "Your next step" : next.owner === "Complete" || next.owner === "Closed" ? next.owner : `Next: ${next.owner}`)}</strong><span>${escapeHTML(next.text)}</span>${pendingBookingStatuses.has(booking.id) || booking.id.startsWith("pending-booking-") ? '<small role="status">Saving change…</small>' : ""}</section>`;
    const actions = providerView
      ? `${booking.status === "Pending" ? `${appointmentProposalPending ? "" : `<button class="button button-small button-primary" data-decision="Confirmed" data-booking-id="${escapeHTML(booking.id)}">Accept</button>`}<button class="button button-small button-outline" data-decision="Declined" data-booking-id="${escapeHTML(booking.id)}">Decline</button>` : ["Confirmed", "In progress"].includes(booking.status) ? `${booking.status === "Confirmed" && window.skillflexGrowth?.canStartWork() ? `<button class="button button-small button-primary" data-decision="In progress" data-booking-id="${escapeHTML(booking.id)}">Start work</button>` : ""}<button class="button button-small ${status === "In progress" ? "button-primary" : "button-outline"}" data-decision="Completed" data-booking-id="${escapeHTML(booking.id)}">Mark complete</button>` : ""}${["Pending", "Confirmed"].includes(status) && !appointmentProposalPending ? `<button class="subtle-button" data-propose-appointment="${escapeHTML(booking.id)}">Suggest another time</button>` : ""}<button class="subtle-button" data-message="customer:${escapeHTML(booking.id)}">Message student</button>`
      : `${status === "Awaiting verification" ? `<button class="button button-small button-primary" data-decision="Completed" data-booking-id="${escapeHTML(booking.id)}">Confirm completion</button>` : ""}${status === "Completed" && !booking.reviewed ? `<button class="button button-small button-primary review-required-button" data-review="${escapeHTML(booking.id)}">Leave a review</button>` : ""}${appointmentProposalPending ? `<button class="button button-small button-primary" data-appointment-response="accept" data-proposal-id="${escapeHTML(booking.pendingAppointmentProposalId)}">Accept suggested time</button><button class="button button-small button-outline" data-appointment-response="reject" data-proposal-id="${escapeHTML(booking.pendingAppointmentProposalId)}">Keep original time</button>` : ""}${!booking.groupId && ["Pending", "Confirmed"].includes(status) ? `<button class="subtle-button" data-decision="Cancelled" data-booking-id="${escapeHTML(booking.id)}">Cancel booking</button>` : ""}`;
    const statusLabel = status === "Awaiting verification"
      ? providerView ? "Awaiting client verification" : "Verify completion"
      : status === "Pending" ? providerView ? appointmentProposalPending ? "Time change awaiting customer" : "Needs your reply" : "Awaiting confirmation"
      : status;
    const repeatAction = !providerView && status === "Completed" ? `<button class="button button-small button-outline" data-rebook="${escapeHTML(booking.id)}">Book again</button>` : "";
    const progress = window.skillflexGrowth?.progress(booking, providerView, { showNext: false }) || "";
    const priceChatAction = booking.priceNegotiationId
      ? `<button class="subtle-button" data-negotiation-chat="${escapeHTML(booking.priceNegotiationId)}">Open price chat</button>` : "";
    const location = ["Confirmed", "In progress"].includes(status) && booking.otherLocation
      ? `<div class="booking-location"><strong>${providerView ? "Customer" : "Provider"}’s hostel or campus: ${escapeHTML(booking.otherLocation)}</strong><small>Shared for this confirmed booking. Approximate distance isn’t available without map pins.</small></div>`
      : "";
    const listedPriceNote = Number.isFinite(booking.listedPrice) && booking.listedPrice !== booking.price
      ? `<small class="booking-note">Original listed price: ${currency(booking.listedPrice)}</small>` : "";
    const appointmentSuggestion = appointmentProposalPending
      ? `<div class="booking-appointment-proposal"><strong>Suggested time</strong><span>${escapeHTML(new Date(booking.pendingAppointmentAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }))}</span><small>${providerView ? "Waiting for the customer to approve this change." : "Choose whether this new time works for you. Your booking is not confirmed yet."}</small></div>`
      : "";
    const requestedArrangement = booking.requestedLocation
      ? `<small class="booking-note">Arrangement: ${escapeHTML(booking.requestedLocation)}</small>` : "";
    const serviceScope = booking.scopeSnapshot || (appSupabase ? connectedServices : []).find(service => service.id === booking.serviceId)?.description;
    const agreedScope = `<details class="booking-contract"><summary>Booking details · ${escapeHTML(currency(booking.price))}</summary><dl><div><dt>${booking.scopeSnapshot ? "Agreed scope" : "Listing details"}</dt><dd>${escapeHTML(serviceScope || "Scope was not recorded. Confirm the details with your provider in messages.")}${!booking.scopeSnapshot && serviceScope ? " (Current listing; confirm the booked scope in messages.)" : ""}</dd></div><div><dt>Price</dt><dd>${escapeHTML(currency(booking.price))}${booking.priceAgreementId ? " · Accepted agreement" : " · Booking price"}</dd></div><div><dt>Appointment</dt><dd>${escapeHTML(formatDate(booking.date))} · ${escapeHTML(booking.time || "Time to be arranged")}</dd></div></dl><small>Completion is final after the customer verifies the work.</small></details>`;
    return `<article class="booking-card${!providerView && status === "Completed" && !booking.reviewed ? " booking-awaiting-review" : ""}" data-booking-card-id="${escapeHTML(booking.id)}"><span class="booking-service-icon">${getCategoryIcon(provider?.category || "Other")}</span><div class="booking-main"><div class="booking-title-row"><strong>${escapeHTML(booking.service)}</strong><span class="booking-type-pill">${escapeHTML(booking.type || "Individual")}</span>${booking.priceAgreementId ? '<span class="booking-type-pill">Agreed price</span>' : ""}<span class="status status-${escapeHTML(status.toLowerCase().replaceAll(" ", "-"))}">${escapeHTML(statusLabel)}</span></div><span>${providerView ? `Requested by ${escapeHTML(booking.customer || "Student")}` : `with ${escapeHTML(provider?.name || "Skill Flex student")}`}</span><span class="booking-date">${formatDate(booking.date)} · ${escapeHTML(booking.time || "Time to be arranged")}</span>${appointmentSuggestion}${listedPriceNote}${requestedArrangement}${booking.note ? `<small class="booking-note">Instructions: “${escapeHTML(booking.note)}”</small>` : ""}${agreedScope}${nextAction}${progress}${location}</div><strong class="booking-price">${currency(booking.price)}</strong><div class="booking-actions">${actions}${repeatAction}${priceChatAction}${!providerView && status !== "Completed" ? `<button class="subtle-button" data-message="${escapeHTML(booking.providerId)}">Message</button>` : ""}</div></article>`;
  }).join("") : '<div class="empty-card"><span class="empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span><strong>Nothing here just yet</strong><small>Your bookings and requests will appear here.</small></div>';
  if (!list.length && targetId === "user-booking-list") {
    const empty = target.querySelector(".empty-card");
    window.skillflexIllustrations?.mount(empty, "bookings", empty?.querySelector(":scope > span"));
  }
  target.querySelectorAll("[data-decision], [data-propose-appointment], [data-review]").forEach(button => {
    const id = button.dataset.bookingId || button.dataset.proposeAppointment || button.dataset.review;
    if (pendingBookingStatuses.has(id) || id?.startsWith("pending-booking-")) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
  });
}
