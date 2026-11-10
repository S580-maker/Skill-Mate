const policy = require("../../content-security-policy.json");

function contentSecurityPolicy({ production = process.env.NODE_ENV === "production", supabaseUrl = process.env.SUPABASE_URL } = {}) {
  const directives = Object.fromEntries(Object.entries(policy).map(([key, values]) => [key, [...values]]));
  // Preserve local preview embedding and explicitly configured HTTP Supabase installations.
  if (!production) delete directives["frame-ancestors"];
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol === "http:") {
      directives["connect-src"].push(url.origin, url.origin.replace(/^http:/, "ws:"));
      directives["img-src"].push(url.origin);
    }
  } catch { /* Configuration validation belongs to the existing Supabase initializer. */ }
  return directives;
}

const serializePolicy = directives => Object.entries(directives).map(([key, values]) => `${key} ${values.join(" ")}`).join(";");
module.exports = { contentSecurityPolicy, serializePolicy };
