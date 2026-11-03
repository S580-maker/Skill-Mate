self.addEventListener("push", (event) => {
  let notification = {};
  try {
    notification = event.data?.json() || {};
  } catch (error) {
    console.error("Could not read the Skillmate push notification.", error);
  }
  const title = typeof notification.title === "string" ? notification.title : "Skillmate";
  const body = typeof notification.body === "string" ? notification.body : "You have a new update.";
  const path = ["/index.html#bookings", "/index.html#messages", "/index.html#requests"].includes(notification.path)
    ? notification.path
    : "/";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    data: { path },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.path || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin) {
        await client.navigate(destination);
        return client.focus();
      }
    }
    return self.clients.openWindow(destination);
  })());
});
