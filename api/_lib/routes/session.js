const {
  clearSessionCookie,
  extendOtpVerifiedSession,
  getBearerToken,
  getSupabaseUser,
  isOtpVerifiedSession,
  setSessionCookie,
} = require("../supabase");

module.exports = async function session(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
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
      clearSessionCookie(response);
      return response.status(401).json({ error: "Your sign-in session has expired. Please sign in again." });
    }
    if (!await isOtpVerifiedSession(accessToken, user.id)) {
      clearSessionCookie(response);
      return response.status(403).json({
        code: "OTP_VERIFICATION_REQUIRED",
        error: "Verify your email to continue.",
      });
    }
    if (!await extendOtpVerifiedSession(accessToken, user.id)) {
      clearSessionCookie(response);
      return response.status(403).json({
        code: "OTP_VERIFICATION_REQUIRED",
        error: "Verify your email to continue.",
      });
    }
    setSessionCookie(response, accessToken);
    return response.status(204).end();
  } catch (error) {
    console.error("Could not validate the Skill Flex session.", error);
    return response.status(503).json({ error: "Skill Flex could not validate your session. Please try again." });
  }
};
