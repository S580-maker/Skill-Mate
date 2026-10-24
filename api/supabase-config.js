const { getSupabaseConfig } = require("./_lib/supabase");

module.exports = function supabaseConfig(_request, response) {
  try {
    const config = getSupabaseConfig();
    response
      .setHeader("Content-Type", "application/javascript; charset=utf-8")
      .setHeader("Cache-Control", "no-store")
      .status(200)
      .send(`window.SKILLMATE_SUPABASE_CONFIG = ${JSON.stringify(config)};`);
  } catch (error) {
    console.error("Could not load Skillmate's Supabase configuration.", error);
    response.status(503).type("text/plain").send("Skillmate's Supabase configuration is unavailable.");
  }
};
