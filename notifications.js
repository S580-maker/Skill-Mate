(() => {
  let offset = 0;
  let loading = false;
  let retryReset = false;
  const dialog = document.querySelector("#notifications-modal");
  const status = document.querySelector("#notifications-status");
  const list = document.querySelector("#notifications-list");
  const more = document.querySelector("#notifications-more");
  async function load({ reset = false } = {}) {
    if (loading) return;
    reset = reset || retryReset;
    const requestOffset = reset ? 0 : offset;
    loading = true;
    const finishLoading = typeof window !== "undefined" && window.skillmateLoading
      ? window.skillmateLoading.show(list, { count: 3, variant: "notifications", label: "Loading notifications", delay: 150, preserve: reset && list.children.length > 0 })
      : () => {};
    more.disabled = true;
    status.textContent = "Loading notifications…";
    try {
      let result = appSupabase
        ? await window.skillmateLoading.withTimeout(appSupabase.from("notifications").select("id, title, body, read_at, created_at, conversation_id, booking_id, target_path")
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(requestOffset, requestOffset + 9))
        : { data: [], error: null };
      if (result.error && ["42703", "PGRST204"].includes(result.error.code)) {
        console.warn("Booking-linked notifications are unavailable until the booking workflow migration is applied.", result.error);
        result = await window.skillmateLoading.withTimeout(appSupabase.from("notifications").select("id, title, body, read_at, created_at")
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(requestOffset, requestOffset + 9));
      }
      const { data, error } = result;
      if (error) throw error;
      finishLoading();
      if (reset) { offset = 0; list.replaceChildren(); }
      retryReset = false;
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
        if (item.target_path === "requests") {
          const open = document.createElement("button"); open.type = "button"; open.className = "button button-outline button-small"; open.textContent = "Open campus requests";
          open.addEventListener("click", () => { dialog.close(); showPage("requests"); }); row.append(open);
        }
        if (item.booking_id) {
          const open = document.createElement("button");
          open.type = "button";
          open.className = "button button-outline button-small";
          open.textContent = "Open booking";
          open.addEventListener("click", () => {
            dialog.close();
            document.dispatchEvent(new CustomEvent("skillmate:open-booking", {
              detail: { bookingId: item.booking_id },
            }));
          });
          row.append(open);
        }
        if (item.conversation_id) {
          const open = document.createElement("button");
          open.type = "button";
          open.className = "button button-outline button-small";
          open.textContent = "Open conversation";
          open.addEventListener("click", () => {
            dialog.close();
            document.dispatchEvent(new CustomEvent("skillmate:open-conversation", {
              detail: { conversationId: item.conversation_id },
            }));
          });
          row.append(open);
        }
        if (!item.read_at) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "button button-outline button-small";
          button.textContent = "Mark as read";
          button.setAttribute("aria-label", `Mark as read: ${item.title}`);
          button.addEventListener("click", () => {
            const previousReadAt = item.read_at;
            const readAt = new Date().toISOString();
            item.read_at = readAt;
            const readLabel = document.createTextNode("Read");
            button.replaceWith(readLabel);
            status.textContent = "Marking notification as read…";
            void (async () => {
              try {
                const { error } = await appSupabase.from("notifications")
                  .update({ read_at: readAt }).eq("id", item.id);
                if (error) throw error;
                status.textContent = "Notification marked as read.";
              } catch (error) {
                console.error("Could not mark the Skillmate notification as read.", error);
                item.read_at = previousReadAt;
                readLabel.replaceWith(button);
                status.textContent = "Could not mark this notification as read. Please try again.";
              }
            })();
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
      retryReset = reset;
      status.textContent = "Could not load notifications. Please try again.";
      more.hidden = false;
      more.textContent = "Try again";
    } finally {
      finishLoading();
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
