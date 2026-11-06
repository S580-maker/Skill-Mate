(() => {
  const callbackParams = new URLSearchParams(window.location.hash.slice(1));
  const queryParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = callbackParams.has("access_token")
    || callbackParams.has("error")
    || queryParams.has("code")
    || queryParams.has("error");
  if (!isOAuthCallback) return;

  const loginUrl = new URL("/login.html", window.location.origin);
  loginUrl.searchParams.set("skillmate-google-otp", "1");
  for (const parameter of ["code", "state", "next", "error", "error_description", "error_code"]) {
    if (queryParams.has(parameter)) loginUrl.searchParams.set(parameter, queryParams.get(parameter));
  }
  loginUrl.hash = window.location.hash;
  window.location.replace(loginUrl.href);
})();
