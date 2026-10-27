(() => {
  let offset = 0;
  let loading = false;
  const dialog = document.querySelector("#notifications-modal");
  const status = document.querySelector("#notifications-status");
  const list = document.querySelector("#notifications-list");
  const more = document.querySelector("#notifications-more");
  async function load({ reset = false } = {}) {
    if (loading) return;
    if (reset) { offset = 0; list.replaceChildren(); }
    loading = true;
    more.disabled = true;
    status.textContent = "Loading notifications…";
    try {
      const { data, error } = appSupabase
        ? await appSupabase.from("notifications").select("id, title, body, read_at, created_at")
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 9)
        : { data: [], error: null };
      if (error) throw error;
      for (const item of data || []) {
        const row = document.createElement("li");
        row.className = "notification-item";
        const title = document.createElement("h3");
        title.textContent = item.title;
        const body = document.createElement("p");
        body.textContent = item.body || "";
        const time = document.createElement("time");
        time.dateTime = item.created_at;
        time.textContent = new Date(item.created_at).toLocaleString();
        row.append(title, body, time);
        if (!item.read_at) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "button button-outline button-small";
          button.textContent = "Mark as read";
          button.setAttribute("aria-label", `Mark as read: ${item.title}`);
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              const { error } = await appSupabase.from("notifications")
                .update({ read_at: new Date().toISOString() }).eq("id", item.id);
              if (error) throw error;
              button.replaceWith(document.createTextNode("Read"));
              status.textContent = "Notification marked as read.";
            } catch {
              button.disabled = false;
              status.textContent = "Could not mark this notification as read. Please try again.";
            }
          });
          row.append(button);
        } else {
          row.append(document.createTextNode("Read"));
        }
        list.append(row);
      }
      offset += (data || []).length;
      more.hidden = (data || []).length < 10;
      more.textContent = "Load more";
      status.textContent = offset ? "Review your updates and mark them read individually." : "No notifications yet.";
    } catch {
      status.textContent = "Could not load notifications. Please try again.";
      more.hidden = false;
      more.textContent = "Try again";
    } finally {
      loading = false;
      more.disabled = false;
    }
  }
  document.querySelector("#notifications-button").addEventListener("click", () => {
    if (!dialog.open) dialog.showModal();
    load({ reset: true });
  });
  more.addEventListener("click", () => load());
})();
