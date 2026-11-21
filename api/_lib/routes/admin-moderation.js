const {
  getSessionCookie,
  getSupabaseConfig,
  getSupabaseUser,
  getUserRole,
  isOtpVerifiedSession,
} = require("../supabase");
const { isSameOrigin, readJson } = require("../request-utils");

module.exports = async function adminModeration(request, response) {
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!isSameOrigin(request)) {
    return response.status(403).json({ error: "This action must be submitted from the Skillmate admin dashboard." });
  }

  const accessToken = getSessionCookie(request);
  if (!accessToken) return response.status(401).json({ error: "Administrator session required." });

  try {
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) return response.status(401).json({ error: "Administrator session is invalid." });
    const [otpVerified, role] = await Promise.all([
      isOtpVerifiedSession(accessToken, user.id),
      getUserRole(user.id, accessToken),
    ]);
    if (!otpVerified || role !== "admin") {
      return response.status(403).json({ error: "Verified administrator access is required." });
    }

    const { reportId, action, reportedUserId, reason, message } = request.body || {};
    if (!["warning", "suspension", "ban", "restore"].includes(action)
      || typeof reportedUserId !== "string"
      || (action !== "restore" && typeof reportId !== "string")
      || typeof reason !== "string" || reason.trim().length < 5 || reason.trim().length > 1000
      || typeof message !== "string" || message.trim().length < 5 || message.trim().length > 450) {
      return response.status(400).json({ error: "Provide a valid report action, reason, and user message." });
    }

    const config = getSupabaseConfig();
    const databaseResult = await fetch(`${config.url}/rest/v1/rpc/issue_moderation_action`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_report_id: reportId || null,
        p_action: action,
        p_reported_user_id: reportedUserId,
        p_reason: reason.trim(),
        p_message: message.trim(),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const actionResult = await readJson(databaseResult);
    if (!databaseResult.ok) {
      const error = actionResult.message || actionResult.error;
      console.error("Could not record administrator moderation action.", {
        status: databaseResult.status,
        code: actionResult.code,
        message: error,
      });
      if (databaseResult.status === 404 || actionResult.code === "PGRST202") {
        return response.status(503).json({
          error: "The moderation database migration is not applied. Apply supabase/migrations/20261108180000_admin_moderation.sql.",
        });
      }
      return response.status(400).json({ error: error || "Could not record this moderation action." });
    }

    const recordedAction = Array.isArray(actionResult) ? actionResult[0] : actionResult;
    if (!recordedAction?.id || recordedAction.reported_user_id !== reportedUserId) {
      console.error("The moderation RPC returned an invalid action record.");
      return response.status(502).json({ error: "The moderation record could not be verified. Check the report before retrying." });
    }
    if (action === "warning") {
      return response.status(200).json({ actionId: recordedAction.id, authRestrictionApplied: null });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceKey) {
      return response.status(503).json({
        actionApplied: true,
        error: "The account restriction is active in Skillmate, but the server is missing SUPABASE_SERVICE_ROLE_KEY, so the sign-in restriction could not be applied.",
      });
    }

    const authResult = await fetch(
      `${config.url}/auth/v1/admin/users/${encodeURIComponent(reportedUserId)}`,
      {
        method: "PUT",
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ban_duration: action === "suspension" ? "168h" : action === "ban" ? "876000h" : "none",
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!authResult.ok) {
      const authError = await readJson(authResult);
      console.error("Skillmate moderation action was recorded, but Supabase Auth restriction failed.", {
        status: authResult.status,
        message: authError.message || authError.msg,
      });
      return response.status(503).json({
        actionApplied: true,
        error: "The Skillmate restriction and notification are recorded, but Supabase could not update sign-in access. Check the server configuration and moderation history.",
      });
    }

    const auditResult = await fetch(
      `${config.url}/rest/v1/moderation_actions?id=eq.${encodeURIComponent(recordedAction.id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ auth_ban_applied: true }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!auditResult.ok) {
      console.error("Supabase Auth restriction succeeded, but moderation audit status could not be updated.", {
        status: auditResult.status,
        actionId: recordedAction.id,
      });
      return response.status(503).json({
        actionApplied: true,
        authRestrictionApplied: true,
        error: "The account restriction is active, but the audit status could not be updated. Check moderation history before retrying.",
      });
    }
    return response.status(200).json({ actionId: recordedAction.id, authRestrictionApplied: true });
  } catch (error) {
    console.error("Could not process administrator moderation action.", {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
    });
    return response.status(503).json({ error: "Skillmate could not complete this moderation action. Check the report and try again." });
  }
};
