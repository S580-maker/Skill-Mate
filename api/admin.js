const { readFile } = require("node:fs/promises");
const path = require("node:path");
const {
  clearSessionCookie,
  getSessionCookie,
  getSupabaseUser,
  getUserRole,
} = require("./_lib/supabase");

module.exports = async function admin(request, response) {
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
    const role = await getUserRole(user.id, accessToken);
    if (role !== "admin") return response.redirect(302, "/index.html");

    const html = await readFile(path.join(process.cwd(), "api", "_lib", "admin.html"), "utf8");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    return response.status(200).send(html);
  } catch (error) {
    console.error("Could not verify administrator access.", error);
    return response.status(503).send("Administrator access could not be verified. Please reload shortly.");
  }
};
