/* Provider evidence and independently loaded private CVs. */
async function openProviderProfile(providerId, serviceId) {
  const provider = getProvider(providerId);
  if (!provider) return;
  const rating = providerReviewSummary(provider);
  const services = providerServices(providerId);
  const selectedService = services.find(service => service.id === serviceId) || services[0];
  const profile = document.querySelector("#provider-detail-content");
  const requestId = crypto.randomUUID();
  profile.dataset.requestId = requestId;
  document.querySelector("#provider-detail-title").textContent = selectedService?.title || provider.service;
  const hasCv = appSupabase && provider.cvPath
    && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/i.test(provider.cvPath)
    && provider.cvPath.startsWith(`${providerId}/`);
  const skills = (provider.skills || []).filter(Boolean);
  const reviews = providerReviews(providerId);
  const portfolioMarkup = (provider.portfolio || []).map(item => {
    const work = typeof item === "string" ? { title: item } : item;
    const image = window.skillflexMarketplace.safeImageUrl(work.image);
    return `<article class="showcase-work-card">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(work.title)}" loading="lazy" decoding="async" />` : `<div class="portfolio-placeholder" aria-hidden="true">${getCategoryIcon(provider.category)}</div>`}<div><strong>${escapeHTML(work.title)}</strong>${work.description ? `<p>${escapeHTML(work.description)}</p>` : ""}</div></article>`;
  }).join("");
  const reviewMarkup = reviews.map(review => `<article class="showcase-review-card"><div class="showcase-review-heading"><span aria-label="${Number(review.rating)} out of 5 stars">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</span><time>${escapeHTML(new Date(review.date).toLocaleDateString(undefined, { month: "short", year: "numeric" }))}</time></div><p>${escapeHTML(review.text)}</p><small>Verified completed booking</small></article>`).join("");
  profile.innerHTML = `
    <header class="showcase-hero">
      <div class="showcase-orbit" aria-hidden="true"></div>
      <div class="showcase-identity">${providerAvatarMarkup(provider)}<div><span class="showcase-kicker">${provider.verified ? "✦ CAMPUS VERIFIED" : "SKILL FLEX PROVIDER"}</span><h2>${escapeHTML(provider.name)}</h2><p>${escapeHTML(provider.course || "Student provider")} · ${escapeHTML(provider.campus)}</p></div></div>
      <p class="showcase-bio">${escapeHTML(provider.bio || provider.description || "A student sharing their skills with the campus community.")}</p>
      <div class="showcase-stats"><div><strong>${escapeHTML(rating.rating)}</strong><span>${rating.count} ${rating.count === 1 ? "review" : "reviews"}</span></div><i></i><div><strong>${Number(provider.bookings) || 0}</strong><span>completed works</span></div><i></i><div><strong>${services.length}</strong><span>${services.length === 1 ? "service" : "services"}</span></div></div>
    </header>
    <section class="provider-evidence" aria-label="Before you book">
      <div><strong>${escapeHTML(selectedService?.title || provider.service)}</strong><span>${escapeHTML(servicePriceLabel(selectedService || provider))}</span><small>${escapeHTML(serviceDetailLabel(selectedService || provider))}</small></div>
      <p>${provider.verified ? "Campus verification: a student ID was reviewed by the Skill Flex team. This does not guarantee service quality." : "Campus identity has not been verified. Review work samples and discuss the details before booking."}</p>
      <p>${escapeHTML(window.skillflexGrowth?.availabilitySummary(providerId) || "Ask the provider about available times.")}</p>
      <div class="provider-evidence-links"><button type="button" class="subtle-button" data-showcase-jump="work">${(provider.portfolio || []).length} work samples</button><button type="button" class="subtle-button" data-showcase-jump="reviews">${rating.count} reviews · newest first</button></div>
    </section>
    <section class="detail-section showcase-section"><div class="showcase-section-heading"><span>01</span><h3>Services</h3></div>${services.map((service) => `<div class="detail-service"><span><strong>${escapeHTML(service.title)}</strong><small>${escapeHTML(service.category)} · ${servicePriceLabel(service)}</small><small>${escapeHTML(serviceDetailLabel(service))}</small>${service.providerId !== appUser?.id ? `<small>${service.priceType === "range" ? "Price range · custom quote required" : service.negotiationMode === "fixed" ? "Fixed Price" : service.negotiationMode === "hybrid" ? "Custom price & scope" : "Negotiation · price only"}</small>${service.negotiationMode !== "fixed" ? `<span class="detail-negotiation-actions"><button class="button button-small button-outline" type="button" data-negotiation-action="offer" data-provider="${escapeHTML(providerId)}" data-service="${escapeHTML(service.id)}">Make an offer</button><button class="button button-small button-outline" type="button" data-negotiation-action="discuss" data-provider="${escapeHTML(providerId)}" data-service="${escapeHTML(service.id)}">Discuss price</button></span>` : ""}` : ""}</span>${service.groups ? '<span class="detail-group-tag">Group bookings welcome</span>' : ""}</div>`).join("")}</section>
    <section class="detail-section showcase-section"><div class="showcase-section-heading"><span>02</span><h3>Education &amp; skills</h3></div><p class="showcase-education"><strong>${escapeHTML(provider.course || "Student")}</strong><span>${escapeHTML(provider.campus)}</span></p><div class="showcase-skills">${skills.length ? skills.map(skill => `<span>${escapeHTML(skill)}</span>`).join("") : '<span>Skills and specialities shared through listed services</span>'}</div>${hasCv ? '<div class="showcase-cv-status" data-provider-cv role="status"></div>' : ""}</section>
    <section class="detail-section showcase-section"><div class="showcase-section-heading"><span>03</span><h3>Selected work</h3></div><div class="showcase-work-grid">${portfolioMarkup || '<p class="detail-empty">No work samples added yet. Ask the provider about their experience.</p>'}</div></section>
    <section class="detail-section showcase-section"><div class="showcase-section-heading"><span>04</span><h3>Student reviews</h3><span class="showcase-review-score">${rating.count ? `★ ${escapeHTML(rating.rating)}` : "NEW"}</span></div><div class="showcase-review-list">${reviewMarkup || '<p class="detail-empty">No reviews yet. Completed work can be reviewed by the customer.</p>'}</div></section>
    ${services.some(service => service.groups) ? `<section class="detail-section group-detail-callout"><div><h3>Need help as a group?</h3><p>This provider welcomes group requests.</p></div><button class="button button-outline" type="button" data-open="groups-modal" data-group-provider="${escapeHTML(providerId)}">Book with friends</button></section>` : ""}`;
  document.querySelector("#provider-detail-title").textContent = selectedService?.title || provider.service;
  document.querySelector("#provider-detail-book").dataset.book = providerId;
  document.querySelector("#provider-detail-book").dataset.service = selectedService?.id || "";
  document.querySelector("#provider-detail-message").dataset.message = providerId;
  document.querySelector("#provider-detail-message").dataset.service = selectedService?.id || "";
  document.querySelector("#provider-detail-report").dataset.report = providerId;
  document.querySelector("#provider-detail-book").disabled = false;
  document.querySelector("#provider-detail-message").disabled = false;
  document.querySelector("#provider-detail-report").disabled = false;
  openModal("provider-detail-modal");
  window.skillflexJourney?.record("profile_open");
  if (hasCv) void loadProviderCv(provider, profile, requestId);
}
async function loadProviderCv(provider, profile, requestId) {
  const region = profile.querySelector("[data-provider-cv]");
  const modal = document.querySelector("#provider-detail-modal");
  if (!region || profile.dataset.requestId !== requestId || !modal.open) return;
  const previousFocus = document.activeElement;
  const restoreFocus = region.contains(previousFocus);
  const isCurrent = () => profile.dataset.requestId === requestId && modal.open && region.isConnected;
  const cancel = () => {
    if (profile.dataset.requestId === requestId) profile.dataset.requestId = "";
    region.removeAttribute("aria-busy");
  };
  modal.addEventListener("close", cancel, { once: true });
  region.setAttribute("aria-busy", "true");
  region.setAttribute("role", "status");
  region.textContent = "Loading professional CV…";
  let nextFocus;
  try {
    const { data, error } = await window.skillflexLoading.withTimeout(
      appSupabase.storage.from("provider-cvs").createSignedUrl(provider.cvPath, 900),
    );
    if (!isCurrent()) return;
    if (error) throw error;
    const url = new URL(data?.signedUrl);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid CV link");
    const link = document.createElement("a");
    link.className = "showcase-cv-link";
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML = `<span aria-hidden="true">↗</span><span><strong>View professional CV</strong><small>${escapeHTML(provider.cvName || "PDF document")} · Secure link expires in 15 minutes</small></span>`;
    region.replaceChildren(link);
    nextFocus = link;
  } catch (error) {
    if (!isCurrent()) return;
    console.error("Could not create a signed provider CV link.", error);
    region.setAttribute("role", "alert");
    const message = document.createElement("span");
    message.textContent = "The CV is unavailable. You can still book or message this student.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button button-small button-outline";
    retry.textContent = "Retry CV";
    retry.addEventListener("click", () => void loadProviderCv(provider, profile, requestId));
    region.replaceChildren(message, retry);
    nextFocus = retry;
  } finally {
    region.removeAttribute("aria-busy");
    modal.removeEventListener("close", cancel);
    if (isCurrent() && restoreFocus && (document.activeElement === document.body || document.activeElement === previousFocus)) nextFocus?.focus();
  }
}
