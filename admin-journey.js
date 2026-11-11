/* Aggregate discovery activity. The RPC enforces verified administrator access. */
(() => {
  const panel = document.querySelector("#journey-metrics");
  const status = document.querySelector("#journey-status");
  const button = document.querySelector("#journey-refresh");
  if (!panel || !button) return;
  const stages = { discover: "Discover", search: "Search", profile_open: "Provider profiles", booking_open: "Booking forms", booking_sent: "Requests sent" };
  let busy = false;
  async function refresh() {
    if (busy || !window.skillflexSupabase) return;
    busy = true; button.disabled = true;
    status.textContent = "Loading activity…";
    panel.setAttribute("aria-busy", "true");
    try {
      const { data, error } = await withAdminTimeout(window.skillflexSupabase.rpc("read_marketplace_journey"), "Activity took too long to load.");
      if (error) throw error;
      panel.replaceChildren();
      for (const [event, label] of Object.entries(stages)) {
        const item = document.createElement("p");
        const count = document.createElement("strong");
        count.textContent = String(Number((data || []).find(row => row.event_name === event)?.students) || 0);
        item.append(document.createTextNode(`${label}: `), count); panel.append(item);
      }
      status.textContent = "Unique students per stage over the last 14 days. Stages may occur in a different order; these are activity counts, not a conversion rate. Browser privacy preferences are respected.";
    } catch (error) {
      status.textContent = ["PGRST202", "42883"].includes(error.code)
        ? "Activity reporting will be available after the marketplace journey database migration is applied."
        : "Activity could not load. Try refreshing this panel.";
    } finally { busy = false; button.disabled = false; panel.removeAttribute("aria-busy"); }
  }
  button.addEventListener("click", refresh);
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains("admin-ready")) { observer.disconnect(); void refresh(); }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  if (document.body.classList.contains("admin-ready")) { observer.disconnect(); void refresh(); }
})();
