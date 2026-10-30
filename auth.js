const authClient = window.skillmateSupabase;
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const passwordInput = document.querySelector("#auth-password");
const confirmPasswordInput = document.querySelector("#auth-confirm-password");
const passwordVisibility = document.querySelector("#password-visibility");
const confirmPasswordVisibility = document.querySelector("#confirm-password-visibility");
let authMode = "signin";
let authSubmitting = false;
let authRedirectStarted = false;
let googleOtpStarted = false;
let otpCountdownTimer = null;

function redirectForSession(session) {
  if (!session || authMode === "recovery") return;
  if (window.sessionStorage.getItem("skillmate-google-otp-active") === "1") return;
  if (window.sessionStorage.getItem("skillmate-google-otp-pending") === "1") {
    if (!googleOtpStarted) {
      googleOtpStarted = true;
      window.setTimeout(() => startGoogleOtp(session), 0);
    }
    return;
  }
  if (authSubmitting || authRedirectStarted) return;
  authRedirectStarted = true;
  window.location.replace(getPostAuthUrl());
}

async function startGoogleOtp(session) {
  const button = document.querySelector("#google-signin");
  authSubmitting = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  authMessage.textContent = "Sending your verification code…";
  try {
    const response = await fetch("/api/auth/google-2fa", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      credentials: "same-origin",
      body: JSON.stringify({
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not start Google verification.");
    window.sessionStorage.removeItem("skillmate-google-otp-pending");
    window.sessionStorage.setItem("skillmate-google-otp-active", "1");
    authMessage.textContent = "";
    showOtpChallenge(result.email);
  } catch (error) {
    console.error("Skillmate Google email verification failed.", error);
    window.sessionStorage.removeItem("skillmate-google-otp-pending");
    window.sessionStorage.removeItem("skillmate-google-otp-active");
    await authClient.auth.signOut({ scope: "local" }).catch((signOutError) => {
      console.error("Could not clear the unverified Google session.", signOutError);
    });
    authMessage.textContent = error.message || "Could not start Google verification. Please try again.";
  } finally {
    authSubmitting = false;
    googleOtpStarted = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

function isInvalidRefreshTokenError(error) {
  const code = (error?.code || "").toLowerCase();
  const message = (error?.message || "").toLowerCase();
  return code === "refresh_token_not_found"
    || message.includes("invalid refresh token")
    || message.includes("refresh token not found");
}

function setPasswordVisibility(input, button, visible, label) {
  input.type = visible ? "text" : "password";
  button.setAttribute("aria-label", `${visible ? "Hide" : "Show"} ${label}`);
  button.setAttribute("aria-pressed", String(visible));
  button.textContent = visible ? "Hide" : "Show";
}

function friendlyAuthError(error, mode) {
  const code = (error?.code || "").toLowerCase();
  const message = (error?.message || "").toLowerCase();
  if (isInvalidRefreshTokenError(error)) {
    return "Your sign-in session expired. Please sign in again.";
  }
  if (message.includes("redirect_uri_mismatch")) {
    return "Social sign-in is temporarily unavailable. Try signing in with email.";
  }
  if (code === "invalid_client" || message.includes("invalid_client")) {
    return "Social sign-in is temporarily unavailable. Try signing in with email.";
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
    return "Please confirm your email using the link we sent before signing in.";
  }
  if (["invalid_credentials", "user_not_found"].includes(code)
    || message.includes("invalid login credentials")
    || message.includes("user not found")) {
    return "We couldn’t sign you in with those details. Check your email and password, or create an account.";
  }
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "An account already exists with this email. Sign in or use Forgot password to recover it.";
  }
  if (code === "weak_password" || message.includes("password should be")) {
    return "Choose a password with at least 8 characters.";
  }
  if (code === "over_email_send_rate_limit" || message.includes("rate limit")) {
    return "Too many emails were requested. Please wait a little while and try again.";
  }
  if (mode === "recovery" && (!error?.message || message.includes("access_token"))) {
    return "This reset link is invalid or expired. Request a new password reset link.";
  }
  return "We couldn’t complete that request. Please try again.";
}

function updatePasswordHint() {
  const hint = document.querySelector("#password-hint");
  if (!hint.hidden) {
    const length = [...passwordInput.value].length;
    hint.textContent = length >= 8
      ? "Minimum met."
      : `Use at least 8 characters (${length}/8).`;
  }
}

function getPostAuthUrl() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next === "admin" ? "admin.html" : "index.html";
}

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 1)}${"•".repeat(Math.min(Math.max(name.length - 1, 4), 7))}@${domain}`;
}

function startOtpCountdown(seconds = 30) {
  const button = document.querySelector("#otp-resend");
  const label = document.querySelector("#otp-countdown");
  const prefix = document.querySelector("#otp-resend-prefix");
  window.clearInterval(otpCountdownTimer);
  let remaining = seconds;
  button.disabled = true;
  prefix.hidden = false;
  const update = () => {
    label.textContent = `0:${String(remaining).padStart(2, "0")}`;
    if (remaining <= 0) {
      window.clearInterval(otpCountdownTimer);
      button.disabled = false;
      prefix.hidden = true;
      label.textContent = "Resend code";
      return;
    }
    remaining -= 1;
  };
  update();
  otpCountdownTimer = window.setInterval(update, 1000);
}

function showOtpChallenge(email, signup = false) {
  const inputs = [...document.querySelectorAll(".auth-otp-inputs input")];
  document.body.dataset.authMode = "verification";
  document.querySelector("#auth-title").hidden = true;
  document.querySelector("#auth-intro").hidden = true;
  document.querySelector("#auth-tabs").hidden = true;
  authForm.hidden = true;
  document.querySelector("#auth-social-section").hidden = true;
  document.querySelector("#auth-note").hidden = true;
  document.querySelector(".auth-footer").hidden = true;
  document.querySelector("#otp-title").textContent = signup ? "Verify your email" : "Verify it’s you";
  document.querySelector("#otp-email").textContent = maskEmail(email);
  document.querySelector("#auth-otp").hidden = false;
  document.querySelector("#otp-message").textContent = "";
  document.querySelector("#auth-otp").classList.remove("is-error", "is-success");
  document.querySelector("#otp-message").classList.remove("success");
  inputs.forEach((input) => {
    input.value = "";
    input.disabled = false;
    input.classList.remove("otp-digit-entered");
  });
  updateOtpSubmitState(inputs);
  startOtpCountdown();
  inputs[0]?.focus();
}

function hideOtpChallenge() {
  window.clearInterval(otpCountdownTimer);
  otpCountdownTimer = null;
  document.body.dataset.authMode = authMode;
  document.querySelector("#auth-title").hidden = false;
  document.querySelector("#auth-intro").hidden = false;
  document.querySelector("#auth-tabs").hidden = false;
  authForm.hidden = false;
  document.querySelector("#auth-social-section").hidden = false;
  document.querySelector("#auth-note").hidden = false;
  document.querySelector(".auth-footer").hidden = false;
  document.querySelector("#auth-otp").hidden = true;
}

async function submitOtpCode(event) {
  event.preventDefault();
  if (authSubmitting) return;
  const inputs = [...document.querySelectorAll(".auth-otp-inputs input")];
  const code = inputs.map((input) => input.value).join("");
  if (!/^\d{6}$/.test(code)) {
    document.querySelector("#otp-message").textContent = "Enter all six digits to continue.";
    inputs.find((input) => !input.value)?.focus();
    return;
  }

  const challenge = document.querySelector("#auth-otp");
  const submit = document.querySelector("#otp-submit");
  const label = document.querySelector("#otp-submit-label");
  const message = document.querySelector("#otp-message");
  const spinner = submit.querySelector(".auth-submit-spinner");
  let verificationSucceeded = false;
  authSubmitting = true;
  submit.disabled = true;
  inputs.forEach((input) => { input.disabled = true; });
  submit.setAttribute("aria-busy", "true");
  spinner.hidden = false;
  label.textContent = "Verifying…";
  message.textContent = "";
  message.classList.remove("success");
  challenge.classList.remove("is-error");
  try {
    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ code }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not verify your code. Please try again.");
    if (result.provider === "google") {
      const { data, error } = await authClient.auth.getSession();
      let session = !error ? data.session : null;
      if (!session) {
        if (!result.session?.access_token || !result.session?.refresh_token) {
          throw error || new Error("Your Google sign-in expired. Please sign in with Google again.");
        }
        const restored = await authClient.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (restored.error) throw restored.error;
        session = restored.data.session;
      }
      if (!session) throw new Error("Your Google sign-in expired. Please sign in with Google again.");
      await window.syncSkillmateServerSession(session);
    } else {
      const { data, error } = await authClient.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (error) throw error;
      await window.syncSkillmateServerSession(data.session);
    }
    window.sessionStorage.removeItem("skillmate-google-otp-active");
    verificationSucceeded = true;
    challenge.classList.add("is-success");
    message.classList.add("success");
    message.textContent = "Code verified. Signing you in…";
    spinner.hidden = true;
    label.textContent = "Verified";
    inputs.forEach((input) => { input.classList.remove("otp-digit-entered"); });
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    window.location.assign(getPostAuthUrl());
  } catch (error) {
    console.error("Skillmate email verification failed.", error);
    challenge.classList.remove("is-success");
    challenge.classList.remove("is-error");
    void challenge.offsetWidth;
    challenge.classList.add("is-error");
    message.textContent = error.message || "Could not verify your code. Please try again.";
    inputs.forEach((input) => { input.disabled = false; });
    if (error.message?.includes("expired") || error.message?.includes("Sign in again")) {
      window.clearInterval(otpCountdownTimer);
      document.querySelector("#otp-resend").disabled = true;
    }
  } finally {
    authSubmitting = false;
    submit.removeAttribute("aria-busy");
    if (verificationSucceeded) {
      submit.disabled = true;
    } else {
      spinner.hidden = true;
      label.textContent = "Verify code";
      updateOtpSubmitState(inputs);
    }
  }
}

function updateOtpSubmitState(inputs = [...document.querySelectorAll(".auth-otp-inputs input")]) {
  const success = document.querySelector("#auth-otp").classList.contains("is-success");
  document.querySelector("#otp-submit").disabled = authSubmitting
    || success
    || !/^\d{6}$/.test(inputs.map((input) => input.value).join(""));
}

function animateOtpDigit(input) {
  input.classList.remove("otp-digit-entered");
  void input.offsetWidth;
  input.classList.add("otp-digit-entered");
}

function clearOtpError() {
  const challenge = document.querySelector("#auth-otp");
  challenge.classList.remove("is-error");
  document.querySelector("#otp-message").classList.remove("success");
  document.querySelector("#otp-message").textContent = "";
}

function fillOtpInputs(digits, startIndex, inputs) {
  [...digits].forEach((digit, offset) => {
    const input = inputs[startIndex + offset];
    if (!input) return;
    input.value = digit;
    animateOtpDigit(input);
  });
  updateOtpSubmitState(inputs);
}

document.querySelector("#otp-form").addEventListener("submit", submitOtpCode);
const otpInputs = [...document.querySelectorAll(".auth-otp-inputs input")];
otpInputs.forEach((input, index, inputs) => {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    if (digits.length > 1) {
      const startIndex = index === 0 ? 0 : index;
      fillOtpInputs(digits.slice(0, inputs.length - startIndex), startIndex, inputs);
      inputs[Math.min(startIndex + digits.length, inputs.length) - 1]?.focus();
      clearOtpError();
      return;
    }
    input.value = digits.slice(-1);
    if (input.value) animateOtpDigit(input);
    if (input.value && index < inputs.length - 1) inputs[index + 1].focus();
    clearOtpError();
    updateOtpSubmitState(inputs);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && index > 0) inputs[index - 1].focus();
    if (event.key === "ArrowLeft" && index > 0) inputs[index - 1].focus();
    if (event.key === "ArrowRight" && index < inputs.length - 1) inputs[index + 1].focus();
  });
  input.addEventListener("paste", (event) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, inputs.length);
    if (!digits) return;
    event.preventDefault();
    clearOtpError();
    const startIndex = digits.length === inputs.length ? 0 : index;
    if (startIndex + digits.length > inputs.length) return;
    fillOtpInputs(digits, startIndex, inputs);
    inputs[Math.min(startIndex + digits.length, inputs.length) - 1].focus();
  });
});

document.querySelector("#otp-resend").addEventListener("click", async () => {
  const button = document.querySelector("#otp-resend");
  const message = document.querySelector("#otp-message");
  if (button.disabled || authSubmitting) return;
  button.disabled = true;
  message.textContent = "";
  try {
    const response = await fetch("/api/auth/resend", { method: "POST", credentials: "same-origin" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not resend your code.");
    message.textContent = result.message;
    message.classList.add("success");
    startOtpCountdown();
  } catch (error) {
    message.classList.remove("success");
    message.textContent = error.message || "Could not resend your code.";
    button.disabled = false;
  }
});

document.querySelector("#otp-back").addEventListener("click", () => {
  fetch("/api/auth/sign-in", { method: "DELETE", credentials: "same-origin" }).catch(() => {});
  if (window.sessionStorage.getItem("skillmate-google-otp-active") === "1") {
    window.sessionStorage.removeItem("skillmate-google-otp-active");
    authClient.auth.signOut({ scope: "local" }).catch((error) => {
      console.error("Could not clear the unverified Google session.", error);
    });
  }
  hideOtpChallenge();
  document.querySelector("#auth-password").value = "";
  document.querySelector("#auth-email").focus();
});

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  const recovery = mode === "recovery";
  const signin = !signup && !recovery;
  document.body.dataset.authMode = mode;
  authForm.setAttribute("aria-labelledby", recovery ? "auth-title" : signup ? "signup-tab" : "signin-tab");
  document.querySelector("#signin-tab").tabIndex = signin ? 0 : -1;
  document.querySelector("#signup-tab").tabIndex = signup ? 0 : -1;
  document.querySelector("#auth-tabs").dataset.mode = signup ? "signup" : "signin";
  setPasswordVisibility(passwordInput, passwordVisibility, false, "password");
  setPasswordVisibility(confirmPasswordInput, confirmPasswordVisibility, false, "confirm password");
  document.title = signup ? "Create account | Skillmate" : recovery ? "Reset password | Skillmate" : "Sign in | Skillmate";
  document.querySelector("#auth-tabs").hidden = recovery;
  document.querySelector("#signin-tab").classList.toggle("active", signin);
  document.querySelector("#signup-tab").classList.toggle("active", signup);
  document.querySelector("#signin-tab").setAttribute("aria-selected", String(signin));
  document.querySelector("#signup-tab").setAttribute("aria-selected", String(signup));
  document.querySelector("#name-field").hidden = !signup;
  document.querySelector("#university-field").hidden = !signup;
  document.querySelector("#auth-name").required = signup;
  document.querySelector("#auth-university").required = signup;
  for (const id of ["auth-name", "auth-university"]) {
    document.getElementById(id).disabled = !signup;
  }
  document.querySelector("#confirm-password-field").hidden = !recovery;
  confirmPasswordInput.required = recovery;
  confirmPasswordInput.disabled = !recovery;
  if (!signup) confirmPasswordInput.value = "";
  document.querySelector("#auth-consent").required = signup;
  document.querySelector("#consent-field").hidden = !signup;
  document.querySelector("#google-signin").hidden = recovery;
  document.querySelector("#auth-social-section").hidden = recovery;
  document.querySelector("#forgot-password-link").hidden = !signin;
  document.querySelector("#password-hint").hidden = signin;
  document.querySelector("#auth-password").autocomplete = signin ? "current-password" : "new-password";
  document.querySelector("#auth-password").minLength = signin ? 0 : 8;
  document.querySelector("#password-label").textContent = recovery ? "New password" : "Password";
  document.querySelector("#auth-title").textContent = signup ? "Create your account" : recovery ? "Choose a new password" : "Welcome back.";
  document.querySelector("#auth-intro").textContent = recovery
    ? "Enter a new password for your Skillmate account."
    : signup
    ? "Just the basics. You can add a photo and verify your student status later."
    : "Your campus community is one sign-in away.";
  document.querySelector("#auth-submit-label").textContent = signup ? "Create account" : recovery ? "Save new password" : "Sign in";
  document.querySelector("#return-to-signin").hidden = !recovery;
  passwordInput.placeholder = signin ? "Enter your password" : "At least 8 characters";
  document.querySelector("#auth-note").textContent = signup
    ? "Use an email address you can access. You may be asked to confirm it."
    : recovery ? "Choose a password you have not used on another account."
    : "A space to find help, offer your skills, and get things done.";
  updatePasswordHint();
  authMessage.textContent = "";
  authMessage.classList.remove("success");
}

function loadGhanaianUniversities() {
  const directory = window.SKILLMATE_UNIVERSITY_DIRECTORY;
  const options = document.querySelector("#ghana-university-options");
  const status = document.querySelector("#university-directory-status");
  options.replaceChildren(...directory.fallback.map((university) => {
    const option = document.createElement("option");
    option.value = university;
    return option;
  }));
  status.textContent = "Choose a suggestion or type your university name.";
}

document.querySelector("#signin-tab").addEventListener("click", () => { if (!authSubmitting) setAuthMode("signin"); });
document.querySelector("#signup-tab").addEventListener("click", () => { if (!authSubmitting) setAuthMode("signup"); });
document.querySelector("#auth-tabs").addEventListener("keydown", (event) => {
  if (authSubmitting || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const mode = event.key === "Home" ? "signin" : event.key === "End" ? "signup" : authMode === "signin" ? "signup" : "signin";
  setAuthMode(mode);
  document.querySelector(mode === "signup" ? "#signup-tab" : "#signin-tab").focus();
});
passwordInput.addEventListener("input", updatePasswordHint);
passwordVisibility.addEventListener("click", () => {
  setPasswordVisibility(passwordInput, passwordVisibility, passwordInput.type === "password", "password");
});
confirmPasswordVisibility.addEventListener("click", () => {
  setPasswordVisibility(
    confirmPasswordInput,
    confirmPasswordVisibility,
    confirmPasswordInput.type === "password",
    "confirm password",
  );
});
async function signInWithGoogle(button) {
  if (!authClient || authSubmitting) return;
  const consent = document.querySelector("#auth-consent");
  if (!consent.checked) {
    document.querySelector("#consent-field").hidden = false;
    authMessage.textContent = "Agree to the Terms and Privacy Policy before continuing with Google.";
    consent.focus();
    return;
  }
  authSubmitting = true;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  authMessage.textContent = "";
  try {
    window.sessionStorage.setItem("skillmate-google-otp-pending", "1");
    const callbackUrl = new URL("login.html", window.location.href);
    if (new URLSearchParams(window.location.search).get("next") === "admin") {
      callbackUrl.searchParams.set("next", "admin");
    }
    const { error } = await authClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.href,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  } catch (error) {
    console.error("Skillmate Google sign-in failed.", error);
    window.sessionStorage.removeItem("skillmate-google-otp-pending");
    authMessage.textContent = friendlyAuthError(error, authMode);
    authSubmitting = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
document.querySelector("#google-signin").addEventListener("click", (event) => {
  signInWithGoogle(event.currentTarget);
});
document.querySelector("#return-to-signin").addEventListener("click", () => {
  window.history.replaceState(null, "", window.location.pathname);
  setAuthMode("signin");
});
loadGhanaianUniversities();
const requestedAuthMode = new URLSearchParams(window.location.search).get("mode");
setAuthMode(["signup", "recovery"].includes(requestedAuthMode) ? requestedAuthMode : "signin");
if (authClient) {
  window.skillmateRestoreSession().then(redirectForSession).catch((error) => {
    console.error("Could not restore the Skillmate sign-in session.", error);
    authMessage.textContent = "Could not check your sign-in session. Reload the page and try again.";
  });
}

authClient?.auth.onAuthStateChange((_event, session) => {
  redirectForSession(session);
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authSubmitting) return;
  if (!authClient) {
    authMessage.textContent = "Sign-in is temporarily unavailable. Please try again shortly.";
    return;
  }
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  const confirmPassword = confirmPasswordInput.value;
  const fullName = document.querySelector("#auth-name").value.trim();
  const university = document.querySelector("#auth-university").value.trim();
  const submit = document.querySelector("#auth-submit");
  const submitLabel = document.querySelector("#auth-submit-label");
  const submitSpinner = submit.querySelector(".auth-submit-spinner");
  if (authMode === "recovery" && password !== confirmPassword) {
    authMessage.textContent = "Your passwords do not match.";
    confirmPasswordInput.focus();
    return;
  }
  submit.disabled = true;
  authSubmitting = true;
  submit.setAttribute("aria-busy", "true");
  submitSpinner.hidden = false;
  submitLabel.textContent = authMode === "signup"
    ? "Creating your account…"
    : authMode === "recovery" ? "Saving your password…" : "Signing you in…";
  authMessage.textContent = "";

  try {
    if (authMode === "signup") {
      if (fullName.length < 2 || university.length < 2) {
        authMessage.textContent = "Enter your name and university to create an account.";
        return;
      }
      const response = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password, fullName, university }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || "Could not start account verification.");
        error.isSkillmateApiError = true;
        throw error;
      }
      passwordInput.value = "";
      showOtpChallenge(email, true);
    } else if (authMode === "recovery") {
      const { data: sessionData, error: sessionError } = await authClient.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new Error("This reset link is invalid or expired. Request a new password reset link.");
      const { error } = await authClient.auth.updateUser({ password });
      if (error) throw error;
      const { data: refreshedSession, error: refreshedSessionError } = await authClient.auth.getSession();
      if (refreshedSessionError) throw refreshedSessionError;
      await window.syncSkillmateServerSession(refreshedSession.session);
      window.location.assign("index.html");
    } else {
      const response = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(result.error || "Could not start email verification.");
        error.isSkillmateApiError = true;
        throw error;
      }
      passwordInput.value = "";
      showOtpChallenge(email);
    }
  } catch (error) {
    console.error("Skillmate authentication failed.", error);
    if (isInvalidRefreshTokenError(error)) {
      await window.clearExpiredSkillmateSession();
    }
    authMessage.textContent = error.isSkillmateApiError
      ? error.message
      : friendlyAuthError(error, authMode);
  } finally {
    submit.disabled = false;
    authSubmitting = false;
    submit.removeAttribute("aria-busy");
    submitSpinner.hidden = true;
    submitLabel.textContent = authMode === "signup"
      ? "Create account"
      : authMode === "recovery" ? "Save new password" : "Sign in";
  }
});

if (!authClient) {
  console.error("Skillmate sign-in unavailable:", window.skillmateSupabaseError);
  authMessage.textContent = "Sign-in is temporarily unavailable. Please try again shortly.";
}
