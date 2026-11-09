/* Shared placeholders for data that has not arrived yet. Never hide cached data. */
(() => {
  function markup({ count = 3, variant = "list", label = "Loading content" } = {}) {
    const safeLabel = String(label).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    return `<div class="content-skeletons content-skeletons--${variant === "cards" ? "cards" : "list"}" role="status" aria-label="${safeLabel}">${Array.from({ length: count }, () => '<div class="content-skeleton" aria-hidden="true"><span class="skeleton content-skeleton-art"></span><div class="content-skeleton-copy"><span class="skeleton"></span><span class="skeleton"></span><span class="skeleton"></span></div></div>').join("")}</div>`;
  }
  function show(target, options) {
    if (!target) return () => {};
    const placeholder = document.createElement(target.tagName === "UL" || target.tagName === "OL" ? "li" : "div");
    placeholder.className = "content-loading-placeholder";
    placeholder.innerHTML = markup(options);
    target.setAttribute("aria-busy", "true");
    target.append(placeholder);
    return () => {
      placeholder.remove();
      target.removeAttribute("aria-busy");
    };
  }
  window.skillmateLoading = { markup, show };
})();
