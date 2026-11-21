const { test } = require("node:test");
const assert = require("node:assert/strict");
const { requiresHomeScreenInstall } = require("../push-notification-platform");

test("iPhone and iPad users need to install Skill Flex before enabling notifications", () => {
  assert.equal(requiresHomeScreenInstall({
    platform: "iPhone",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    maxTouchPoints: 5,
    standalone: false,
  }), true);
  assert.equal(requiresHomeScreenInstall({
    platform: "MacIntel",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    maxTouchPoints: 5,
    standalone: false,
  }), true);
});

test("installed iOS apps and other platforms can enable notifications directly", () => {
  assert.equal(requiresHomeScreenInstall({
    platform: "iPhone",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    maxTouchPoints: 5,
    standalone: true,
  }), false);
  assert.equal(requiresHomeScreenInstall({
    platform: "Win32",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    maxTouchPoints: 0,
    standalone: false,
  }), false);
});
