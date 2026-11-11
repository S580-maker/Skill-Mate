/* Shared presentation rules; database RPCs remain authoritative for permissions. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.skillmateBookingPolicy = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  /** @param {BookingStatus} action @param {boolean} providerView @returns {BookingStatus} */
  function localStatus(action, providerView) {
    return action === "Completed" && providerView ? "Awaiting verification" : action;
  }
  /** @param {BookingSummary} booking @param {boolean} providerView */
  function nextStep(booking, providerView) {
    if (booking.pendingAppointmentProposalId && ["Pending", "Confirmed"].includes(booking.status)) return {
      owner: providerView ? "Customer" : "You", text: providerView ? "Waiting for the customer to review your suggested time." : "Review the suggested time before this booking can be confirmed.",
    };
    switch (booking.status) {
      case "Pending": return { owner: providerView ? "You" : "Provider", text: providerView ? "Accept or decline this request." : "Your provider needs to confirm your request." };
      case "Confirmed": return { owner: providerView ? "You" : "Provider", text: providerView ? "Start work when the appointment begins." : "Your appointment is confirmed. Your provider will start the work." };
      case "In progress": return { owner: providerView ? "You" : "Provider", text: providerView ? "Mark complete when the agreed work is finished." : "Your provider is working on the agreed service." };
      case "Awaiting verification": return { owner: providerView ? "Customer" : "You", text: providerView ? "The customer needs to verify the finished work." : "Confirm completion when you are satisfied with the agreed work." };
      case "Completed": return { owner: "Complete", text: providerView ? "The customer verified completion." : booking.reviewed ? "Thank you for reviewing this service." : "Share a review of your completed booking." };
      default: return { owner: "Closed", text: booking.status === "Declined" ? "This request was declined. You can choose another provider." : "This booking was cancelled." };
    }
  }
  return { localStatus, nextStep };
});
