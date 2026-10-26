const resetClient = window.skillmateSupabase;
const resetForm = document.querySelector("#reset-form");
const newPassword = document.querySelector("#new-password");
const passwordToggle = document.querySelector("#password-visibility");
const passwordHint = document.querySelector("#password-hint");
const resetMessage = document.querySelector("#reset-message");
const resetSubmit = document.querySelector("#reset-submit");
const resetSubmitLabel = document.querySelector("#reset-submit-label");
let resetSessionReady = false;

function friendlyResetError(error) {
  const message = (error.message || "").toLowerCase();
  if (error.code === "weak_password" || message.includes("password should be")) {
    return "Choose a password with at least 8 characters.";
  }
  if (message.includes("session") || message.includes("token") || message.includes("expired")) {
    return "This reset link is invalid or expired. Request a new password reset link.";
  }
  return "We couldn’t update your password. Please try again.";
}

function updateResetPasswordHint() {
  const length = [...newPassword.value].length;
  passwordHint.textContent = length >= 8 ? "Minimum met." : `Use at least 8 characters (${length}/8).`;
}

passwordToggle.addEventListener("click", () => {
  const visible = newPassword.type === "password";
  newPassword.type = visible ? "text" : "password";
  passwordToggle.setAttribute("aria-label", `${visible ? "Hide" : "Show"} password`);
  passwordToggle.setAttribute("aria-pressed", String(visible));
  passwordToggle.textContent = visible ? "Hide" : "Show";
});
newPassword.addEventListener("input", updateResetPasswordHint);

async function checkResetSession() {
  if (!resetClient) {
    resetMessage.textContent = window.skillmateSupabaseError || "Password reset is unavailable because Supabase is not connected.";
    resetSubmit.disabled = true;
    return;
  }
  const { data, error } = await resetClient.auth.getSession();
  if (error) throw error;
  resetSessionReady = Boolean(data.session);
  if (!resetSessionReady) {
    resetMessage.textContent = "This reset link is invalid or expired. Request a new password reset link.";
    resetSubmit.disabled = true;
  }
}

resetClient?.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
    resetSessionReady = Boolean(session);
    resetSubmit.disabled = !resetSessionReady;
    if (resetSessionReady) resetMessage.textContent = "";
  }
});

checkResetSession().catch((error) => {
  console.error("Could not validate the Skillmate password reset link.", error);
  resetMessage.textContent = friendlyResetError(error);
  resetSubmit.disabled = true;
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!resetClient || !resetSessionReady) {
    resetMessage.textContent = "This reset link is invalid or expired. Request a new password reset link.";
    return;
  }
  resetSubmit.disabled = true;
  resetSubmit.setAttribute("aria-busy", "true");
  resetSubmit.querySelector(".auth-submit-spinner").hidden = false;
  resetSubmitLabel.textContent = "Saving password…";
  resetMessage.textContent = "";
  try {
    const { error } = await resetClient.auth.updateUser({ password: newPassword.value });
    if (error) throw error;
    const { data, error: sessionError } = await resetClient.auth.getSession();
    if (sessionError) throw sessionError;
    await window.syncSkillmateServerSession(data.session);
    resetMessage.textContent = "Your password has been updated. Taking you to Skillmate…";
    resetMessage.classList.add("success");
    window.setTimeout(() => window.location.assign("index.html"), 700);
  } catch (error) {
    console.error("Could not update the Skillmate password.", error);
    resetMessage.textContent = friendlyResetError(error);
    resetSubmit.disabled = false;
  } finally {
    resetSubmit.removeAttribute("aria-busy");
    resetSubmit.querySelector(".auth-submit-spinner").hidden = true;
    resetSubmitLabel.textContent = "Save new password";
  }
});
