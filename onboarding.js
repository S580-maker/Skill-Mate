const onboardingClient = window.skillmateSupabase;
const onboardingForm = document.querySelector("#onboarding-form");
const onboardingMessage = document.querySelector("#onboarding-message");
const onboardingSubmit = document.querySelector("#onboarding-submit");
const onboardingSubmitLabel = document.querySelector("#onboarding-submit-label");
const onboardingSpinner = onboardingSubmit.querySelector(".auth-submit-spinner");
const onboardingName = document.querySelector("#onboarding-name");
const onboardingCampus = document.querySelector("#onboarding-campus");
const onboardingPhoto = document.querySelector("#onboarding-photo");
const avatarPreview = document.querySelector("#onboarding-avatar-preview");
const avatarFallback = document.querySelector("#onboarding-avatar-fallback");
const skillInput = document.querySelector("#custom-skill");
const skillChips = document.querySelector("#skill-chips");
const selectedSkills = new Map();
let currentUser = null;
let existingAvatarUrl = "";
let previewUrl = "";

function setOnboardingError(message) {
  onboardingMessage.textContent = message;
  onboardingMessage.classList.remove("success");
}

function renderSkillChips() {
  skillChips.replaceChildren(...[...selectedSkills.entries()].map(([key, skill]) => {
    const item = document.createElement("li");
    item.className = "skill-chip";
    const label = document.createElement("span");
    label.textContent = skill;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${skill}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      selectedSkills.delete(key);
      renderSkillChips();
    });
    item.append(label, remove);
    return item;
  }));
}

function addSkill(value) {
  const skill = value.trim().replace(/\s+/g, " ");
  if (!skill) return;
  const key = skill.toLocaleLowerCase();
  if (selectedSkills.has(key)) {
    skillInput.value = "";
    return;
  }
  if (selectedSkills.size >= 10) {
    setOnboardingError("You can add up to 10 skills.");
    return;
  }
  selectedSkills.set(key, skill);
  skillInput.value = "";
  onboardingMessage.textContent = "";
  renderSkillChips();
}

document.querySelectorAll("[data-skill-suggestion]").forEach((button) => {
  button.addEventListener("click", () => addSkill(button.dataset.skillSuggestion));
});
document.querySelector("#add-skill").addEventListener("click", () => addSkill(skillInput.value));
skillInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addSkill(skillInput.value);
  }
});

onboardingPhoto.addEventListener("change", () => {
  const file = onboardingPhoto.files[0];
  document.querySelector("#onboarding-photo-error").textContent = "";
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    onboardingPhoto.value = "";
    document.querySelector("#onboarding-photo-error").textContent = "Choose a PNG, JPG, WEBP, or GIF image.";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    onboardingPhoto.value = "";
    document.querySelector("#onboarding-photo-error").textContent = "Choose an image smaller than 5 MB.";
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  avatarPreview.src = previewUrl;
  avatarPreview.hidden = false;
  avatarFallback.hidden = true;
});

async function loadOnboarding() {
  if (!onboardingClient) throw new Error(window.skillmateSupabaseError || "Supabase is not connected.");
  let timeoutId;
  const sessionResult = await Promise.race([
    onboardingClient.auth.getSession(),
    new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("Checking your session timed out. Sign in again.")), 3000);
    }),
  ]).finally(() => window.clearTimeout(timeoutId));
  if (sessionResult.error) throw sessionResult.error;
  if (!sessionResult.data.session) {
    window.location.replace("login.html");
    return;
  }
  currentUser = sessionResult.data.session.user;
  const { data: profile, error } = await onboardingClient.from("profiles")
    .select("full_name, university, skills, avatar_url, onboarding_completed")
    .eq("id", currentUser.id)
    .single();
  if (error) throw error;
  if (profile.onboarding_completed) {
    window.location.replace("index.html");
    return;
  }
  onboardingName.value = profile.full_name || currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "";
  onboardingCampus.value = profile.university || "";
  existingAvatarUrl = profile.avatar_url || currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || "";
  if (existingAvatarUrl) {
    avatarPreview.src = existingAvatarUrl;
    avatarPreview.hidden = false;
    avatarFallback.hidden = true;
  }
  (profile.skills || []).forEach((skill) => {
    const key = skill.toLocaleLowerCase();
    selectedSkills.set(key, skill);
  });
  renderSkillChips();
  const directory = window.SKILLMATE_UNIVERSITY_DIRECTORY;
  document.querySelector("#onboarding-university-options").replaceChildren(...directory.fallback.map((university) => {
    const option = document.createElement("option");
    option.value = university;
    return option;
  }));
}

async function saveOnboarding(skip = false) {
  if (!currentUser || !onboardingClient) {
    setOnboardingError("Your session is unavailable. Sign in again before saving your profile.");
    return;
  }
  if (!skip && (!onboardingName.value.trim() || onboardingCampus.value.trim().length < 2)) {
    setOnboardingError("Enter your name and university or campus, or skip this step for now.");
    return;
  }
  onboardingSubmit.disabled = true;
  onboardingSubmit.setAttribute("aria-busy", "true");
  document.querySelector("#onboarding-skip").disabled = true;
  document.querySelector("#onboarding-skip-mobile").disabled = true;
  onboardingSpinner.hidden = false;
  onboardingSubmitLabel.textContent = skip ? "Skipping…" : "Saving your profile…";
  setOnboardingError("");
  try {
    let avatarUrl = existingAvatarUrl;
    const file = skip ? null : onboardingPhoto.files[0];
    if (file) {
      const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" })[file.type];
      const imagePath = `${currentUser.id}/avatars/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await onboardingClient.storage.from("portfolio-images").upload(imagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data } = onboardingClient.storage.from("portfolio-images").getPublicUrl(imagePath);
      avatarUrl = data.publicUrl;
    }
    const updates = skip
      ? { onboarding_completed: true }
      : {
        full_name: onboardingName.value.trim(),
        university: onboardingCampus.value.trim(),
        skills: [...selectedSkills.values()],
        avatar_url: avatarUrl || null,
        onboarding_completed: true,
      };
    const { error } = await onboardingClient.from("profiles").update(updates).eq("id", currentUser.id);
    if (error) throw error;
    const { data: sessionData, error: sessionError } = await onboardingClient.auth.getSession();
    if (sessionError) throw sessionError;
    await window.syncSkillmateServerSession(sessionData.session);
    window.location.replace("index.html");
  } catch (error) {
    console.error("Could not save the Skillmate onboarding profile.", error);
    setOnboardingError(error.message || "Could not save your profile. Please try again.");
  } finally {
    onboardingSubmit.disabled = false;
    onboardingSubmit.removeAttribute("aria-busy");
    document.querySelector("#onboarding-skip").disabled = false;
    document.querySelector("#onboarding-skip-mobile").disabled = false;
    onboardingSpinner.hidden = true;
    onboardingSubmitLabel.textContent = "Save and continue";
  }
}

onboardingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveOnboarding();
});
document.querySelector("#onboarding-skip").addEventListener("click", () => saveOnboarding(true));
document.querySelector("#onboarding-skip-mobile").addEventListener("click", () => saveOnboarding(true));
loadOnboarding().catch((error) => {
  console.error("Could not load the Skillmate onboarding profile.", error);
  if (error?.message === "Checking your session timed out. Sign in again.") {
    window.location.replace("login.html");
    return;
  }
  onboardingSubmit.disabled = true;
  document.querySelector("#onboarding-skip").disabled = true;
  document.querySelector("#onboarding-skip-mobile").disabled = true;
  setOnboardingError(error.message || "Could not load your profile. Check your connection and try again.");
});
