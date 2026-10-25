(function initializeSkillmateTheme() {
  const storageKey = "skillmate-theme";
  const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
  let validationSequence = 0;
  let themeTransitionTimer;
  let savedTheme = null;
  try {
    const storedTheme = localStorage.getItem(storageKey);
    if (storedTheme === "dark" || storedTheme === "light") savedTheme = storedTheme;
  } catch (error) {
    console.warn("Could not load the saved Skillmate theme preference.", error);
  }
  document.documentElement.dataset.theme = savedTheme || (colorScheme?.matches ? "dark" : "light");

  function updateThemeButtons() {
    const isDark = document.documentElement.dataset.theme === "dark";
    let themeColor = document.querySelector('meta[name="theme-color"]');
    if (!themeColor) {
      themeColor = document.createElement("meta");
      themeColor.name = "theme-color";
      document.head.append(themeColor);
    }
    themeColor.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", String(isDark));
      button.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      const icon = button.querySelector("[data-theme-icon]");
      if (icon) icon.textContent = isDark ? "☀" : "☾";
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateThemeButtons();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        savedTheme = nextTheme;
        const root = document.documentElement;
        root.classList.add("theme-transition");
        document.documentElement.dataset.theme = nextTheme;
        window.clearTimeout(themeTransitionTimer);
        themeTransitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), 250);
        try {
          localStorage.setItem(storageKey, nextTheme);
        } catch (error) {
          console.warn("Could not save the Skillmate theme preference.", error);
        }
        updateThemeButtons();
      });
    });
    colorScheme?.addEventListener("change", (event) => {
      if (savedTheme) return;
      document.documentElement.dataset.theme = event.matches ? "dark" : "light";
      updateThemeButtons();
    });
    document.addEventListener("invalid", (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      const label = field.closest("label");
      if (!label) return;
      let error = label.querySelector(":scope > .field-error");
      if (!error) {
        error = document.createElement("small");
        error.className = "field-error";
        error.id = `${field.id || `skillmate-field-${++validationSequence}`}-error`;
        error.setAttribute("role", "alert");
        label.append(error);
      }
      error.textContent = field.validationMessage;
      field.setAttribute("aria-invalid", "true");
      const describedBy = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
      describedBy.add(error.id);
      field.setAttribute("aria-describedby", [...describedBy].join(" "));
    }, true);
    document.addEventListener("input", (event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      const label = field.closest("label");
      const error = label?.querySelector(":scope > .field-error");
      if (!error || !field.validity.valid) return;
      field.removeAttribute("aria-invalid");
      const describedBy = (field.getAttribute("aria-describedby") || "").split(/\s+/).filter((id) => id && id !== error.id);
      if (describedBy.length) field.setAttribute("aria-describedby", describedBy.join(" "));
      else field.removeAttribute("aria-describedby");
      error.remove();
    });
  });
})();
