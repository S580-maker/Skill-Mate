(function (root, factory) {
  const platform = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = platform;
  if (root) root.SkillflexPushPlatform = platform;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function requiresHomeScreenInstall({ platform, userAgent, maxTouchPoints, standalone }) {
    const isIos = /iPhone|iPad|iPod/i.test(userAgent)
      || (platform === "MacIntel" && maxTouchPoints > 1);
    return isIos && !standalone;
  }

  return { requiresHomeScreenInstall };
});
