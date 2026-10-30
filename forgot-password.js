const recoveryForm = document.querySelector("#forgot-password-form");
const recoveryEmail = document.querySelector("#recovery-email");
const recoveryMessage = document.querySelector("#recovery-message");
const recoverySubmit = document.querySelector("#recovery-submit");
const recoverySubmitLabel = document.querySelector("#recovery-submit-label");
const recoverySpinner = recoverySubmit.querySelector(".auth-submit-spinner");
const recoveryOtp = document.querySelector("#recovery-otp");
const codeForm = document.querySelector("#recovery-code-form");
const codeInputs = [...document.querySelectorAll(".recovery-otp-inputs input")];
const codeSubmit = document.querySelector("#recovery-verify");
const codeSubmitLabel = document.querySelector("#recovery-verify-label");
const codeMessage = document.querySelector("#recovery-code-message");
const resendButton = document.querySelector("#recovery-resend");
const resendCountdown = document.querySelector("#recovery-countdown");
const resendPrefix = document.querySelector("#recovery-resend-prefix");
const newPasswordForm = document.querySelector("#new-password-form");
const newPassword = document.querySelector("#new-password");
const confirmNewPassword = document.querySelector("#confirm-new-password");
const newPasswordMessage = document.querySelector("#new-password-message");
const newPasswordSubmit = document.querySelector("#new-password-submit");
const newPasswordSubmitLabel = document.querySelector("#new-password-submit-label");
const newPasswordVisibility = document.querySelector("#new-password-visibility");
let countdownTimer = null;
let codeSubmitting = false;
let passwordSubmitting = false;

function maskEmail(email) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 1)}${"•".repeat(Math.min(Math.max(name.length - 1, 4), 7))}@${domain}`;
}

function updateCodeSubmitState() {
  codeSubmit.disabled = codeSubmitting || !/^\d{6}$/.test(codeInputs.map((input) => input.value).join(""));
}

function animateCodeDigit(input) {
  input.classList.remove("otp-digit-entered");
  void input.offsetWidth;
  input.classList.add("otp-digit-entered");
}

function clearCodeError() {
  recoveryOtp.classList.remove("is-error");
  codeMessage.textContent = "";
  codeMessage.classList.remove("success");
}

function fillCode(digits, startIndex = 0) {
  [...digits].forEach((digit, offset) => {
    const input = codeInputs[startIndex + offset];
    if (!input) return;
    input.value = digit;
    animateCodeDigit(input);
  });
  updateCodeSubmitState();
}

function startCountdown(seconds = 30) {
  window.clearInterval(countdownTimer);
  let remaining = seconds;
  resendButton.disabled = true;
  resendPrefix.hidden = false;
  const update = () => {
    resendCountdown.textContent = `0:${String(remaining).padStart(2, "0")}`;
    if (remaining <= 0) {
      window.clearInterval(countdownTimer);
      resendButton.disabled = false;
      resendPrefix.hidden = true;
      resendCountdown.textContent = "Resend code";
      return;
    }
    remaining -= 1;
  };
  update();
  countdownTimer = window.setInterval(update, 1000);
}

recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (recoverySubmit.disabled) return;
  recoverySubmit.disabled = true;
  recoverySubmit.setAttribute("aria-busy", "true");
  recoverySpinner.hidden = false;
  recoverySubmitLabel.textContent = "Sending code…";
  recoveryMessage.textContent = "";
  recoveryMessage.classList.remove("success");
  try {
    const response = await fetch("/api/auth/password-recovery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: recoveryEmail.value.trim() }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not start password recovery.");
    recoveryMessage.textContent = result.message;
    recoveryMessage.classList.add("success");
    document.querySelector("#recovery-title").textContent = "Verify your email";
    document.querySelector("#recovery-intro").textContent = "Enter the six-digit code to confirm your email before resetting your password.";
    document.querySelector("#recovery-otp-email").textContent = maskEmail(recoveryEmail.value.trim());
    recoveryForm.hidden = true;
    recoveryOtp.hidden = false;
    codeInputs.forEach((input) => { input.value = ""; input.disabled = false; });
    recoveryOtp.classList.remove("is-error", "is-success");
    codeMessage.textContent = "";
    updateCodeSubmitState();
    startCountdown();
    codeInputs[0]?.focus();
  } catch (error) {
    console.error("Could not start Skillmate password recovery.", error);
    recoveryMessage.textContent = error.message || "Could not start password recovery. Please try again.";
  } finally {
    recoverySubmit.disabled = false;
    recoverySubmit.removeAttribute("aria-busy");
    recoverySpinner.hidden = true;
    recoverySubmitLabel.textContent = "Send verification code";
  }
});

codeInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    const digits = input.value.replace(/\D/g, "");
    if (digits.length > 1) {
      const startIndex = index === 0 ? 0 : index;
      fillCode(digits.slice(0, codeInputs.length - startIndex), startIndex);
      codeInputs[Math.min(startIndex + digits.length, codeInputs.length) - 1]?.focus();
      clearCodeError();
      return;
    }
    input.value = digits.slice(-1);
    if (input.value) {
      animateCodeDigit(input);
      codeInputs[index + 1]?.focus();
    }
    clearCodeError();
    updateCodeSubmitState();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && index > 0) codeInputs[index - 1].focus();
    if (event.key === "ArrowLeft" && index > 0) codeInputs[index - 1].focus();
    if (event.key === "ArrowRight" && index < codeInputs.length - 1) codeInputs[index + 1].focus();
  });
  input.addEventListener("paste", (event) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, codeInputs.length);
    if (!digits) return;
    event.preventDefault();
    clearCodeError();
    const startIndex = digits.length === codeInputs.length ? 0 : index;
    if (startIndex + digits.length > codeInputs.length) return;
    fillCode(digits, startIndex);
    codeInputs[Math.min(startIndex + digits.length, codeInputs.length) - 1].focus();
  });
});

codeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (codeSubmitting) return;
  const code = codeInputs.map((input) => input.value).join("");
  if (!/^\d{6}$/.test(code)) {
    codeMessage.textContent = "Enter all six digits to continue.";
    codeInputs.find((input) => !input.value)?.focus();
    return;
  }

  codeSubmitting = true;
  updateCodeSubmitState();
  recoveryOtp.classList.remove("is-error");
  codeInputs.forEach((input) => { input.disabled = true; });
  codeSubmit.setAttribute("aria-busy", "true");
  codeSubmit.querySelector(".auth-submit-spinner").hidden = false;
  codeSubmitLabel.textContent = "Verifying…";
  codeMessage.textContent = "";
  codeMessage.classList.remove("success");
  try {
    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ code }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not verify your code. Please try again.");
    if (!result.recovery) throw new Error("This code is not valid for password recovery. Request a new code.");
    recoveryOtp.classList.add("is-success");
    codeMessage.classList.add("success");
    codeMessage.textContent = "Email verified.";
    codeSubmit.querySelector(".auth-submit-spinner").hidden = true;
    codeSubmitLabel.textContent = "Verified";
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    window.clearInterval(countdownTimer);
    recoveryOtp.hidden = true;
    newPasswordForm.hidden = false;
    document.querySelector("#recovery-title").textContent = "Set a new password";
    document.querySelector("#recovery-intro").textContent = "Your email is verified. Choose a new password for your account.";
    newPassword.focus();
  } catch (error) {
    console.error("Could not verify the Skillmate password recovery code.", error);
    recoveryOtp.classList.remove("is-success", "is-error");
    void recoveryOtp.offsetWidth;
    recoveryOtp.classList.add("is-error");
    codeMessage.textContent = error.message || "Could not verify your code. Please try again.";
    codeInputs.forEach((input) => { input.disabled = false; });
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("expired") || errorMessage.includes("request a new code") || errorMessage.includes("sign in again")) {
      window.clearInterval(countdownTimer);
      resendButton.disabled = true;
    }
  } finally {
    codeSubmitting = false;
    codeSubmit.removeAttribute("aria-busy");
    if (!recoveryOtp.hidden) {
      codeSubmit.querySelector(".auth-submit-spinner").hidden = true;
      codeSubmitLabel.textContent = "Verify code";
      updateCodeSubmitState();
    }
  }
});

resendButton.addEventListener("click", async () => {
  if (resendButton.disabled || codeSubmitting) return;
  resendButton.disabled = true;
  codeMessage.textContent = "";
  try {
    const response = await fetch("/api/auth/resend", { method: "POST", credentials: "same-origin" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not resend your code.");
    codeMessage.textContent = result.message;
    codeMessage.classList.add("success");
    startCountdown();
  } catch (error) {
    codeMessage.classList.remove("success");
    codeMessage.textContent = error.message || "Could not resend your code.";
    resendButton.disabled = false;
  }
});

newPasswordVisibility.addEventListener("click", () => {
  const visible = newPassword.type === "password";
  newPassword.type = visible ? "text" : "password";
  newPasswordVisibility.setAttribute("aria-label", `${visible ? "Hide" : "Show"} new password`);
  newPasswordVisibility.setAttribute("aria-pressed", String(visible));
  newPasswordVisibility.textContent = visible ? "Hide" : "Show";
});

newPassword.addEventListener("input", () => {
  const length = [...newPassword.value].length;
  document.querySelector("#new-password-hint").textContent = length >= 8
    ? "Minimum met."
    : `Use at least 8 characters (${length}/8).`;
  newPasswordMessage.textContent = "";
});

newPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (passwordSubmitting) return;
  if (newPassword.value !== confirmNewPassword.value) {
    newPasswordMessage.textContent = "Your passwords do not match.";
    confirmNewPassword.focus();
    return;
  }

  passwordSubmitting = true;
  newPasswordSubmit.disabled = true;
  newPasswordSubmit.setAttribute("aria-busy", "true");
  newPasswordSubmit.querySelector(".auth-submit-spinner").hidden = false;
  newPasswordSubmitLabel.textContent = "Saving password…";
  newPasswordMessage.textContent = "";
  newPasswordMessage.classList.remove("success");
  try {
    const response = await fetch("/api/auth/password-recovery", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: newPassword.value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not update your password.");
    newPasswordMessage.textContent = "Your password has been updated. Taking you to sign in…";
    newPasswordMessage.classList.add("success");
    newPasswordForm.querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
    window.setTimeout(() => window.location.assign("login.html"), 900);
  } catch (error) {
    console.error("Could not update the Skillmate password.", error);
    newPasswordMessage.textContent = error.message || "Could not update your password. Please try again.";
    newPasswordSubmit.disabled = false;
  } finally {
    passwordSubmitting = false;
    newPasswordSubmit.removeAttribute("aria-busy");
    newPasswordSubmit.querySelector(".auth-submit-spinner").hidden = true;
    if (!newPasswordSubmit.disabled) newPasswordSubmitLabel.textContent = "Save new password";
  }
});
