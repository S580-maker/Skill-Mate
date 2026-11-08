(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.skillmateGrowthUtils = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  function matchesFilters(service, filters, hasSchedule = false) {
    const price = Number(service.price);
    const delivery = service.deliveryMethod || service.delivery_method || "";
    return (filters.min === "" || price >= Number(filters.min))
      && (filters.max === "" || price <= Number(filters.max))
      && (!filters.delivery || delivery === filters.delivery || delivery === "both")
      && (!filters.verified || service.verified === true)
      && (!filters.scheduled || hasSchedule);
  }
  function compareServices(left, right, sort) {
    if (sort === "price-low") return Number(left.price) - Number(right.price);
    if (sort === "price-high") return Number(right.price) - Number(left.price);
    if (sort === "rating") return Number(right.rating || 0) - Number(left.rating || 0);
    return 0;
  }
  function validSchedule(schedule) {
    try { new Intl.DateTimeFormat("en", { timeZone: schedule.timezone }).format(); } catch { return false; }
    return Number.isInteger(schedule.slot_minutes) && schedule.slot_minutes >= 15 && schedule.slot_minutes <= 240
      && schedule.slot_minutes % 15 === 0 && Array.isArray(schedule.weekly_hours)
      && schedule.weekly_hours.length <= 7
      && new Set(schedule.weekly_hours.map(day => day.day)).size === schedule.weekly_hours.length
      && schedule.weekly_hours.every(day => Number.isInteger(day.day) && day.day >= 0 && day.day <= 6
        && /^([01]\d|2[0-3]):[0-5]\d$/.test(day.start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(day.end)
        && minutes(day.end) - minutes(day.start) >= schedule.slot_minutes);
  }
  function minutes(time) { const [h, m] = time.split(":").map(Number); return h * 60 + m; }
  function zonedInstant(date, time, timezone) {
    const target = Date.parse(`${date}T${time}:00Z`);
    let stamp = target;
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    for (let pass = 0; pass < 3; pass++) {
      const parts = Object.fromEntries(formatter.formatToParts(stamp).map(part => [part.type, part.value]));
      const rendered = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
      if (rendered === target) return new Date(stamp);
      stamp += target - rendered;
    }
    return null; // A clock-change gap is not an appointment.
  }
  function slotsForDate(schedule, date, busy = [], now = Date.now()) {
    if (!validSchedule(schedule) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (schedule.blocked_dates || []).includes(date)) return [];
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const hours = schedule.weekly_hours.find(item => item.day === weekday);
    if (!hours) return [];
    const result = [];
    for (let minute = minutes(hours.start); minute + schedule.slot_minutes <= minutes(hours.end); minute += schedule.slot_minutes) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
      const instant = zonedInstant(date, time, schedule.timezone);
      if (!instant || instant.getTime() <= now) continue;
      const end = instant.getTime() + schedule.slot_minutes * 60000;
      if (busy.some(booking => ["Confirmed", "In progress", "confirmed"].includes(booking.status)
        && Date.parse(booking.scheduledAt || booking.scheduled_at) < end
        && Date.parse(booking.scheduledAt || booking.scheduled_at) + Number(booking.durationMinutes || booking.duration_minutes || 60) * 60000 > instant.getTime())) continue;
      result.push({ starts_at: instant.toISOString(), duration_minutes: schedule.slot_minutes });
    }
    return result;
  }
  function bookingProgress(booking, providerView) {
    if (["Cancelled", "Declined"].includes(booking.status)) return { step: -1, next: booking.status === "Cancelled" ? "This booking was cancelled." : "This request was declined. You can choose another provider." };
    if (booking.status === "Completed") return { step: 4, next: "Work completed. You can leave a review or book again." };
    if (booking.status === "Awaiting verification") return {
      step: 3,
      next: providerView ? "The client needs to verify that the work is complete." : "Your provider marked the work complete. Confirm when you are satisfied with the service.",
    };
    if (booking.status === "In progress" || booking.workStartedAt) return { step: 2, next: providerView ? "Mark complete when the agreed work is finished." : "Your provider has started the work." };
    if (booking.status === "Confirmed") return { step: 1, next: providerView ? "Start the work when the appointment begins." : "Your appointment is confirmed. Message your provider if plans change." };
    return { step: 0, next: booking.pendingAppointmentProposalId ? (providerView ? "Waiting for the customer to respond to your time suggestion." : "Please accept or decline the suggested time.") : providerView ? "Your reply is needed. Accept or decline this request." : "Waiting for the provider to confirm your request." };
  }
  function metrics(bookings) {
    const confirmed = bookings.filter(item => ["Confirmed", "In progress", "Awaiting verification", "Completed"].includes(item.status)).length;
    const completed = bookings.filter(item => item.status === "Completed");
    const counts = new Map();
    completed.forEach(item => { if (item.customerId) counts.set(item.customerId, (counts.get(item.customerId) || 0) + 1); });
    return { requests: bookings.length, confirmed, completed: completed.length, repeatCustomers: [...counts.values()].filter(count => count > 1).length };
  }
  return { matchesFilters, compareServices, validSchedule, zonedInstant, slotsForDate, bookingProgress, metrics };
});
