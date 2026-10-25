(function initializeSkillmateTheme() {
  const storageKey = "skillmate-theme";
  const colorScheme = window.matchMedia?.("(prefers-color-scheme: dark)");
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
        document.documentElement.dataset.theme = nextTheme;
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
  });
})();
