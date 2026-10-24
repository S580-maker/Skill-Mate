const sidebar = document.querySelector("#sidebar");
const menuToggle = document.querySelector("#menu-toggle");
const sidebarClose = document.querySelector("#sidebar-close");
const sidebarBackdrop = document.querySelector("#sidebar-backdrop");
const globalSearch = document.querySelector("#global-search");
function getBookingRows() {
  return [...document.querySelectorAll("#booking-rows tr")];
}
const emptyState = document.querySelector("#empty-state");
const toast = document.querySelector("#toast");
let toastTimer;

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
    document.querySelectorAll(".side-nav .nav-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
    closeSidebar(true);
  });
});

globalSearch.addEventListener("input", () => {
  const query = globalSearch.value.trim().toLocaleLowerCase();
  let visibleRows = 0;

  getBookingRows().forEach((row) => {
    const matches = (row.dataset.search || "").includes(query);
    row.hidden = !matches;
    if (matches) visibleRows += 1;
  });

  emptyState.hidden = visibleRows !== 0;
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
        `${cells[2].childNodes[0].textContent.trim()} ${cells[2].querySelector("small").textContent}`,
        cells[3].textContent.trim().replace(/\s+/g, " "),
        cells[4].textContent.trim(),
      ];
    }),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const downloadUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const downloadLink = document.createElement("a");
  downloadLink.href = downloadUrl;
  downloadLink.download = "skillmate-bookings.csv";
  downloadLink.click();
  URL.revokeObjectURL(downloadUrl);
  showToast("Bookings report exported.");
});

document.querySelectorAll(".review-button").forEach((button) => {
  button.addEventListener("click", () => {
    showToast(`Verification review for ${button.previousElementSibling.previousElementSibling.textContent} is coming soon.`);
  });
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
    globalSearch.focus();
  }
  if (event.key === "Escape") {
    if (sidebar.classList.contains("open")) closeSidebar(true);
  }
});
