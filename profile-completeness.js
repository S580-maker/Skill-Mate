(() => {
  const container = document.querySelector("#profile-completeness-root");
  if (!container) return;
  const dismissed = new Set();
  window.renderProfileCompleteness = (profile) => {
    container.replaceChildren();
    const fields = [profile.name, profile.university, profile.studentIdNumber].map(value => Boolean(value?.trim()));
    const dismissalKey = `skillmate-profile-reminder:${profile.email || profile.name || "student"}`;
    let storedDismissal = false;
    try { storedDismissal = window.sessionStorage?.getItem(dismissalKey) === "dismissed"; } catch {}
    if (profile.identityComplete || fields.every(Boolean) || dismissed.has(dismissalKey) || storedDismissal) return;
    const completed = fields.filter(Boolean).length;
    const percentage = Math.round(completed / fields.length * 100);
    const missing = ["your name", "your university", "your student ID number"].filter((_, index) => !fields[index]);
    const section = document.createElement("section");
    section.className = "profile-completeness panel";
    section.setAttribute("aria-labelledby", "profile-completeness-title");
    section.innerHTML = '<div class="profile-completeness-copy"><h2 id="profile-completeness-title">Add your student details</h2><p class="profile-completeness-detail"></p></div><div class="profile-completeness-progress"><div class="profile-completeness-value"><strong></strong><span></span></div><div class="profile-completeness-track" role="progressbar" aria-label="Profile completeness" aria-valuemin="0" aria-valuemax="100"><span></span></div></div><button class="button button-outline profile-completeness-action" type="button">Add details <span aria-hidden="true">&rarr;</span></button><button class="reminder-dismiss icon-button" type="button" aria-label="Dismiss student details reminder">×</button>';
    section.querySelector(".profile-completeness-detail").textContent = "Add " + missing.join(" and ") + " when you’re ready. These details do not automatically verify your account.";
    section.querySelector(".profile-completeness-value strong").textContent = percentage + "%";
    section.querySelector(".profile-completeness-value span").textContent = completed + " of 3 details added";
    section.querySelector("[role=progressbar]").setAttribute("aria-valuenow", percentage);
    section.querySelector(".profile-completeness-track span").style.width = percentage + "%";
    section.querySelector("button").addEventListener("click", () => window.dispatchEvent(new Event("skillmate:edit-profile")));
    section.querySelector(".reminder-dismiss").addEventListener("click", () => {
      dismissed.add(dismissalKey);
      try { window.sessionStorage?.setItem(dismissalKey, "dismissed"); } catch {}
      container.replaceChildren();
    });
    container.append(section);
  };
})();
