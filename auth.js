const authClient = window.skillmateSupabase;
const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
let authMode = "signin";

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  const recovery = mode === "recovery";
  const signin = !signup && !recovery;
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
  document.querySelector("#auth-password").autocomplete = signin ? "current-password" : "new-password";
  document.querySelector("#password-label").textContent = recovery ? "New password" : "Password";
  document.querySelector("#auth-title").textContent = signup ? "Create your account" : recovery ? "Choose a new password" : "Welcome to Skillmate";
  document.querySelector("#auth-intro").textContent = recovery
    ? "Enter a new password for your Skillmate account."
    : signup
    ? "Create one account to find services and offer your own skills. Add your university and student ID number; it will be stored privately but is not automatically verified."
    : "Sign in to find services, manage bookings, or earn with your skills.";
  document.querySelector("#auth-submit-label").textContent = signup ? "Create account" : recovery ? "Save new password" : "Sign in";
  document.querySelector("#forgot-password").hidden = !signin;
  document.querySelector("#return-to-signin").hidden = !recovery;
  authMessage.textContent = "";
  authMessage.classList.remove("success");
}

async function loadGhanaianUniversities() {
  const directory = window.SKILLMATE_UNIVERSITY_DIRECTORY;
  const options = document.querySelector("#ghana-university-options");
  const status = document.querySelector("#university-directory-status");
  let universities = directory.fallback;
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
  } catch (error) {
    console.warn("Could not load the live Ghana university directory; using the built-in list.", error);
    status.textContent = "Live school search is unavailable. Choose a suggestion or type your university name.";
  } finally {
    window.clearTimeout(timeout);
    options.replaceChildren(...universities.map((university) => {
      const option = document.createElement("option");
      option.value = university;
      return option;
    }));
  }
}

document.querySelector("#signin-tab").addEventListener("click", () => setAuthMode("signin"));
document.querySelector("#signup-tab").addEventListener("click", () => setAuthMode("signup"));
document.querySelector("#return-to-signin").addEventListener("click", () => {
  window.history.replaceState(null, "", window.location.pathname);
  setAuthMode("signin");
});
document.querySelector("#forgot-password").addEventListener("click", async () => {
  const emailInput = document.querySelector("#auth-email");
  if (!emailInput.reportValidity()) return;
  if (!authClient) {
    authMessage.textContent = window.skillmateSupabaseError || "Password recovery is unavailable because Supabase is not connected.";
    return;
  }

  const button = document.querySelector("#forgot-password");
  button.disabled = true;
  button.textContent = "Sending reset link…";
  authMessage.textContent = "";
  authMessage.classList.remove("success");
  try {
    const { error } = await authClient.auth.resetPasswordForEmail(emailInput.value.trim(), {
      redirectTo: new URL("login.html?mode=recovery", window.location.href).href,
    });
    if (error) throw error;
    authMessage.textContent = "If an account uses this email, a password reset link has been sent. Check your inbox.";
    authMessage.classList.add("success");
  } catch (error) {
    console.error("Could not send a Skillmate password reset email.", error);
    authMessage.textContent = error.message || "Could not send a password reset email. Please try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Forgot password?";
  }
});
loadGhanaianUniversities();
setAuthMode(new URLSearchParams(window.location.search).get("mode") === "recovery" ? "recovery" : "signin");

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
        authMessage.textContent = "Account created. Check your email to confirm it, then sign in.";
        authMessage.classList.add("success");
        setAuthMode("signin");
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
      const destination = new URLSearchParams(window.location.search).get("next");
      window.location.assign(destination === "admin" ? "admin.html" : "index.html");
    }
  } catch (error) {
    console.error("Skillmate authentication failed.", error);
    authMessage.textContent = error.message || "We couldn’t sign you in. Check your details and try again.";
  } finally {
    submit.disabled = false;
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
