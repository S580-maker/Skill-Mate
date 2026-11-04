(() => {
  const backgrounds = Array.from(document.querySelectorAll("[data-aurora]"));
  if (!backgrounds.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const visible = new Set();

  // Pause animations that are offscreen to save battery and GPU time.
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        entry.target.toggleAttribute("data-paused", !entry.isIntersecting);
        if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
      }
    });
    backgrounds.forEach(el => observer.observe(el));
  } else backgrounds.forEach(el => visible.add(el));
  document.addEventListener("visibilitychange", () => {
    backgrounds.forEach(el => { if (document.hidden) el.setAttribute("data-paused", ""); else if (visible.has(el)) el.removeAttribute("data-paused"); });
  });

  // Very gentle mouse parallax, desktop only, one rAF write per frame.
  let frame = 0, x = 0, y = 0;
  const apply = () => {
    frame = 0;
    for (const el of visible) {
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    }
  };
  window.addEventListener("pointermove", event => {
    if (reduced.matches || !finePointer.matches || event.pointerType !== "mouse") return;
    x = event.clientX / window.innerWidth - .5;
    y = event.clientY / window.innerHeight - .5;
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });
})();
