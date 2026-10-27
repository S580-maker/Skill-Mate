const { randomBytes } = require("node:crypto");

const accountClosedEmail = (userId) => `closed+${userId}@deleted.skillmate.invalid`;

async function requestSupabase(url, serviceRoleKey, path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Supabase account closure request failed (${response.status}): ${detail.slice(0, 300)}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

async function removeStorageFolder(url, serviceRoleKey, bucket, userId, optionalBucket = false) {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const response = await requestSupabase(
      url,
      serviceRoleKey,
      `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
      {
        method: "POST",
        body: JSON.stringify({
          prefix: userId,
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      },
    ).catch(error => {
      if (optionalBucket && [400, 404].includes(error.status) && /bucket.*not found/i.test(error.message)) return null;
      throw error;
    });
    if (!response) return;
    const objects = await response.json();
    const batch = objects.map((object) => (
      object.name.startsWith(`${userId}/`) ? object.name : `${userId}/${object.name}`
    ));
    files.push(...batch);
    if (objects.length < 100) break;
  }
  for (let start = 0; start < files.length; start += 100) {
    await requestSupabase(url, serviceRoleKey, `/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: "DELETE",
      body: JSON.stringify({ prefixes: files.slice(start, start + 100) }),
    });
  }
}

async function anonymizeAndDisableAccount(userId) {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Account deletion requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.");
  }

  const userUpdate = {
    email: accountClosedEmail(userId),
    email_confirm: true,
    password: randomBytes(48).toString("base64url"),
    ban_duration: "876000h",
    user_metadata: { account_closed: true },
  };
  await requestSupabase(url, serviceRoleKey, `/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify(userUpdate),
  });
  // Disable sign-in first. A cleanup failure must never leave an active account
  // whose profile and booking data have already been anonymized.
  await requestSupabase(url, serviceRoleKey, "/rest/v1/rpc/anonymize_closed_account", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId }),
  });
  await Promise.all([
    removeStorageFolder(url, serviceRoleKey, "profile-avatars", userId),
    removeStorageFolder(url, serviceRoleKey, "portfolio-images", userId),
    removeStorageFolder(url, serviceRoleKey, "support-screenshots", userId),
    removeStorageFolder(url, serviceRoleKey, "service-covers", userId, true),
  ]);
}

async function handleAccountDelete(request, response, accessToken) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (request.body?.confirmation !== "DELETE") {
    return response.status(400).json({ error: "Type DELETE to confirm account closure." });
  }
  if (!accessToken) {
    return response.status(401).json({ error: "Sign in again before deleting your account." });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return response.status(503).json({ error: "Account closure is unavailable until the site administrator completes server setup. No account changes were made." });
  }

  let closingUserId;
  try {
    const { getSupabaseUser, getUserRole } = require("./supabase");
    const user = await getSupabaseUser(accessToken);
    if (!user?.id) return response.status(401).json({ error: "Your sign-in session has expired." });
    closingUserId = user.id;
    if (await getUserRole(user.id, accessToken) === "admin") {
      return response.status(403).json({ error: "Administrator accounts cannot be deleted from this page." });
    }
    await anonymizeAndDisableAccount(user.id);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ message: "Your account was anonymized and permanently disabled." });
  } catch (error) {
    console.error("Could not anonymize and disable the Skillmate account.", { userId: closingUserId, error });
    return response.status(503).json({
      error: "Account closure could not finish. Sign-in may already be disabled. Contact support to complete closure before retrying.",
    });
  }
}

module.exports = { handleAccountDelete };
