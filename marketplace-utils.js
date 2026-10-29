(function (root, factory) {
  const utils = factory();
  if (typeof module === "object" && module.exports) module.exports = utils;
  else root.skillmateMarketplace = utils;
})(typeof window === "undefined" ? globalThis : window, function () {
  const categoryFamilies = {
    Repairs: ["Repairs", "Appliance repair", "Bike repair", "Home maintenance"],
    "Fashion & tailoring": ["Fashion & tailoring", "Clothing alterations"],
    Cleaning: ["Cleaning", "Laundry"],
    "Errands & delivery": ["Errands & delivery", "Moving help"],
  };
  const popularCategories = ["All", "Tech help", "Hair & beauty", "Tutoring", "Design", "Food"];
  function matchesCategory(category, selected) {
    return selected === "All" || (categoryFamilies[selected] || [selected]).includes(category);
  }
  function expandListings(providers, services) {
    return providers.flatMap(provider => {
      const active = services.filter(service => service.providerId === provider.id && service.active !== false);
      return active.length ? active.map(service => ({
        ...provider,
        serviceId: service.id, service: service.title, category: service.category,
        description: service.description, price: service.price, currency: service.currency,
        groups: service.groups, deliveryMethod: service.deliveryMethod || "",
        estimatedDelivery: service.estimatedDelivery || "", priceType: service.priceType || "fixed",
        coverImagePath: service.coverImagePath || "", coverImage: service.coverImage || "",
      })) : [provider];
    });
  }
  function bookingTimestamp(booking) {
    if (booking.scheduledAt) return new Date(booking.scheduledAt).getTime();
    const match = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i.exec(booking.time || "");
    let hours = match ? Number(match[1]) : 12;
    if (match?.[3]) hours = hours % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
    const date = new Date(`${booking.date}T${String(hours).padStart(2, "0")}:${match?.[2] || "00"}:00`);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }
  function filterBookings(bookings, { direction = "made", filter = "all", ownId, now = Date.now() }) {
    const filtered = bookings.filter(booking => {
      if ((booking.providerId === ownId) !== (direction === "received")) return false;
      if (filter === "upcoming") return ["Confirmed", "Pending"].includes(booking.status) && bookingTimestamp(booking) >= now;
      if (filter === "requests") return booking.status === "Pending";
      if (filter === "completed") return booking.status === "Completed";
      return true;
    });
    const rank = booking => direction === "received" && booking.status === "Pending" ? 0
      : ["Confirmed", "Pending"].includes(booking.status) && bookingTimestamp(booking) >= now ? 1
      : ["Confirmed", "Pending"].includes(booking.status) ? 2
      : booking.status === "Completed" ? 3 : 4;
    return filtered.sort((a, b) => rank(a) - rank(b)
      || (rank(a) <= 1 ? bookingTimestamp(a) - bookingTimestamp(b) : bookingTimestamp(b) - bookingTimestamp(a)));
  }
  function safeImageUrl(value) {
    if (typeof value !== "string") return "";
    if (/^data:image\/(png|webp|jpeg);base64,[a-z\d+/=]+$/i.test(value)) return value;
    try {
      const url = new URL(value);
      return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) ? url.href : "";
    } catch { return ""; }
  }
  return { categoryFamilies, popularCategories, matchesCategory, expandListings, filterBookings, safeImageUrl };
});
