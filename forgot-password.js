const recoveryClient = window.skillmateSupabase;
const recoveryForm = document.querySelector("#forgot-password-form");
const recoveryEmail = document.querySelector("#recovery-email");
const recoveryMessage = document.querySelector("#recovery-message");
const recoverySubmit = document.querySelector("#recovery-submit");
const recoverySubmitLabel = document.querySelector("#recovery-submit-label");
const recoverySpinner = recoverySubmit.querySelector(".auth-submit-spinner");

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!recoveryClient) {
    recoveryMessage.textContent = window.skillmateSupabaseError
      || "Password recovery is unavailable because Supabase is not connected.";
    return;
  }

  recoverySubmit.disabled = true;
  recoverySubmit.setAttribute("aria-busy", "true");
  recoverySpinner.hidden = false;
  recoverySubmitLabel.textContent = "Sending reset link…";
  recoveryMessage.textContent = "";
  recoveryMessage.classList.remove("success");

  try {
    const { error } = await recoveryClient.auth.resetPasswordForEmail(recoveryEmail.value.trim(), {
      redirectTo: new URL("reset.html", window.location.href).href,
    });
    if (error) throw error;
    recoveryMessage.textContent = "If an account uses this email, a password reset link has been sent. Check your inbox.";
    recoveryMessage.classList.add("success");
  } catch (error) {
    console.error("Could not send a Skillmate password reset email.", error);
    const message = (error?.message || "").toLowerCase();
    recoveryMessage.textContent = message.includes("rate limit")
      ? "Too many reset emails were requested. Wait a little while, then try again."
      : "Could not send a password reset email. Check the address and try again.";
  } finally {
    recoverySubmit.disabled = false;
    recoverySubmit.removeAttribute("aria-busy");
    recoverySpinner.hidden = true;
    recoverySubmitLabel.textContent = "Send reset link";
  }
});

if (!recoveryClient) {
  recoveryMessage.textContent = window.skillmateSupabaseError
    || "Supabase is not connected yet. Configure the server environment to enable password recovery.";
}
