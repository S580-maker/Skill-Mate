(function initializeSkillmateTheme() {
  const storageKey = "skillmate-theme";
  let theme = "light";
  try {
    theme = localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
  } catch (error) {
    console.warn("Could not load the saved Skillmate theme preference.", error);
  }
  document.documentElement.dataset.theme = theme;

  function updateThemeButtons() {
    const isDark = document.documentElement.dataset.theme === "dark";
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = isDark ? "#111c2b" : "#f4f7fb";
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
        document.documentElement.dataset.theme = nextTheme;
        try {
          localStorage.setItem(storageKey, nextTheme);
        } catch (error) {
          console.warn("Could not save the Skillmate theme preference.", error);
        }
        updateThemeButtons();
      });
    });
  });
})();
