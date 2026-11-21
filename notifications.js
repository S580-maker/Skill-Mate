(() => {
  let offset = 0;
  let loading = false;
  let retryReset = false;
  const dialog = document.querySelector("#notifications-modal");
  const status = document.querySelector("#notifications-status");
  const list = document.querySelector("#notifications-list");
  const more = document.querySelector("#notifications-more");
  let unreadCount = null;
  let unreadUserId = null;
  let unreadCountRequest = 0;
  let ringTimer = null;

  function renderUnreadCount(count, ring = false) {
    const button = document.querySelector("#notifications-button");
    let badge = button.querySelector?.(".notification-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "notification-count";
      badge.setAttribute("aria-hidden", "true");
      button.append(badge);
    }
    badge.hidden = count === 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    button.setAttribute("aria-label", count ? `Notifications, ${count} unread` : "Notifications");
    if (!ring || count === 0) return;

    button.classList.remove("is-ringing");
    void button.offsetWidth;
    button.classList.add("is-ringing");
    window.clearTimeout(ringTimer);
    ringTimer = window.setTimeout(() => {
      button.classList.remove("is-ringing");
      ringTimer = null;
    }, 1000);
  }

  async function refreshUnreadCount() {
    if (!appSupabase || typeof appUser === "undefined" || !appUser?.id) {
      unreadCountRequest++;
      unreadCount = null;
      unreadUserId = null;
      renderUnreadCount(0);
      return;
    }
    const userId = appUser.id;
    if (unreadUserId !== userId) {
      unreadUserId = userId;
      unreadCount = null;
    }
    const requestId = ++unreadCountRequest;
    try {
      let notificationCount = 0;
      let messageCount = 0;
      const combined = typeof appSupabase.rpc === "function"
        ? await appSupabase.rpc("skillmate_unread_counts")
        : { error: new Error("RPC unavailable"), data: null };
      if (!combined.error) {
        const row = Array.isArray(combined.data) ? combined.data[0] : combined.data;
        notificationCount = Number(row?.notification_count || 0);
        messageCount = Number(row?.message_count || 0);
      } else {
        const [notificationResult, messageResult] = await Promise.all([
          appSupabase.from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .neq("kind", "message")
            .is("read_at", null),
          appSupabase.from("messages")
            .select("id", { count: "exact", head: true })
            .neq("sender_id", userId)
            .is("read_at", null),
        ]);
        if (notificationResult.error) throw notificationResult.error;
        if (messageResult.error) throw messageResult.error;
        notificationCount = Number.isFinite(notificationResult.count) ? notificationResult.count : 0;
        messageCount = Number.isFinite(messageResult.count) ? messageResult.count : 0;
      }
      if (requestId !== unreadCountRequest || userId !== appUser?.id) return;
      const nextCount = Math.max(0, notificationCount) + Math.max(0, messageCount);
      const shouldRing = unreadCount !== null && nextCount > unreadCount;
      unreadCount = nextCount;
      renderUnreadCount(nextCount, shouldRing);
    } catch (error) {
      console.error("Could not refresh the unread notification count.", error);
    }
  }

  function resetSwipe(row, content) {
    row.classList.remove("is-swiping");
    delete row.dataset.swipe;
    content.style.removeProperty("--swipe-distance");
    content.style.removeProperty("--swipe-y");
  }

  function renderNotificationActions(item, row, actions, content) {
    actions.replaceChildren();
    if (!item.read_at) {
      const readButton = document.createElement("button");
      readButton.type = "button";
      readButton.className = "button button-outline button-small";
      readButton.textContent = "Mark as read";
      readButton.setAttribute("aria-label", `Mark as read: ${item.title}`);
      readButton.addEventListener("click", () => { void markNotificationRead(item, row, actions, content); });
      actions.append(readButton);
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "button button-outline button-small notification-delete";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete notification: ${item.title}`);
    deleteButton.addEventListener("click", () => { void deleteNotification(item, row, content); });
    actions.append(deleteButton);
  }

  async function markNotificationRead(item, row, actions, content) {
    const userId = typeof appUser === "undefined" ? null : appUser?.id;
    if (!appSupabase || !userId || item.read_at || row.dataset.saving === "true") return;

    const previousReadAt = item.read_at;
    const previousCount = unreadCount;
    const readAt = new Date().toISOString();
    row.dataset.saving = "true";
    row.classList.add("is-saving");
    item.read_at = readAt;
    row.classList.add("is-read");
    renderNotificationActions(item, row, actions, content);
    if (item.kind !== "message" && unreadCount !== null) {
      unreadCount = Math.max(0, unreadCount - 1);
      renderUnreadCount(unreadCount);
    }

    try {
      if (item.kind === "message" && item.conversation_id) {
        const { error: messageError } = await appSupabase.from("messages")
          .update({ read_at: readAt })
          .eq("conversation_id", item.conversation_id)
          .neq("sender_id", userId)
          .is("read_at", null);
        if (messageError) throw messageError;
      }
      const { data, error } = await appSupabase.from("notifications")
        .update({ read_at: readAt })
        .eq("user_id", userId)
        .eq("id", item.id)
        .select("id")
        .is("read_at", null);
      if (error) throw error;
      if (!data?.length) throw new Error("The notification was not updated.");
      if (appUser?.id === userId) {
        status.textContent = "Notification marked as read.";
        void refreshUnreadCount();
      }
    } catch (error) {
      console.error("Could not mark this notification as read.", error);
      item.read_at = previousReadAt;
      row.classList.remove("is-read");
      renderNotificationActions(item, row, actions, content);
      if (appUser?.id === userId && previousCount !== null) {
        unreadCount = previousCount;
        renderUnreadCount(unreadCount);
      }
      if (item.kind === "message") void refreshUnreadCount();
      status.textContent = "Could not mark this notification as read. Try again.";
    } finally {
      delete row.dataset.saving;
      row.classList.remove("is-saving");
      resetSwipe(row, content);
    }
  }

  async function deleteNotification(item, row, content) {
    const userId = typeof appUser === "undefined" ? null : appUser?.id;
    if (!appSupabase || !userId || row.dataset.saving === "true") return;

    const wasUnread = !item.read_at;
    const previousCount = unreadCount;
    const previousOffset = offset;
    const parent = row.parentElement;
    const nextSibling = row.nextSibling;
    row.dataset.saving = "true";
    row.classList.add("is-saving");
    row.remove();
    offset = Math.max(0, offset - 1);
    if (wasUnread && item.kind !== "message" && unreadCount !== null) {
      unreadCount = Math.max(0, unreadCount - 1);
      renderUnreadCount(unreadCount);
    }

    try {
      const { data, error } = await appSupabase.from("notifications").delete()
        .eq("user_id", userId)
        .eq("id", item.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("The notification was not deleted.");
      status.textContent = "Notification deleted.";
      if (wasUnread || item.kind === "message") void refreshUnreadCount();
      if (!list.children.length && offset === 0) status.textContent = "No notifications yet.";
    } catch (error) {
      console.error("Could not delete this notification.", error);
      offset = previousOffset;
      if (parent) parent.insertBefore(row, nextSibling?.parentElement === parent ? nextSibling : null);
      row.classList.remove("is-saving");
      delete row.dataset.saving;
      if (wasUnread && item.kind !== "message" && appUser?.id === userId && previousCount !== null) {
        unreadCount = previousCount;
        renderUnreadCount(unreadCount);
      }
      resetSwipe(row, content);
      status.textContent = "Could not delete this notification. Try again.";
    }
  }

  function enableNotificationSwipe(row, item, content) {
    let gesture = null;
    row.addEventListener("pointerdown", event => {
      if (!event.isPrimary || event.button > 0 || event.target.closest?.("button")) return;
      gesture = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, horizontal: false, vertical: false };
      row.classList.add("is-swiping");
      row.setPointerCapture?.(event.pointerId);
    });
    row.addEventListener("pointermove", event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - gesture.x;
      const deltaY = event.clientY - gesture.y;
      if (deltaY > 8 && deltaY > Math.abs(deltaX) * 1.2) {
        gesture.vertical = true;
        row.dataset.swipe = "down";
        content.style.setProperty("--swipe-distance", "0px");
        content.style.setProperty("--swipe-y", `${Math.max(0, Math.min(132, deltaY))}px`);
      } else if (Math.abs(deltaX) >= 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        gesture.horizontal = true;
        row.dataset.swipe = deltaX > 0 ? "right" : "left";
        content.style.setProperty("--swipe-distance", `${Math.max(-132, Math.min(132, deltaX))}px`);
      }
      if (event.cancelable) event.preventDefault();
    });
    const finishGesture = event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - gesture.x;
      const deltaY = event.clientY - gesture.y;
      const shouldDismiss = gesture.vertical && deltaY >= 80
        && deltaY > Math.abs(deltaX) * 1.2;
      const shouldAct = gesture.horizontal && Math.abs(deltaX) >= 80
        && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
      gesture = null;
      row.classList.remove("is-swiping");
      if (shouldDismiss) {
        row.dataset.swipe = "down";
        content.style.setProperty("--swipe-y", "132px");
        void deleteNotification(item, row, content);
        return;
      }
      if (!shouldAct) {
        resetSwipe(row, content);
        return;
      }
      row.dataset.swipe = deltaX > 0 ? "right" : "left";
      content.style.setProperty("--swipe-distance", deltaX > 0 ? "132px" : "-132px");
      if (deltaX > 0) {
        if (item.read_at) resetSwipe(row, content);
        else void markNotificationRead(item, row, row.querySelector(".notification-actions"), content);
      } else {
        void deleteNotification(item, row, content);
      }
    };
    row.addEventListener("pointerup", finishGesture);
    row.addEventListener("pointercancel", event => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gesture = null;
      resetSwipe(row, content);
    });
  }

  async function load({ reset = false } = {}) {
    if (loading) return;
    reset = reset || retryReset;
    const requestOffset = reset ? 0 : offset;
    loading = true;
    const finishLoading = typeof window !== "undefined" && window.skillflexLoading
      ? window.skillflexLoading.show(list, { count: 3, variant: "notifications", label: "Loading notifications", delay: 150, preserve: reset && list.children.length > 0 })
      : () => {};
    more.disabled = true;
    status.textContent = "Loading notifications…";
    try {
      let result = appSupabase
        ? await appSupabase.from("notifications").select("id, kind, title, body, read_at, created_at, conversation_id, booking_id, target_path")
          .eq("user_id", appUser.id)
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 9)
        : { data: [], error: null };
      if (result.error && ["42703", "PGRST204"].includes(result.error.code)) {
        console.warn("Booking-linked notifications are unavailable until the booking workflow migration is applied.", result.error);
        result = await appSupabase.from("notifications").select("id, kind, title, body, read_at, created_at")
          .eq("user_id", appUser.id)
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 9);
      }
      const { data, error } = result;
      if (error) throw error;
      finishLoading();
      const items = data || [];
      const conversationIds = [...new Set(items
        .filter(item => item.kind === "message" && item.conversation_id)
        .map(item => item.conversation_id))];
      let unreadMessageCounts = new Map();
      if (conversationIds.length && appSupabase && appUser?.id) {
        const unreadMessages = await appSupabase.from("messages").select("conversation_id")
          .in("conversation_id", conversationIds)
          .neq("sender_id", appUser.id)
          .is("read_at", null);
        if (unreadMessages.error) throw unreadMessages.error;
        unreadMessageCounts = (unreadMessages.data || []).reduce((counts, message) => {
          counts.set(message.conversation_id, (counts.get(message.conversation_id) || 0) + 1);
          return counts;
        }, new Map());
      }
      for (const item of items) {
        const row = document.createElement("li");
        row.className = "notification-item";
        row.dataset.notificationId = item.id;
        if (item.read_at) row.classList.add("is-read");
        const content = document.createElement("div");
        content.className = "notification-content";
        const title = document.createElement("h3");
        title.textContent = item.title;
        const body = document.createElement("p");
        const unreadMessages = item.kind === "message"
          ? unreadMessageCounts.get(item.conversation_id) || 0
          : 0;
        body.textContent = item.kind === "message"
          ? unreadMessages
            ? `${unreadMessages} unread ${unreadMessages === 1 ? "message" : "messages"} in this conversation.`
            : "Open the conversation to view the latest message."
          : item.body || "";
        const time = document.createElement("time");
        time.dateTime = item.created_at;
        time.textContent = new Date(item.created_at).toLocaleString();
        content.append(title, body, time);
        if (item.target_path === "requests") {
          const open = document.createElement("button"); open.type = "button"; open.className = "button button-outline button-small"; open.textContent = "Open campus requests";
          open.addEventListener("click", () => { dialog.close(); showPage("requests"); }); content.append(open);
        }
        if (item.booking_id) {
          const open = document.createElement("button");
          open.type = "button";
          open.className = "button button-outline button-small";
          open.textContent = "Open booking";
          open.addEventListener("click", () => {
            dialog.close();
            document.dispatchEvent(new CustomEvent("skillflex:open-booking", {
              detail: { bookingId: item.booking_id },
            }));
          });
          content.append(open);
        }
        if (item.conversation_id) {
          const open = document.createElement("button");
          open.type = "button";
          open.className = "button button-outline button-small";
          open.textContent = "Open conversation";
          open.addEventListener("click", () => {
            dialog.close();
            document.dispatchEvent(new CustomEvent("skillflex:open-conversation", {
              detail: { conversationId: item.conversation_id },
            }));
          });
          content.append(open);
        }
        const actions = document.createElement("div");
        actions.className = "notification-actions";
        renderNotificationActions(item, row, actions, content);
        content.append(actions);
        row.append(content);
        enableNotificationSwipe(row, item, content);
        list.append(row);
      }
      offset += (data || []).length;
      more.hidden = (data || []).length < 10;
      more.textContent = "Load more";
      status.textContent = offset ? "Swipe right to read, left or down to dismiss." : "No notifications yet.";
      void refreshUnreadCount();
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
    void refreshUnreadCount();
    load({ reset: true });
  });
  more.addEventListener("click", () => load());

  if (typeof window !== "undefined") {
    document.addEventListener("skillmate:session-ready", refreshUnreadCount);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void refreshUnreadCount();
    });
    window.setInterval(() => {
      if (!document.hidden) void refreshUnreadCount();
    }, 60000);
  }
})();
