/* Public-page interactions only. No authentication, storage, or API access. */
(() => {
  "use strict";
  const menu = document.querySelector(".menu-toggle");
  const nav = document.querySelector("#main-nav");
  const mobile = window.matchMedia("(max-width: 800px)");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function closeMenu(restoreFocus = false) {
    menu.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    if (restoreFocus) menu.focus();
  }
  menu.hidden = false;
  document.documentElement.classList.add("has-menu");
  menu.addEventListener("click", () => {
    const expanded = menu.getAttribute("aria-expanded") !== "true";
    menu.setAttribute("aria-expanded", String(expanded));
    nav.classList.toggle("is-open", expanded);
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-header")) closeMenu();
  });
  document.addEventListener("focusin", (event) => {
    if (!event.target.closest(".site-header")) closeMenu();
  });
  mobile.addEventListener("change", () => closeMenu());

  // Native details remain keyboard-operable and work even without JavaScript.
  const questions = [...document.querySelectorAll(".faq-list details")];
  questions.forEach((question) => question.addEventListener("toggle", () => {
    if (question.open) questions.forEach((other) => { if (other !== question) other.open = false; });
  }));

  if ("IntersectionObserver" in window && !motion.matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.remove("reveal-pending");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll("[data-reveal]").forEach((element) => {
      element.classList.add("reveal-pending");
      observer.observe(element);
    });
    const showAll = () => {
      if (!motion.matches) return;
      observer.disconnect();
      document.querySelectorAll(".reveal-pending").forEach((element) => element.classList.remove("reveal-pending"));
    };
    motion.addEventListener("change", showAll);
    // Never leave a keyboard-focused link hidden while waiting for a scroll event.
    document.addEventListener("focusin", (event) => event.target.closest(".reveal-pending")?.classList.remove("reveal-pending"));
  }
  document.querySelector("#copyright-year").textContent = String(new Date().getFullYear());
  // Marks the nav link for the section currently in view (gold underline).
  const navLinks = Array.from(document.querySelectorAll('.main-nav>a[href^="#"]'));
  if ("IntersectionObserver" in window && navLinks.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => link.toggleAttribute("aria-current", link.getAttribute("href") === `#${entry.target.id}`));
        navLinks.forEach((link) => { if (link.hasAttribute("aria-current")) link.setAttribute("aria-current", "true"); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    navLinks.forEach((link) => { const target = document.querySelector(link.getAttribute("href")); if (target) spy.observe(target); });
  }
})();
