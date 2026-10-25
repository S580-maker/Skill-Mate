const authClient = window.skillmateSupabase;
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const passwordInput = document.querySelector("#auth-password");
const passwordVisibility = document.querySelector("#password-visibility");
let authMode = "signin";
let authSubmitting = false;

function isInvalidRefreshTokenError(error) {
  const code = (error?.code || "").toLowerCase();
  const message = (error?.message || "").toLowerCase();
  return code === "refresh_token_not_found"
    || message.includes("invalid refresh token")
    || message.includes("refresh token not found");
}

function setPasswordVisibility(visible) {
  passwordInput.type = visible ? "text" : "password";
  passwordVisibility.setAttribute("aria-label", `${visible ? "Hide" : "Show"} password`);
  passwordVisibility.setAttribute("aria-pressed", String(visible));
  passwordVisibility.querySelector("svg").innerHTML = visible
    ? '<path d="M3 3 21 21M10.6 10.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c6.2 0 9.5 7 9.5 7a16 16 0 0 1-2.2 3.1M6.2 6.3C3.8 8 2.5 12 2.5 12s3.3 7 9.5 7c1.2 0 2.3-.2 3.2-.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.7"/>';
}

function friendlyAuthError(error, mode) {
  const code = (error?.code || "").toLowerCase();
  const message = (error?.message || "").toLowerCase();
  if (isInvalidRefreshTokenError(error)) {
    return "Your sign-in session expired. Please sign in again.";
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

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  const recovery = mode === "recovery";
  const signin = !signup && !recovery;
  document.querySelector("#auth-tabs").dataset.mode = signup ? "signup" : "signin";
  setPasswordVisibility(false);
  document.title = signup ? "Create account | Skillmate" : recovery ? "Reset password | Skillmate" : "Sign in | Skillmate";
  document.querySelector("#auth-tabs").hidden = recovery;
  document.querySelector("#signin-tab").classList.toggle("active", signin);
  document.querySelector("#signup-tab").classList.toggle("active", signup);
  document.querySelector("#signin-tab").setAttribute("aria-selected", String(signin));
  document.querySelector("#signup-tab").setAttribute("aria-selected", String(signup));
  document.querySelector("#name-field").hidden = !signup;
  document.querySelector("#university-field").hidden = !signup;
  document.querySelector("#student-id-field").hidden = !signup;
  document.querySelector("#auth-name").required = signup;
  document.querySelector("#auth-university").required = signup;
  document.querySelector("#auth-student-id").required = signup;
  document.querySelector("#auth-consent").required = signup;
  document.querySelector("#consent-field").hidden = false;
  document.querySelector("#google-signin").hidden = recovery;
  document.querySelector("#forgot-password-link").hidden = !signin;
  document.querySelector("#password-hint").hidden = signin;
  document.querySelector("#auth-password").autocomplete = signin ? "current-password" : "new-password";
  document.querySelector("#auth-password").minLength = signin ? 0 : 8;
  document.querySelector("#password-label").textContent = recovery ? "New password" : "Password";
  document.querySelector("#auth-title").textContent = signup ? "Create your account" : recovery ? "Choose a new password" : "Welcome to Skillmate";
  document.querySelector("#auth-intro").textContent = recovery
    ? "Enter a new password for your Skillmate account."
    : signup
    ? "Create one account to find services and offer your own skills. Add your university and student ID number; it will be stored privately but is not automatically verified."
    : "Sign in to find services, manage bookings, or earn with your skills.";
  document.querySelector("#auth-submit-label").textContent = signup ? "Create account" : recovery ? "Save new password" : "Sign in";
  document.querySelector("#return-to-signin").hidden = !recovery;
  updatePasswordHint();
  authMessage.textContent = "";
  authMessage.classList.remove("success");
}

async function loadGhanaianUniversities() {
  const directory = window.SKILLMATE_UNIVERSITY_DIRECTORY;
  const options = document.querySelector("#ghana-university-options");
  const status = document.querySelector("#university-directory-status");
  let universities = directory.fallback;
  const renderOptions = () => {
    options.replaceChildren(...universities.map((university) => {
      const option = document.createElement("option");
      option.value = university;
      return option;
    }));
  };
  renderOptions();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(directory.endpoint, { signal: controller.signal });
    if (!response.ok) throw new Error(`University directory returned HTTP ${response.status}.`);
    const results = await response.json();
    const fetched = results
      .filter((university) => university.country === "Ghana" && university.name)
      .map((university) => university.name.trim())
      .filter(Boolean);
    if (!fetched.length) throw new Error("University directory returned no Ghanaian institutions.");
    universities = [...new Set([...fetched, ...directory.fallback])].sort((a, b) => a.localeCompare(b));
    status.textContent = "Search the Ghana university directory. If your school is missing, enter its name.";
  } catch {
    console.info("Using the built-in Ghana university list because the live directory is unavailable.");
    status.textContent = "Live school search is unavailable. Choose a suggestion or type your university name.";
  } finally {
    window.clearTimeout(timeout);
    renderOptions();
  }
}

document.querySelector("#signin-tab").addEventListener("click", () => setAuthMode("signin"));
document.querySelector("#signup-tab").addEventListener("click", () => setAuthMode("signup"));
passwordInput.addEventListener("input", updatePasswordHint);
passwordVisibility.addEventListener("click", () => {
  setPasswordVisibility(passwordInput.type === "password");
});
document.querySelector("#google-signin").addEventListener("click", async (event) => {
  if (!authClient || authSubmitting) return;
  const consent = document.querySelector("#auth-consent");
  if (!consent.checked) {
    authMessage.textContent = "Agree to the Terms and Privacy Policy before continuing with Google.";
    consent.focus();
    return;
  }
  authSubmitting = true;
  const button = event.currentTarget;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  authMessage.textContent = "";
  try {
    const { error } = await authClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: new URL(getPostAuthUrl(), window.location.href).href },
    });
    if (error) throw error;
  } catch (error) {
    console.error("Skillmate Google sign-in failed.", error);
    authMessage.textContent = friendlyAuthError(error, authMode);
    authSubmitting = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
});
document.querySelector("#return-to-signin").addEventListener("click", () => {
  window.history.replaceState(null, "", window.location.pathname);
  setAuthMode("signin");
});
loadGhanaianUniversities();
setAuthMode(new URLSearchParams(window.location.search).get("mode") === "recovery" ? "recovery" : "signin");

authClient?.auth.onAuthStateChange((event, session) => {
  if (event === "INITIAL_SESSION" && session && authMode !== "recovery") {
    window.setTimeout(() => {
      if (!authSubmitting) window.location.replace(getPostAuthUrl());
    }, 0);
  }
  if (event === "SIGNED_IN" && session && !authSubmitting && authMode !== "recovery") {
    window.location.assign(getPostAuthUrl());
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!authClient) {
    authMessage.textContent = "Configure Supabase in .env and start the Skillmate server before signing in.";
    return;
  }
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  const fullName = document.querySelector("#auth-name").value.trim();
  const university = document.querySelector("#auth-university").value.trim();
  const studentIdNumber = document.querySelector("#auth-student-id").value.trim();
  const submit = document.querySelector("#auth-submit");
  const submitLabel = document.querySelector("#auth-submit-label");
  const submitSpinner = submit.querySelector(".auth-submit-spinner");
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
      if (fullName.length < 2 || university.length < 2 || studentIdNumber.length < 3) {
        throw new Error("Enter your name, university, and student ID number to create an account.");
      }
      const { data, error } = await authClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            university,
            student_id_number: studentIdNumber,
          },
          emailRedirectTo: new URL("index.html", window.location.href).href,
        },
      });
      if (error) throw error;
      if (!data.session) {
        setAuthMode("signin");
        authMessage.textContent = "Account created. Check your email to confirm it, then sign in.";
        authMessage.classList.add("success");
        document.querySelector("#auth-email").value = email;
      } else {
        await window.syncSkillmateServerSession(data.session);
        window.location.assign("index.html");
      }
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
      const { data, error } = await authClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await window.syncSkillmateServerSession(data.session);
      window.location.assign(getPostAuthUrl());
    }
  } catch (error) {
    console.error("Skillmate authentication failed.", error);
    if (isInvalidRefreshTokenError(error)) {
      await window.clearExpiredSkillmateSession();
    }
    authMessage.textContent = friendlyAuthError(error, authMode);
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
  authMessage.textContent = window.skillmateSupabaseError
    || "Supabase is not connected yet. Configure the server environment in .env to enable account sign-in.";
}
