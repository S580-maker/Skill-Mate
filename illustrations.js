/* Genuine local Storyset artwork. Optional official HTML exports stay inside a shadow root. */
(() => {
  const assets = {
    onboarding: { slug: "college-students", credit: "Education" },
    search: { slug: "search", credit: "Search" },
    saved: { slug: "bookmarks", credit: "Bookmarks" },
    bookings: { slug: "schedule", credit: "Calendar" },
    listings: { slug: "freelancer", credit: "Work" },
    messages: { slug: "chatting", credit: "Chat" },
    success: { slug: "confirmed", credit: "Success" },
  };
  // To use an official animated export, set an entry's animatedFile to e.g. "search.html".
  // Keep its matching static SVG for reduced motion and failure recovery. See the asset README.
  const cache = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const mounted = new Set();
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.setVisible(entry.isIntersecting);
  }, { threshold: 0.05 }) : null;

  async function readAsset(file) {
    if (!/^[a-z-]+\.(svg|html)$/.test(file)) throw new Error("Unsupported illustration path");
    if (!cache.has(file)) {
      const controller = new AbortController();
      const deadline = setTimeout(() => controller.abort(), 8000);
      const request = fetch(`/assets/illustrations/storyset/${file}`, { credentials: "omit", signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error("Illustration unavailable");
          const text = await response.text();
          if (text.length > 500000) throw new Error("Illustration is too large");
          const doc = new DOMParser().parseFromString(text, file.endsWith(".svg") ? "image/svg+xml" : "text/html");
          const svg = doc.querySelector("svg");
          if (!svg || doc.querySelector("parsererror")) throw new Error("Invalid illustration");
          // These are reviewed, local assets, never user-supplied HTML. Reject active content
          // and external resources as an additional guard when installing future exports.
          if (doc.querySelector("script, foreignObject, iframe, object, embed, image, use, animate, animateTransform, set")) throw new Error("Unsupported SVG content");
          for (const element of [svg, ...svg.querySelectorAll("*")]) {
            for (const attribute of element.attributes) {
              if (/^on/i.test(attribute.name) || /^(?:href|xlink:href|src)$/i.test(attribute.name)) throw new Error("Unsupported SVG attribute");
            }
          }
          const styles = [...doc.querySelectorAll("style")].map(style => style.textContent).join("\n");
          const inlineStyles = [...svg.querySelectorAll("[style]")].map(element => element.getAttribute("style")).join("\n");
          const css = styles + inlineStyles;
          if (/@import|expression\(|\\/i.test(css) || [...css.matchAll(/url\(([^)]*)\)/gi)].some(match => !/^['"]?#[\w-]+['"]?$/.test(match[1].trim()))) throw new Error("External SVG styles are unsupported");
          svg.querySelectorAll("style").forEach(style => style.remove());
          svg.setAttribute("aria-hidden", "true");
          svg.setAttribute("focusable", "false");
          return { svg, styles };
        }).catch(error => { if (cache.get(file) === request) cache.delete(file); throw error; })
        .finally(() => clearTimeout(deadline));
      cache.set(file, request);
    }
    return cache.get(file);
  }

  const frameStyles = `
    :host { display:block; width:var(--illustration-width,176px); max-width:100%; flex:none; margin:0 auto 8px; }
    .frame { position:relative; aspect-ratio:1; display:grid; place-items:center; border-radius:var(--illustration-radius,16px); background:var(--illustration-background,#f7f4ec); overflow:hidden; }
    .art { width:100%; height:100%; }
    svg { display:block; width:100%; height:100%; }
    .frame > slot { position:absolute; inset:0; display:grid; place-items:center; color:var(--muted,#102d72); font-size:28px; }
    ::slotted(*) { margin:0!important; }
    ::slotted(img) { width:100%; height:100%; object-fit:contain; }
    :host([data-ready]) .frame > slot { display:none; }
    .gentle { animation:sm-enter 600ms ease-out both,sm-float 1600ms 600ms ease-in-out 2; }
    @keyframes sm-enter { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
    @keyframes sm-float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
    @media(prefers-reduced-motion:reduce) { .gentle { animation:none!important; } }
  `;

  class SkillmateIllustration extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.finished = false;
      this.visible = false;
      this.version = 0;
    }
    connectedCallback() {
      this.asset = assets[this.getAttribute("name")];
      if (!this.asset) return;
      // A removed empty state can be reattached after connectivity recovers.
      this.failed = false;
      this.removeAttribute("data-unavailable");
      mounted.add(this);
      if (!this.shadowRoot.firstChild) {
        const style = document.createElement("style"); style.textContent = frameStyles;
        const frame = document.createElement("div"); frame.className = "frame"; frame.setAttribute("aria-hidden", "true");
        this.art = document.createElement("div"); this.art.className = "art";
        frame.append(this.art, document.createElement("slot"));
        this.shadowRoot.append(style, frame);
      }
      if (observer) observer.observe(this); else this.setVisible(true);
      if (this.getAttribute("loading") === "eager") this.load();
    }
    disconnectedCallback() {
      observer?.unobserve(this);
      mounted.delete(this);
      this.settle();
      this.version++;
      this.loading = false;
      this.visible = false;
      this.pause();
    }
    setVisible(visible) {
      this.visible = visible;
      if (visible && !this.hasAttribute("data-ready")) this.load();
      this.syncMotion();
    }
    async load() {
      if (this.loading || this.failed || this.hasAttribute("data-ready")) return;
      this.loading = true;
      const version = ++this.version;
      try {
        this.staticAsset = await readAsset(`${this.getAttribute("name")}.svg`);
        let artwork = this.staticAsset;
        if (this.asset.animatedFile && !reducedMotion.matches && !this.finished) {
          try { artwork = await readAsset(this.asset.animatedFile); } catch { /* Use the original SVG. */ }
        }
        if (!this.isConnected || version !== this.version) return;
        if (reducedMotion.matches || this.finished) artwork = this.staticAsset;
        this.paint(artwork, artwork === this.staticAsset && !reducedMotion.matches && !this.finished);
        this.setAttribute("data-ready", "");
        this.syncMotion();
      } catch {
        if (!this.isConnected || version !== this.version) return;
        this.failed = true;
        this.setAttribute("data-unavailable", "");
        // The original icon, copy and action remain usable without the artwork.
      } finally {
        if (version === this.version) this.loading = false;
      }
    }
    retry() {
      if (!this.failed) return;
      this.failed = false;
      this.removeAttribute("data-unavailable");
      if (this.visible || this.getAttribute("loading") === "eager") this.load();
    }
    paint(artwork, gentle = false) {
      if (this.paintedAsset === artwork && this.gentle === gentle) return;
      const style = document.createElement("style"); style.textContent = artwork.styles;
      this.art.replaceChildren(style, artwork.svg.cloneNode(true));
      this.art.classList.toggle("gentle", gentle);
      this.paintedAsset = artwork;
      this.gentle = gentle;
    }
    animations() { return this.art?.getAnimations({ subtree: true }) || []; }
    pause() { this.animations().forEach(animation => animation.pause()); }
    settle() {
      clearTimeout(this.finishTimer);
      this.finishTimer = null;
      this.finished = true;
      if (this.staticAsset && this.art) this.paint(this.staticAsset);
    }
    syncMotion() {
      if (!this.art) return;
      if (reducedMotion.matches) { this.settle(); return; }
      if (!this.visible || document.hidden) { this.pause(); return; }
      if (this.finished) return;
      this.animations().forEach(animation => { if (animation.playState === "paused") animation.play(); });
      // Even an infinite official export settles back to the original static artwork.
      if (this.hasAttribute("data-ready") && !this.finishTimer) this.finishTimer = setTimeout(() => this.settle(), 4500);
    }
  }
  customElements.define("skillmate-illustration", SkillmateIllustration);
  reducedMotion.addEventListener("change", () => mounted.forEach(element => element.syncMotion()));
  document.addEventListener("visibilitychange", () => mounted.forEach(element => element.syncMotion()));
  window.addEventListener("online", () => mounted.forEach(element => element.retry()));

  function mount(target, name, fallback) {
    if (!target || !assets[name] || target.querySelector("skillmate-illustration")) return;
    const illustration = document.createElement("skillmate-illustration");
    illustration.setAttribute("name", name);
    if (fallback) illustration.append(fallback);
    target.prepend(illustration);
    return illustration;
  }
  function hideBookingSuccess() {
    const panel = document.querySelector("#booking-success");
    if (panel) panel.hidden = true;
  }
  function showBookingSuccess({ local = false } = {}) {
    const panel = document.querySelector("#booking-success");
    if (!panel) return;
    panel.querySelector("[data-booking-success-title]").textContent = local ? "Booking saved on this device" : "Booking request sent";
    panel.querySelector("[data-booking-success-description]").textContent = local
      ? "This booking is saved locally on this device."
      : "Awaiting provider confirmation. You can track the request below.";
    panel.hidden = false;
    panel.querySelector("[data-dismiss-booking-success]").onclick = hideBookingSuccess;
  }
  window.skillmateIllustrations = { mount, showBookingSuccess, hideBookingSuccess };
})();
