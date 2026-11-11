const { readFile } = require("node:fs/promises");
const path = require("node:path");
const {
  clearSessionCookie,
  getSessionCookie,
  isOtpVerifiedSession,
  getSupabaseUser,
  getUserRole,
} = require("./_lib/supabase");
const { adminRateLimit, runRateLimited } = require("./_lib/rate-limit");

async function handleAdmin(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).send("Method not allowed.");
  }

  const accessToken = getSessionCookie(request);
  if (!accessToken) return response.redirect(302, "/login.html?next=admin");

  try {
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) {
      clearSessionCookie(response);
      return response.redirect(302, "/login.html?next=admin");
    }
    if (!await isOtpVerifiedSession(accessToken, user.id)) {
      clearSessionCookie(response);
      return response.redirect(302, "/login.html?verify=required&next=admin");
    }
    const role = await getUserRole(user.id, accessToken);
    if (role !== "admin") return response.redirect(302, "/index.html");

    // Vercel publishes dist/public and includes this private, compiled template
    // in the function. Local Express uses its own protected template route.
    const templateRoot = process.env.VERCEL === "1" ? path.join(process.cwd(), "dist") : process.cwd();
    const html = await readFile(path.join(templateRoot, "api", "_lib", "admin.html"), "utf8");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.status(200).send(html);
  } catch (error) {
    console.error("Could not verify administrator access.", error);
    return response.status(503).send("Administrator access could not be verified. Please reload shortly.");
  }
}

module.exports = function admin(request, response) {
  return runRateLimited(request, response, adminRateLimit, () => handleAdmin(request, response));
};
