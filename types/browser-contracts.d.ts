type BookingStatus = 'Pending' | 'Confirmed' | 'In progress' | 'Awaiting verification' | 'Completed' | 'Cancelled' | 'Declined';
interface BookingSummary {
  status: BookingStatus;
  pendingAppointmentProposalId?: string | null;
  reviewed?: boolean;
}
interface RequestConfig {
  fetch?: typeof fetch;
  timeout?: number;
}
declare var skillflexBookingPolicy: {
  localStatus(action: BookingStatus, providerView: boolean): BookingStatus;
  nextStep(booking: BookingSummary, providerView: boolean): { owner: string; text: string };
};
declare var skillflexApi: {
  request(url: string | URL | Request, options?: RequestInit, config?: RequestConfig): Promise<Response>;
  json(url: string | URL | Request, options?: RequestInit, config?: RequestConfig): Promise<unknown>;
};
