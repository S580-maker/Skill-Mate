const {
  clearSessionCookie,
  getBearerToken,
  getSupabaseUser,
  setSessionCookie,
} = require("./_lib/supabase");

module.exports = async function session(request, response) {
  if (request.method === "DELETE") {
    clearSessionCookie(response);
    return response.status(204).end();
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, DELETE");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return response.status(401).json({ error: "A valid Supabase sign-in session is required." });
  }

  try {
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) {
      return response.status(401).json({ error: "Your sign-in session has expired. Please sign in again." });
    }
    setSessionCookie(response, accessToken);
    return response.status(204).end();
  } catch (error) {
    console.error("Could not validate the Skillmate session.", error);
    return response.status(503).json({ error: "Skillmate could not validate your session. Please try again." });
  }
};
