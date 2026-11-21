// Captures loading, loaded, empty and failed states at the supported widths.
// Usage: node tests/loading-screenshots.cjs <output-folder> [label]
const path = require("node:path");
const { start } = require("./support/loading-harness.cjs");

const folder = path.resolve(process.argv[2] || "loading-screenshots");
const label = process.argv[3] || "state";
const widths = [320, 375, 768, 1280, 1920];
const pages = ["home", "bookings", "messages", "saved", "provider", "earnings", "profile-settings"];

(async () => {
  const harness = await start();
  try {
    for (const theme of ["light", "dark"]) {
      await harness.setTheme(theme);
      for (const width of widths) {
        await harness.viewport(width, width < 600 ? 800 : 900);
        // Initial load: slow responses keep the startup skeleton on screen.
        for (const page of pages) {
          if (theme === "dark" && ![375, 1280].includes(width)) continue;
          await harness.open(`index.html?delay=4000#${page}`);
          await harness.wait(900);
          await harness.screenshot(path.join(folder, `${label}-loading-${page}-${theme}-${width}.png`));
        }
        if (theme === "dark" && ![375, 1280].includes(width)) continue;
        await harness.open("index.html?delay=0#home");
        await harness.wait(1800);
        await harness.screenshot(path.join(folder, `${label}-loaded-home-${theme}-${width}.png`));
        await harness.open("index.html?fail=all#home");
        await harness.wait(2500);
        await harness.screenshot(path.join(folder, `${label}-failed-home-${theme}-${width}.png`));
        await harness.open("index.html?empty=1#bookings");
        await harness.wait(1800);
        await harness.screenshot(path.join(folder, `${label}-empty-bookings-${theme}-${width}.png`));
      }
    }
    console.log(`Screenshots written to ${folder}`);
    if (harness.pageErrors.length) console.log("Page errors:", harness.pageErrors.slice(0, 5));
  } finally {
    await harness.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
