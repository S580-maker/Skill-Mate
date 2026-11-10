/* Shared loading and error helpers. Placeholders mirror the real components (see skeleton.css) and never replace cached data. */
(() => {
  const escapeText = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const repeat = (count, make) => Array.from({ length: count }, (_, index) => make(index)).join("");
  const line = (modifier = "", width = "") => `<i class="sk sk-line${modifier ? ` sk-line--${modifier}` : ""}${width ? ` sk-w-${width}` : ""}"></i>`;

  const parts = {
    providerCard: () => `<article class="sk-card"><i class="sk sk-card-cover"></i><div class="sk-card-body"><div class="sk-card-meta"><i class="sk sk-w-30"></i><i class="sk sk-w-20"></i></div><div class="sk-card-title"><i class="sk sk-w-90"></i><i class="sk sk-w-60"></i></div><div class="sk-card-desc">${line("", "100")}${line("", "70")}</div><div class="sk-card-person"><i class="sk sk-circle"></i><div>${line("", "60")}${line("xs", "90")}</div></div><div class="sk-card-footer"><div class="sk-card-price">${line("xs", "40")}${line("md", "80")}</div><div class="sk-card-actions"><i class="sk sk-message"></i><i class="sk sk-btn"></i></div></div></div></article>`,
    listing: () => `<article class="sk-listing sk-surface"><i class="sk sk-listing-image"></i><div class="sk-listing-copy">${line("md", "70")}${line("xs", "30")}${line("", "90")}</div><i class="sk sk-listing-price"></i><div class="sk-listing-actions"><i class="sk"></i><i class="sk"></i></div></article>`,
    identity: () => `<section class="sk-surface sk-identity"><i class="sk sk-circle"></i><div>${line("xs", "30")}${line("md", "60")}${line("", "80")}<div class="sk-tags"><i class="sk sk-pill"></i><i class="sk sk-pill"></i></div></div><i class="sk sk-heading-action"></i></section>`,
    bookingRow: (compact = false) => `<article class="sk-row${compact ? " sk-row--compact" : ""}"><i class="sk sk-row-icon"></i><div class="sk-row-main"><div class="sk-row-title">${line("md")}<i class="sk sk-pill"></i>${compact ? "" : '<i class="sk sk-pill"></i>'}</div>${line("", "30")}${compact ? line("", "60") : `${line("", "40")}<div class="sk-row-steps">${repeat(4, () => '<i class="sk sk-pill"></i>')}</div>${line("", "50")}`}</div><div class="sk-row-side"><i class="sk sk-price"></i><div class="sk-actions"><i class="sk"></i><i class="sk"></i></div></div></article>`,
    conversationRow: () => '<div class="sk-chat-item"><i class="sk sk-circle"></i><div><i class="sk"></i><i class="sk"></i></div></div>',
    stat: () => `<div class="sk-stat">${line()}${line()}${line()}</div>`,
    request: () => `<article class="sk-card"><div class="sk-card-body"><div class="sk-card-meta"><i class="sk sk-w-30"></i><i class="sk sk-w-20"></i></div><div class="sk-card-title"><i class="sk sk-w-80"></i></div><div class="sk-card-desc">${line("", "100")}${line("", "60")}</div><div class="sk-card-footer"><i class="sk sk-circle"></i>${line()}<i class="sk sk-btn"></i></div></div></article>`,
    heading: ({ action = false } = {}) => `<div class="sk-heading"><div class="sk-heading-copy"><i class="sk sk-eyebrow"></i><i class="sk sk-title"></i><i class="sk-heading-rule"></i><i class="sk sk-sub"></i></div>${action ? '<i class="sk sk-heading-action"></i>' : ""}</div>`,
    sectionHead: () => '<div class="sk-section-head"><div><i class="sk sk-sectiontitle"></i><i class="sk sk-sub"></i></div><i class="sk sk-count"></i></div>',
    header: () => `<header class="sk-header"><i class="sk sk-brand"></i><div class="sk-header-nav">${repeat(6, () => '<i class="sk"></i>')}</div><div class="sk-header-actions"><i class="sk sk-circle"></i><i class="sk sk-circle"></i><i class="sk sk-menu sk-circle"></i></div></header>`,
    panel: () => `<section class="sk-surface sk-panel"><div class="sk-panel-head"><i class="sk sk-circle"></i><div><i class="sk"></i><i class="sk"></i></div></div><div class="sk-fields">${repeat(4, () => '<div class="sk-field"><i class="sk"></i><i class="sk"></i></div>')}<div class="sk-field sk-field--wide"><i class="sk"></i><i class="sk"></i></div></div></section>`,
    detail: () => `<div class="sk-detail"><section class="sk-surface sk-detail-summary"><div class="sk-detail-hero"><i class="sk sk-circle"></i><div>${line("xs", "30")}${line("lg", "70")}${line("", "50")}</div></div><div class="sk-detail-copy">${line("", "100")}${line("", "70")}</div><div class="sk-detail-facts">${repeat(3, () => `<div>${line("lg", "40")}${line("xs", "70")}</div>`)}</div></section><section class="sk-detail-copy">${parts.subhead()}${line("md", "70")}${line("", "40")}${line("", "60")}</section><section class="sk-detail-copy">${parts.subhead()}${line("", "60")}<div class="sk-tags"><i class="sk sk-pill"></i><i class="sk sk-pill"></i></div></section><div class="sk-detail-works">${repeat(2, () => '<i class="sk"></i>')}</div></div>`,
    chat: () => `<div class="sk-chat"><div class="sk-chat-list"><i class="sk sk-chat-search"></i>${repeat(6, parts.conversationRow)}</div><div class="sk-chat-pane"><i class="sk sk-art"></i>${line()}${line()}</div></div>`,
    subhead: () => `<div class="sk-subhead">${line()}${line()}</div>`,
  };

  const variants = {
    cards: count => `<div class="sk-grid sk-grid--cards">${repeat(count, parts.providerCard)}</div>`,
    requests: count => `<div class="sk-grid">${repeat(count, parts.request)}</div>`,
    bookings: count => `<div class="sk-list">${repeat(count, () => parts.bookingRow())}</div>`,
    listings: count => `<div class="sk-list">${repeat(count, parts.listing)}</div>`,
    conversations: count => `<div class="sk-chat-list">${repeat(count, parts.conversationRow)}</div>`,
    stats: count => `<div class="sk-stats">${repeat(count, parts.stat)}</div>`,
    notifications: count => `<div class="sk-notes">${repeat(count, () => `<div class="sk-note">${line("md", "60")}${line("", "90")}${line("xs", "30")}</div>`)}</div>`,
    profile: () => parts.panel(),
    detail: () => parts.detail(),
    list: count => `<div class="sk-list">${repeat(count, () => parts.bookingRow(true))}</div>`,
  };

  function markup({ count = 3, variant = "list", label = "Loading content" } = {}) {
    const key = Object.hasOwn(variants, variant) ? variant : "list";
    return `<div class="sk-stack sk-stack--${key}" role="status" aria-label="${escapeText(label)}"><div class="sk-contents" aria-hidden="true">${variants[key](count)}</div></div>`;
  }

  const active = new WeakMap();
  // Each region owns one loader. An old request cannot clear a newer request's busy state.
  function show(target, options = {}) {
    if (!target) return () => {};
    active.get(target)?.();
    const delay = options.delay ?? 150;
    let placeholder = null;
    let timer = null;
    let finished = false;
    const mount = () => {
      timer = null;
      if (finished || options.preserve) return;
      placeholder = document.createElement(target.tagName === "UL" || target.tagName === "OL" ? "li" : "div");
      placeholder.className = "content-loading-placeholder";
      placeholder.innerHTML = markup(options);
      target.append(placeholder);
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      timer = null;
      placeholder?.remove();
      placeholder = null;
      if (active.get(target) === finish) {
        active.delete(target);
        target.removeAttribute("aria-busy");
      }
    };
    active.set(target, finish);
    target.setAttribute("aria-busy", "true");
    if (delay > 0) timer = setTimeout(mount, delay);
    else mount();
    return finish;
  }

  // For reads only: the caller handles the rejection and owns the retry. No delayed render
  // is attached to the underlying request, so late responses cannot overwrite a retry.
  function withTimeout(request, milliseconds = 20000) {
    let timer;
    return Promise.race([
      Promise.resolve(request),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Loading timed out. Please try again.")), milliseconds); }),
    ]).finally(() => clearTimeout(timer));
  }

  const errorIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>';
  function errorMarkup({ title = "We couldn’t load this", message = "Check your connection and try again.", retryLabel = "Try again", linkHref = "", linkLabel = "", page = false } = {}) {
    return `<div class="sk-error sk-fade-in${page ? " sk-error--page" : ""}" role="alert"><span class="sk-error-icon">${errorIcon}</span><h2>${escapeText(title)}</h2><p>${escapeText(message)}</p><div class="sk-error-actions"><button class="button button-primary" type="button" data-loading-retry>${escapeText(retryLabel)}</button>${linkHref ? `<a class="button button-outline" href="${escapeText(linkHref)}">${escapeText(linkLabel)}</a>` : ""}</div></div>`;
  }
  // Renders an error with a retry button into target; focus moves to the retry button so keyboard users are not stranded.
  function showError(target, options = {}) {
    if (!target) return null;
    active.get(target)?.();
    target.removeAttribute("aria-busy");
    target.innerHTML = errorMarkup(options);
    const retry = target.querySelector("[data-loading-retry]");
    retry?.addEventListener("click", () => {
      if (typeof options.onRetry === "function") options.onRetry();
    });
    if (options.focus) retry?.focus();
    return target.querySelector(".sk-error");
  }

  const generic = () => `${parts.header()}<div class="sk-page">${parts.heading()}${variants.listings(3)}</div>`;
  const routes = {
    home: () => `${parts.header()}<div class="sk-page"><div class="discover-intro discover-welcome sk-welcome"><h1>Find Skills &amp; Services<br />from <span>Students Like You</span></h1><p>Get help, collaborate, and make campus life easier.</p><div class="discover-search sk-search"><i class="sk sk-line"></i><i class="sk sk-btn"></i></div><i class="sk dashboard-welcome-illustration sk-welcome-art"></i></div><div class="sk-discovery"><div class="sk-discovery-main"><div class="sk-chips">${repeat(6, () => '<i class="sk"></i>')}</div>${parts.sectionHead()}${variants.cards(6)}</div><aside class="sk-sidebar"><div class="sk-surface sk-side-card"><i class="sk sk-circle"></i>${line("", "50")}${line("md", "80")}${line("", "100")}${line("", "70")}</div><div class="sk-surface sk-side-card">${line("md", "50")}<div class="sk-side-rows">${repeat(3, () => `<div class="sk-side-row">${line("", "50")}<i class="sk sk-w-20"></i></div>`)}</div></div></aside></div></div>`,
    bookings: () => `${parts.header()}<div class="sk-page">${parts.heading({ action: true })}<div class="sk-seg"><i class="sk"></i><i class="sk"></i></div><div class="sk-tabs">${repeat(4, () => '<i class="sk"></i>')}</div>${variants.bookings(3)}</div>`,
    messages: () => `${parts.header()}<div class="sk-page">${parts.heading()}${parts.chat()}</div>`,
    saved: () => `${parts.header()}<div class="sk-page">${parts.heading()}${variants.cards(6)}</div>`,
    provider: () => `${parts.header()}<div class="sk-page sk-page--provider">${parts.heading({ action: true })}${variants.stats(4)}${parts.identity()}<div class="sk-surface sk-availability">${line("md", "40")}${line("xs", "60")}</div>${parts.subhead()}${variants.listings(2)}</div>`,
    earnings: () => `${parts.header()}<div class="sk-page">${parts.heading({ action: true })}<div class="sk-stats sk-stats--strip">${repeat(4, () => `<div class="sk-stat">${line()}${line()}</div>`)}</div><div class="sk-surface sk-total"><div class="sk-total-copy">${line()}${line()}${line()}</div><i class="sk sk-circle"></i></div>${parts.subhead()}${variants.listings(2)}</div>`,
    "profile-settings": () => `${parts.header()}<div class="sk-page sk-page--settings">${parts.heading()}<div class="sk-shortcuts"><i class="sk"></i><i class="sk"></i></div><div class="sk-surface sk-settings-intro">${parts.subhead()}<i class="sk sk-heading-action"></i></div><div class="sk-surface sk-settings-intro">${parts.subhead()}<i class="sk sk-heading-action"></i></div>${parts.panel()}</div>`,
    requests: () => `${parts.header()}<div class="sk-page">${parts.heading({ action: true })}${variants.requests(6)}</div>`,
    activity: () => `${parts.header()}<div class="sk-page">${parts.heading()}<div class="sk-grid">${repeat(2, () => `<section class="sk-surface sk-panel">${parts.subhead()}${repeat(3, () => `<div class="sk-side-row">${line("", "60")}<i class="sk sk-pill sk-w-20"></i></div>`)}</section>`)}</div></div>`,
    "help-support": generic,
  };

  function pageMarkup(route) {
    return (Object.hasOwn(routes, route) ? routes[route] : generic)();
  }

  // Builds the route-specific startup skeleton before first paint.
  function mountStartup(root = document.getElementById("dashboard-loading-skeleton"), hash = (window.location && window.location.hash) || "") {
    if (!root) return;
    const route = String(hash).replace(/^#/, "") || "home";
    root.innerHTML = `<div class="sk-contents" aria-hidden="true">${pageMarkup(route)}</div>`;
    root.setAttribute("aria-busy", "true");
    root.setAttribute("aria-label", "Loading your Skillmate workspace");
    root.dataset.skeletonRoute = Object.hasOwn(routes, route) ? route : "generic";
  }

  // Admin gate: sidebar, heading, overview stats and a table, mirroring admin.html.
  function adminMarkup() {
    const route = (window.location?.hash || "").slice(1);
    const body = route === "performance"
      ? `<section class="sk-surface sk-panel">${parts.subhead()}<div class="sk-admin-chart">${repeat(5, () => '<i></i>')}<svg viewBox="0 0 700 190" preserveAspectRatio="none" aria-hidden="true"><path d="M0 145 C80 125 120 155 210 100 S350 120 440 65 S590 85 700 30" /></svg></div></section>`
      : !route || route === "overview"
        ? `<div class="sk-admin-grid">${repeat(4, parts.stat)}</div><div class="sk-admin-shortcuts">${repeat(3, () => `<section class="sk-surface sk-panel">${parts.subhead()}${line("", "60")}</section>`)}</div>`
        : `<section class="sk-surface sk-admin-table">${repeat(6, () => `<div class="sk-admin-row">${line("", "80")}${line("", "60")}${line("", "70")}<i class="sk sk-pill"></i></div>`)}</section>`;
    return `<aside class="sk-admin-side"><i class="sk sk-admin-brand"></i>${repeat(7, () => '<i class="sk"></i>')}</aside><div class="sk-admin-main"><div class="sk-admin-top">${line("lg", "30")}<i class="sk sk-circle"></i></div><div class="sk-admin-content">${parts.heading()}${body}</div></div>`;
  }
  function mountAdmin(root = document.getElementById("admin-skeleton")) {
    if (root) { root.innerHTML = adminMarkup(); root.parentElement?.setAttribute("aria-busy", "true"); }
  }

  window.skillmateLoading = { markup, show, showError, withTimeout, errorMarkup, pageMarkup, mountStartup, mountAdmin };
  if (typeof document.getElementById === "function") { mountStartup(); mountAdmin(); }
  window.addEventListener?.("hashchange", () => {
    if (document.body.classList.contains("app-auth-pending")) mountStartup();
    if (document.body.classList.contains("admin-locked")) mountAdmin();
  });
})();
