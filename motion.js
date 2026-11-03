const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const activeAnimations = new WeakMap();
const revealedCardKeys = new Set();

export function generateSpringEasing({ stiffness, damping, mass = 1, duration, samples = 12, velocity = 0 }) {
  if (stiffness <= 0 || damping < 0 || mass <= 0 || duration <= 0 || samples < 2) {
    throw new RangeError("Spring parameters must be positive and include at least two samples.");
  }
  const angularFrequency = Math.sqrt(stiffness / mass);
  const dampingRatio = Math.min(damping / (2 * Math.sqrt(stiffness * mass)), 0.999);
  const dampedFrequency = angularFrequency * Math.sqrt(1 - dampingRatio ** 2);
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples;
    const time = duration * progress;
    const decay = Math.exp(-dampingRatio * angularFrequency * time);
    const sineWeight = (dampingRatio * angularFrequency - velocity) / dampedFrequency;
    const value = index === samples
      ? 1
      : 1 - decay * (Math.cos(dampedFrequency * time) + sineWeight * Math.sin(dampedFrequency * time));
    return `${Number(value.toFixed(3))}${index ? ` ${(progress * 100).toFixed(1)}%` : ""}`;
  });
  return `linear(${points.join(", ")})`;
}

export const motionTokens = Object.freeze({
  instant: 100,
  fast: 150,
  base: 250,
  slow: 400,
  page: 500,
  easeStandard: "cubic-bezier(0.2, 0, 0, 1)",
  easeEnter: "cubic-bezier(0, 0, 0.2, 1)",
  easeExit: "cubic-bezier(0.4, 0, 1, 1)",
  springSnappy: generateSpringEasing({ stiffness: 280, damping: 24, duration: 0.38 }),
  springGentle: generateSpringEasing({ stiffness: 120, damping: 20, duration: 0.55 }),
  springBouncy: generateSpringEasing({ stiffness: 260, damping: 12, duration: 0.55 }),
  springSnappyFallback: "cubic-bezier(0.2, 1.3, 0.4, 1)",
  springGentleFallback: "cubic-bezier(0.2, 1.1, 0.35, 1)",
  springBouncyFallback: "cubic-bezier(0.25, 1.5, 0.45, 1)",
});

export function animateMotion(element, keyframes, options = {}) {
  if (!element || reducedMotion.matches || typeof element.animate !== "function") return null;
  const previous = activeAnimations.get(element);
  let startingFrame = keyframes[0];
  if (previous) {
    try { previous.commitStyles(); } catch { /* Older browsers may not implement commitStyles. */ }
    const computed = getComputedStyle(element);
    startingFrame = Object.fromEntries(Object.keys(keyframes[0]).map(property => [
      property,
      computed[property],
    ]));
    previous.cancel();
  }
  const animationOptions = { ...options };
  delete animationOptions.resetProperties;
  const requestedEasing = animationOptions.easing;
  const springFallback = requestedEasing === motionTokens.springSnappy
    ? motionTokens.springSnappyFallback
    : requestedEasing === motionTokens.springGentle
      ? motionTokens.springGentleFallback
      : requestedEasing === motionTokens.springBouncy
        ? motionTokens.springBouncyFallback
        : motionTokens.easeStandard;
  animationOptions.easing = window.CSS?.supports?.("animation-timing-function", requestedEasing || "")
    ? requestedEasing
    : springFallback;
  const animation = element.animate([startingFrame, ...keyframes.slice(1)], {
    fill: "both",
    ...animationOptions,
  });
  activeAnimations.set(element, animation);
  element.style.willChange = "transform, opacity";
  animation.finished.then(() => {
    try { animation.commitStyles(); } catch { /* Animation already reached its final style. */ }
    animation.cancel();
    if (activeAnimations.get(element) === animation) {
      activeAnimations.delete(element);
      element.style.removeProperty("will-change");
      for (const property of options.resetProperties || []) element.style.removeProperty(property);
    }
  }).catch(() => {
    if (activeAnimations.get(element) === animation) {
      activeAnimations.delete(element);
      element.style.removeProperty("will-change");
    }
  });
  return animation;
}

export function flip(element, fromRect, toRect, options = {}) {
  if (!element || !fromRect || !toRect || reducedMotion.matches) return null;
  const deltaX = fromRect.left - toRect.left;
  const deltaY = fromRect.top - toRect.top;
  const scaleX = toRect.width ? fromRect.width / toRect.width : 1;
  const scaleY = toRect.height ? fromRect.height / toRect.height : 1;
  return animateMotion(element, [
    { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})` },
    { transform: "translate3d(0, 0, 0) scale(1, 1)" },
  ], {
    duration: options.duration ?? motionTokens.base,
    easing: options.easing ?? motionTokens.springSnappy,
    resetProperties: ["transform"],
  });
}

export function reveal(element, index = 0) {
  if (reducedMotion.matches) return null;
  return animateMotion(element, [
    { opacity: 0, transform: "translateY(10px)" },
    { opacity: 1, transform: "translateY(0)" },
  ], {
    duration: motionTokens.base,
    delay: Math.min(index, 7) * 45,
    easing: motionTokens.easeEnter,
    resetProperties: ["opacity", "transform"],
  });
}

function installDiscoverEntrance() {
  const home = document.querySelector("#view-home");
  if (!home) return;
  const entrance = [
    home.querySelector(".discover-intro .eyebrow"),
    home.querySelector(".discover-intro h1"),
    home.querySelector(".discover-intro > p:not(.eyebrow)"),
    home.querySelector(".discover-search"),
    home.querySelector(".marketplace-category-controls"),
    home.querySelector(".marketplace-heading"),
  ].filter(Boolean);
  entrance.forEach((element, index) => reveal(element, index));
}

function installCardReveal() {
  const grid = document.querySelector("#marketplace-grid");
  if (!grid) return;
  if (typeof IntersectionObserver !== "function" || reducedMotion.matches) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const key = entry.target.dataset.motionKey;
      if (key && revealedCardKeys.has(key)) return;
      if (key) revealedCardKeys.add(key);
      reveal(entry.target, Number(entry.target.dataset.motionIndex) || 0);
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
  const observeCards = () => {
    [...grid.querySelectorAll(".provider-card[data-motion-key]")].forEach((card, index) => {
      if (revealedCardKeys.has(card.dataset.motionKey)) return;
      card.dataset.motionIndex = String(index % 8);
      observer.observe(card);
    });
  };
  new MutationObserver(observeCards).observe(grid, { childList: true });
  observeCards();
}

function installCategoryIndicator() {
  const strip = document.querySelector("#category-strip");
  if (!strip) return;
  let priorRect = null;
  let animationFrame = 0;
  const update = () => {
    const selected = strip.querySelector(".category-chip.selected");
    if (!selected) return;
    let indicator = strip.querySelector(".category-active-pill");
    if (!indicator) {
      indicator = document.createElement("span");
      indicator.className = "category-active-pill";
      indicator.setAttribute("aria-hidden", "true");
      strip.prepend(indicator);
      strip.classList.add("has-active-pill");
    }
    const target = {
      left: selected.offsetLeft,
      top: selected.offsetTop,
      width: selected.offsetWidth,
      height: selected.offsetHeight,
    };
    const stripRect = strip.getBoundingClientRect();
    const from = priorRect || (indicator.dataset.positioned === "true"
      ? indicator.getBoundingClientRect()
      : null);
    indicator.style.left = `${target.left}px`;
    indicator.style.top = `${target.top}px`;
    indicator.style.width = `${target.width}px`;
    indicator.style.height = `${target.height}px`;
    indicator.dataset.positioned = "true";
    if (from && from.width && target.width && !reducedMotion.matches) {
      const targetRect = {
        left: stripRect.left + target.left - strip.scrollLeft,
        top: stripRect.top + target.top,
        width: target.width,
        height: target.height,
      };
      flip(indicator, from, targetRect, { duration: motionTokens.fast });
    }
    priorRect = null;
  };
  const scheduleUpdate = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(update);
  };
  document.addEventListener("click", event => {
    const category = event.target.closest("[data-category]");
    if (!category || !strip.contains(category)) return;
    const active = strip.querySelector(".category-chip.selected");
    priorRect = active?.getBoundingClientRect() || null;
    window.setTimeout(scheduleUpdate, 0);
  }, true);
  new MutationObserver(scheduleUpdate).observe(strip, { childList: true, subtree: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  scheduleUpdate();
}

function installNavigationMotion() {
  const nav = document.querySelector(".mobile-nav");
  if (!nav) return;
  const indicator = document.createElement("span");
  indicator.className = "mobile-nav-indicator";
  indicator.setAttribute("aria-hidden", "true");
  nav.prepend(indicator);
  nav.classList.add("has-active-indicator");
  let lastScrollY = window.scrollY;
  let scrollFrame = 0;
  let navRect = null;

  const positionIndicator = () => {
    const active = nav.querySelector('[aria-current="page"]');
    if (!active) return;
    const nextRect = active.getBoundingClientRect();
    const containerRect = nav.getBoundingClientRect();
    const fromRect = navRect;
    indicator.style.left = `${nextRect.left - containerRect.left}px`;
    indicator.style.top = `${nextRect.top - containerRect.top}px`;
    indicator.style.width = `${nextRect.width}px`;
    indicator.style.height = `${nextRect.height}px`;
    navRect = nextRect.width ? nextRect : null;
    if (fromRect?.width && nextRect.width && !reducedMotion.matches) {
      flip(indicator, fromRect, nextRect, { duration: 420 });
    }
  };
  const navObserver = new MutationObserver(() => requestAnimationFrame(positionIndicator));
  navObserver.observe(nav, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) nav.classList.remove("is-hidden");
    requestAnimationFrame(positionIndicator);
  }, { passive: true });
  requestAnimationFrame(positionIndicator);

  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));
  window.addEventListener("scroll", () => {
    if (window.innerWidth > 768 || reducedMotion.matches || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const keyboardFocus = nav.contains(document.activeElement)
        && document.activeElement.matches(":focus-visible");
      const blocked = document.body.classList.contains("mobile-keyboard-open")
        || document.body.classList.contains("sidebar-open")
        || Boolean(document.querySelector("dialog[open]"))
        || keyboardFocus;
      if (blocked || currentY < 72 || currentY < lastScrollY - 6) nav.classList.remove("is-hidden");
      else if (currentY > lastScrollY + 8) nav.classList.add("is-hidden");
      lastScrollY = currentY;
      scrollFrame = 0;
    });
  }, { passive: true });
}

function installSearchMotion() {
  const input = document.querySelector("#global-search");
  const box = input?.closest(".search-box");
  if (!input || !box) return;
  input.addEventListener("focus", () => box.classList.add("motion-search-focused"));
  input.addEventListener("blur", () => box.classList.remove("motion-search-focused"));
}

function installMoreCategoriesState() {
  const dialog = document.querySelector("#category-modal");
  if (!dialog) return;
  const setExpanded = value => document.querySelector(".more-categories")?.setAttribute("aria-expanded", String(value));
  setExpanded(false);
  dialog.addEventListener("close", () => setExpanded(false));
  dialog.addEventListener("cancel", () => setExpanded(false));
  document.addEventListener("click", event => {
    if (event.target.closest('[data-open="category-modal"]')) {
      setExpanded(true);
    }
  });
}

function installSaveMotion() {
  document.addEventListener("skillmate:provider-save", event => {
    const button = [...document.querySelectorAll(".save-button[data-save]")]
      .find(item => item.dataset.save === event.detail?.providerId && item.getClientRects().length);
    if (!button || reducedMotion.matches) return;
    const saved = Boolean(event.detail?.saved);
    if (saved) {
      button.classList.add("motion-heart-ripple");
      window.setTimeout(() => button.classList.remove("motion-heart-ripple"), 430);
    }
    animateMotion(button, saved ? [
      { transform: "scale(1)" },
      { transform: "scale(1.3)" },
      { transform: "scale(0.94)" },
      { transform: "scale(1)" },
    ] : [
      { transform: "scale(1)" },
      { transform: "scale(0.94)" },
      { transform: "scale(1)" },
    ], {
      duration: saved ? 430 : 150,
      easing: saved ? motionTokens.springBouncy : motionTokens.easeStandard,
      resetProperties: ["transform"],
    });
    if (saved && navigator.vibrate) navigator.vibrate(10);
  });
}

function installDrawerAccessibility() {
  const sidebar = document.querySelector("#sidebar");
  const backdrop = document.querySelector("#sidebar-backdrop");
  if (!sidebar || !backdrop) return;
  sidebar.querySelectorAll(".side-nav .nav-link").forEach((link, index) => {
    link.style.setProperty("--motion-index", String(Math.min(index, 7)));
  });
  document.addEventListener("keydown", event => {
    if (!sidebar.classList.contains("open") || window.innerWidth > 900) return;
    if (event.key === "Escape") {
      event.preventDefault();
      backdrop.click();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.getClientRects().length && !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

installDiscoverEntrance();
installCardReveal();
installCategoryIndicator();
installNavigationMotion();
installSearchMotion();
installMoreCategoriesState();
installSaveMotion();
installDrawerAccessibility();
window.skillmateMotionReady = true;
