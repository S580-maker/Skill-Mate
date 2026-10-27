(() => {
  const container = document.querySelector("#profile-completeness-root");
  if (!container) return;
  window.renderProfileCompleteness = (profile) => {
    container.replaceChildren();
    const fields = [profile.name, profile.university, profile.studentIdNumber].map(value => Boolean(value?.trim()));
    if (profile.identityComplete || fields.every(Boolean)) return;
    const completed = fields.filter(Boolean).length;
    const percentage = Math.round(completed / fields.length * 100);
    const missing = ["your name", "your university", "your student ID number"].filter((_, index) => !fields[index]);
    const section = document.createElement("section");
    section.className = "profile-completeness panel";
    section.setAttribute("aria-labelledby", "profile-completeness-title");
    section.innerHTML = '<div class="profile-completeness-copy"><p class="eyebrow">YOUR STUDENT PROFILE</p><h2 id="profile-completeness-title">Complete your student profile</h2><p class="profile-completeness-detail"></p></div><div class="profile-completeness-progress"><div class="profile-completeness-value"><strong></strong><span></span></div><div class="profile-completeness-track" role="progressbar" aria-label="Profile completeness" aria-valuemin="0" aria-valuemax="100"><span></span></div></div><button class="button button-outline profile-completeness-action" type="button">Complete profile <span aria-hidden="true">&rarr;</span></button>';
    section.querySelector(".profile-completeness-detail").textContent = "Add " + missing.join(" and ") + " to finish setting up your student profile.";
    section.querySelector(".profile-completeness-value strong").textContent = percentage + "%";
    section.querySelector(".profile-completeness-value span").textContent = completed + " of 3 details added";
    section.querySelector("[role=progressbar]").setAttribute("aria-valuenow", percentage);
    section.querySelector(".profile-completeness-track span").style.width = percentage + "%";
    section.querySelector("button").addEventListener("click", () => window.dispatchEvent(new Event("skillmate:edit-profile")));
    container.append(section);
  };
})();
