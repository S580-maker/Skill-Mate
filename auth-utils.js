// Pure helpers shared by the sign-in and password-recovery pages.
(function (root) {
  function maskEmail(email) {
    const [name, domain] = email.split("@");
    if (!name || !domain) return email;
    return `${name.slice(0, 1)}${"•".repeat(Math.min(Math.max(name.length - 1, 4), 7))}@${domain}`;
  }

  function getResendRetryDelay(response, error) {
    const retryAfter = response.headers?.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
    }
    const reset = Number(response.headers?.get("ratelimit-reset"));
    if (Number.isFinite(reset) && reset > 0) return Math.ceil(reset);
    const match = String(error).match(/wait\s+(\d+)\s+seconds?/i);
    return match ? Math.max(1, Number(match[1])) : 30;
  }

  async function requestAuth(url, options) {
    try {
      return await root.skillflexApi.request(url, options);
    } catch (error) {
      if (error?.name === "TimeoutError") {
        throw new Error("That request took too long. Check your connection, then try again.", { cause: error });
      }
      throw error;
    }
  }

  const api = { maskEmail, getResendRetryDelay, requestAuth };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.skillflexAuthUtils = api;
})(globalThis);
