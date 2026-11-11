/* Small HTTP boundary shared by session synchronization and future API callers. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.skillmateApi = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  /** @param {string | URL | Request} url @param {RequestInit} [options] @param {RequestConfig} [config] */
  async function request(url, options = {}, { fetch: transport = globalThis.fetch, timeout = 15000 } = {}) {
    const callerSignal = options.signal || (url instanceof Request ? url.signal : null);
    const signal = callerSignal ? AbortSignal.any([callerSignal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout);
    return transport(url, { ...options, signal });
  }
  /** @param {string | URL | Request} url @param {RequestInit} [options] @param {RequestConfig} [config] @returns {Promise<unknown>} */
  async function json(url, options = {}, config) {
    const response = await request(url, options, config);
    if (response.status === 204) return null;
    const body = await response.json().catch(() => {
      if (response.ok) throw new Error("The server returned an unreadable response. Please try again.");
      return null;
    });
    if (!response.ok) {
      const error = Object.assign(new Error(typeof body?.error === "string" ? body.error : "Your request could not be completed. Please try again."), {
        code: typeof body?.code === "string" ? body.code : "", status: response.status,
      });
      throw error;
    }
    return body;
  }
  return { request, json };
});
