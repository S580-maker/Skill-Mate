const sidebar = document.querySelector("#sidebar");
const menuToggle = document.querySelector("#menu-toggle");
const sidebarClose = document.querySelector("#sidebar-close");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");
const globalSearch = document.querySelector("#global-search");
const bookingSearch = document.querySelector("#booking-search");
const searchToggle = document.querySelector("#search-toggle");
function getBookingRows() {
  return [...document.querySelectorAll("#booking-rows tr")];
}
const emptyState = document.querySelector("#empty-state");
function applyAdminBookingSearch() {
  const query = globalSearch.value.trim().toLocaleLowerCase();
  const rows = getBookingRows();
  let visibleRows = 0;

  rows.forEach((row) => {
    const matches = (row.dataset.search || "").includes(query);
    row.hidden = !matches;
    if (matches) visibleRows += 1;
  });

  if (emptyState) {
    emptyState.hidden = visibleRows !== 0;
    emptyState.textContent = query
      ? `No bookings match “${globalSearch.value.trim()}”.`
      : "No bookings to display.";
  }
  const bookingsSummary = document.querySelector(".bookings-panel .panel-heading p");
  if (bookingsSummary) {
    bookingsSummary.textContent = query
      ? `Showing ${visibleRows} of ${rows.length} bookings`
      : `${rows.length} most recent bookings`;
  }
}
const toast = document.querySelector("#toast");
const adminViews = [...document.querySelectorAll(".admin-view")];
let toastTimer;
window.applyAdminBookingSearch = applyAdminBookingSearch;

function closeBookingSearch(clear = false, restoreFocus = false) {
  if (clear) globalSearch.value = "";
  bookingSearch.classList.remove("is-open");
  searchToggle.setAttribute("aria-expanded", "false");
  applyAdminBookingSearch();
  if (restoreFocus) searchToggle.focus();
}

searchToggle.addEventListener("click", () => {
  if (window.matchMedia("(max-width: 680px)").matches) {
    if (bookingSearch.classList.contains("is-open")) {
      closeBookingSearch(false, true);
      return;
    }
    bookingSearch.classList.add("is-open");
    searchToggle.setAttribute("aria-expanded", "true");
  }
  globalSearch.focus();
});

document.addEventListener("pointerdown", (event) => {
  if (window.matchMedia("(max-width: 680px)").matches
    && bookingSearch.classList.contains("is-open")
    && !bookingSearch.contains(event.target)) {
    closeBookingSearch();
  }
});

function showAdminView(requestedView = window.location.hash.slice(1) || "overview") {
  if (!adminViews.length) return;

  const target = document.getElementById(requestedView);
  const view = target?.closest(".admin-view") || adminViews.find((item) => item.id === requestedView);
  if (!view) return;

  adminViews.forEach((item) => { item.hidden = item !== view; });
  document.querySelectorAll(".side-nav .nav-link").forEach((link) => {
    const active = link.hash === `#${view.id}`;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  const activeLink = document.querySelector(`.side-nav .nav-link[href="#${view.id}"]`);
  const pageTitle = activeLink?.querySelector("span:not(.nav-count):not(.nav-dot)")?.textContent.trim()
    || view.querySelector("h1")?.textContent.trim();
  const breadcrumb = document.querySelector("#admin-page-title");
  if (breadcrumb && pageTitle) breadcrumb.textContent = pageTitle;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

menuToggle.addEventListener("click", () => {
  const isOpen = sidebar.classList.toggle("open");
  document.body.classList.toggle("sidebar-open", isOpen);
  sidebarBackdrop.hidden = !isOpen;
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  if (isOpen) sidebar.querySelector(".side-nav .nav-link").focus();
});

function closeSidebar(restoreFocus = false) {
  sidebar.classList.remove("open");
  document.body.classList.remove("sidebar-open");
  sidebarBackdrop.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  if (restoreFocus) menuToggle.focus();
}

sidebarClose.addEventListener("click", () => closeSidebar(true));
sidebarBackdrop.addEventListener("click", () => closeSidebar(true));

document.querySelectorAll(".side-nav .nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (adminViews.length) showAdminView(link.hash.slice(1));
    else {
      document.querySelectorAll(".side-nav .nav-link").forEach((item) => item.classList.remove("active"));
      link.classList.add("active");
    }
    closeSidebar(true);
  });
});

if (adminViews.length) {
  window.addEventListener("hashchange", () => showAdminView());
  showAdminView();
}

globalSearch.addEventListener("input", () => {
  if (globalSearch.value.trim() && window.location.hash !== "#bookings") {
    window.location.hash = "bookings";
    showAdminView("bookings");
  }
  applyAdminBookingSearch();
});

document.querySelector("#export-button").addEventListener("click", () => {
  const bookingRows = getBookingRows();
  if (!bookingRows.length) {
    showToast("There are no bookings to export.");
    return;
  }
  const rows = [
    ["Student", "Service", "Provider", "Date", "Type", "Status"],
    ...bookingRows.map((row) => {
      const cells = row.querySelectorAll("td");
      return [
        cells[0].querySelector("strong").textContent,
        cells[1].querySelector("strong").textContent,
        cells[1].querySelector("small").textContent,
        [...(cells[2].querySelector(".date-cell") || cells[2]).childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent).join("").trim(),
        cells[3].textContent.trim().replace(/\s+/g, " "),
        cells[4].textContent.trim(),
      ];
    }),
  ];
  const csv = window.skillflexCsv.encode(rows);
  const downloadUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = "skillflex-bookings.csv";
  downloadLink.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  showToast("Bookings report exported.");
});

document.querySelector("#period-select").addEventListener("change", (event) => {
  const days = event.target.value;
  if (typeof window.updateAdminChart === "function") {
    window.updateAdminChart(Number(days));
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (window.matchMedia("(max-width: 680px)").matches) {
      bookingSearch.classList.add("is-open");
      searchToggle.setAttribute("aria-expanded", "true");
    }
    globalSearch.focus();
  }
  if (event.key === "Escape") {
    if (bookingSearch.classList.contains("is-open")) closeBookingSearch(true, true);
    else if (sidebar.classList.contains("open")) closeSidebar(true);
  }
});
