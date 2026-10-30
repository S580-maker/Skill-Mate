const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { getSupabaseConfig } = require("./supabase");

const challengeCookie = "skillmate_login_challenge";
const passwordRecoveryCookie = "skillmate_password_recovery";
const challengeLifetimeMs = 10 * 60 * 1000;
const resendCooldownMs = 30 * 1000;
const maximumChallengesPerWindow = 5;
const challengeWindowMs = 15 * 60 * 1000;

function getServiceKey() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) throw new Error("Email verification is not configured on this server.");
  return serviceKey;
}

function getOtpSecret() {
  const secret = process.env.AUTH_OTP_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Email verification is not configured on this server.");
  return secret;
}

function hashValue(value) {
  return crypto.createHmac("sha256", getOtpSecret()).update(value).digest("hex");
}

function encryptSession(session) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(getOtpSecret()).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: encrypted.toString("base64url"),
  };
}

function decryptSession(envelope) {
  if (envelope?.v !== 1) throw new Error("The pending sign-in session is invalid.");
  const key = crypto.createHash("sha256").update(getOtpSecret()).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function getCookie(request, name = challengeCookie) {
  if (request.cookies?.[name]) return request.cookies[name];
  const cookie = (request.headers?.cookie || "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice(name.length + 1));
  } catch {
    return "";
  }
}

function appendCookie(response, name, token, maxAge, path) {
  const secure = process.env.NODE_ENV === "production"
    || requestIsSecure(response.req);
  const cookie = `${name}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=${path}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  const existing = response.getHeader?.("Set-Cookie");
  const values = Array.isArray(existing) ? existing : existing ? [existing] : [];
  response.setHeader("Set-Cookie", [...values, cookie]);
}

function setChallengeCookie(response, token) {
  appendCookie(response, challengeCookie, token, 600, "/api/auth");
}

function requestIsSecure(request) {
  return request?.headers?.["x-forwarded-proto"] === "https"
    || request?.protocol === "https";
}

function clearChallengeCookie(response) {
  appendCookie(response, challengeCookie, "", 0, "/api/auth");
}

function setPasswordRecoveryCookie(response, token) {
  appendCookie(response, passwordRecoveryCookie, token, 600, "/api/auth/password-recovery");
}

function clearPasswordRecoveryCookie(response) {
  appendCookie(response, passwordRecoveryCookie, "", 0, "/api/auth/password-recovery");
}

function getSupabaseHeaders(key) {
  return { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
}

async function supabaseRequest(path, options = {}, useServiceKey = false) {
  const config = getSupabaseConfig();
  const key = useServiceKey ? getServiceKey() : config.anonKey;
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: { ...getSupabaseHeaders(key), ...options.headers },
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

function getMailer() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!host || !user || !pass || !from) throw new Error("Email verification is not configured on this server.");
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    from: from.includes("<") ? from : `Skillmate <${from}>`,
    transport: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user, pass },
    }),
  };
}

async function sendCode(email, code, purpose) {
  const { from, transport } = getMailer();
  const signup = purpose === "signup";
  const subject = signup ? "Verify your Skillmate account" : "Your Skillmate sign-in code";
  const recovery = purpose === "recovery";
  const heading = recovery ? "Reset your password" : signup ? "Verify your email" : "Verify it’s you";
  const instruction = recovery
    ? "Enter this code to verify your email before resetting your password."
    : signup
      ? "Enter this code to create your Skillmate account."
      : "Enter this code to finish signing in.";
  const messageSubject = recovery
    ? "Your Skillmate password reset code"
    : subject;
  await transport.sendMail({
    from,
    to: email,
    subject: messageSubject,
    text: `${instruction} Your Skillmate verification code is ${code}. It expires in 10 minutes. If you did not request it, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;color:#172033;max-width:480px;margin:0 auto;padding:32px"><div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#596b8a">SKILLMATE</div><h1 style="font-size:24px;margin:28px 0 8px">${heading}</h1><p style="color:#596273;line-height:1.6">${instruction} It expires in 10 minutes.</p><div style="margin:26px 0;padding:18px;border:1px solid #dfe4ee;border-radius:12px;background:#f8f9fc;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px">${code}</div><p style="color:#747d8d;font-size:12px">If you did not request it, you can ignore this email.</p></div>`,
  });
}

function respondError(response, status, message) {
  return response.status(status).json({ error: message });
}

async function deleteExpiredChallenges() {
  const before = encodeURIComponent(new Date().toISOString());
  await supabaseRequest(`/rest/v1/auth_login_challenges?expires_at=lt.${before}`, {
    method: "DELETE",
  }, true);
}

async function findRecentChallenge(email) {
  const windowStart = new Date(Date.now() - challengeWindowMs).toISOString();
  const query = new URLSearchParams({
    select: "last_sent_at",
    email: `eq.${email}`,
    last_sent_at: `gt.${windowStart}`,
    order: "last_sent_at.desc",
    limit: String(maximumChallengesPerWindow),
  });
  const { response, result } = await supabaseRequest(`/rest/v1/auth_login_challenges?${query}`, {}, true);
  if (!response.ok) throw new Error("Could not check the email verification request.");
  return result;
}

async function createChallenge(email, pending) {
  const token = crypto.randomBytes(32).toString("base64url");
  const challengeHash = hashValue(token);
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + challengeLifetimeMs).toISOString();
  const pendingData = pending.type === "signup"
    ? pending
    : pending.type === "recovery"
      ? { type: "recovery", userId: pending.userId }
    : {
      type: "session",
      session: {
        access_token: pending.access_token,
        refresh_token: pending.refresh_token,
        expires_in: pending.expires_in,
        expires_at: pending.expires_at,
        token_type: pending.token_type,
      },
    };
  await deleteExpiredChallenges();
  const { response } = await supabaseRequest("/rest/v1/auth_login_challenges", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      challenge_hash: challengeHash,
      code_hash: hashValue(`${challengeHash}:${code}`),
      email,
      session_data: encryptSession(pendingData),
      expires_at: expiresAt,
      last_sent_at: new Date().toISOString(),
    }),
  }, true);
  if (!response.ok) throw new Error("Could not create an email verification challenge.");
  try {
    await sendCode(email, code, pending.type);
  } catch (error) {
    await supabaseRequest(`/rest/v1/auth_login_challenges?challenge_hash=eq.${challengeHash}`, { method: "DELETE" }, true);
    throw error;
  }
  return token;
}

async function createPasswordRecoveryGrant(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const challengeHash = hashValue(token);
  const { response } = await supabaseRequest("/rest/v1/auth_login_challenges", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      challenge_hash: challengeHash,
      code_hash: hashValue(`${challengeHash}:${token}`),
      email: "",
      session_data: encryptSession({ type: "recovery-grant", userId }),
      expires_at: new Date(Date.now() + challengeLifetimeMs).toISOString(),
      last_sent_at: new Date().toISOString(),
    }),
  }, true);
  if (!response.ok) throw new Error("Could not create the password recovery session.");
  return token;
}

async function requestPasswordRecovery(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return respondError(response, 405, "Method not allowed.");
  }
  const email = String(request.body?.email || "").trim().toLowerCase();
  const genericMessage = "If an account uses this email, a six-digit verification code has been sent.";
  if (!/^\S+@\S+\.\S+$/.test(email)) return response.status(200).json({ message: genericMessage });

  try {
    getServiceKey();
    getOtpSecret();
    const { response: lookupResponse, result } = await supabaseRequest("/auth/v1/admin/generate_link", {
      method: "POST",
      body: JSON.stringify({ type: "recovery", email }),
    }, true);
    if (lookupResponse.status >= 400 && lookupResponse.status < 500
      && lookupResponse.status !== 401 && lookupResponse.status !== 403) {
      return response.status(200).json({ message: genericMessage });
    }
    if (!lookupResponse.ok) throw new Error("Could not look up the password recovery account.");
    const userId = result?.user?.id;
    if (!userId) return response.status(200).json({ message: genericMessage });

    const recent = await findRecentChallenge(email);
    if (recent.length >= maximumChallengesPerWindow
      || (recent[0] && Date.now() - new Date(recent[0].last_sent_at).getTime() < resendCooldownMs)) {
      return response.status(200).json({ message: genericMessage });
    }
    const token = await createChallenge(email, { type: "recovery", userId });
    setChallengeCookie(response, token);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error("Could not start Skillmate password recovery.", error);
    return respondError(response, 503, "Password recovery is temporarily unavailable. Please try again shortly.");
  }
}

async function updateRecoveredPassword(request, response) {
  if (request.method !== "PUT") {
    response.setHeader("Allow", "PUT");
    return respondError(response, 405, "Method not allowed.");
  }
  const token = getCookie(request, passwordRecoveryCookie);
  const password = String(request.body?.password || "");
  if (!token) return respondError(response, 410, "Your verification expired. Request a new password reset code.");
  if (password.length < 8 || password.length > 1024) {
    return respondError(response, 400, "Choose a password with at least 8 characters.");
  }

  try {
    const challengeHash = hashValue(token);
    const { response: consumeResponse, result } = await supabaseRequest("/rest/v1/rpc/consume_email_login_challenge", {
      method: "POST",
      body: JSON.stringify({
        p_challenge_hash: challengeHash,
        p_code_hash: hashValue(`${challengeHash}:${token}`),
      }),
    }, true);
    if (!consumeResponse.ok) throw new Error("Could not validate the password recovery session.");
    clearPasswordRecoveryCookie(response);
    if (result?.status !== "verified" || !result.session) {
      return respondError(response, 410, "Your verification expired. Request a new password reset code.");
    }

    const recovery = decryptSession(result.session);
    if (recovery.type !== "recovery-grant" || !recovery.userId) {
      throw new Error("The password recovery session is invalid.");
    }
    const { response: updateResponse } = await supabaseRequest(
      `/auth/v1/admin/users/${encodeURIComponent(recovery.userId)}`,
      { method: "PUT", body: JSON.stringify({ password }) },
      true,
    );
    if (!updateResponse.ok) throw new Error("Could not update the account password.");
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ message: "Your password has been updated. Sign in with your new password." });
  } catch (error) {
    console.error("Could not complete Skillmate password recovery.", error);
    return respondError(response, 503, "Could not update your password right now. Request a new code and try again.");
  }
}

async function signIn(request, response) {
  if (request.method === "DELETE") {
    const token = getCookie(request);
    if (token) {
      try {
        const challengeHash = hashValue(token);
        await supabaseRequest(`/rest/v1/auth_login_challenges?challenge_hash=eq.${challengeHash}`, { method: "DELETE" }, true);
      } catch (error) {
        console.error("Could not remove the abandoned Skillmate login challenge.", error);
      }
    }
    clearChallengeCookie(response);
    return response.status(204).end();
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, DELETE");
    return respondError(response, 405, "Method not allowed.");
  }

  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 1 || password.length > 1024) {
    return respondError(response, 400, "Enter a valid email address and password.");
  }

  try {
    getServiceKey();
    getOtpSecret();
    const { response: authResponse, result: session } = await supabaseRequest(
      "/auth/v1/token?grant_type=password",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    if (!authResponse.ok || !session.access_token || !session.refresh_token || !session.user?.email) {
      return respondError(response, 401, "We couldn’t sign you in with those details. Check your email and password, or confirm your email and try again.");
    }

    const recent = await findRecentChallenge(session.user.email.toLowerCase());
    if (recent[0] && Date.now() - new Date(recent[0].last_sent_at).getTime() < resendCooldownMs) {
      return respondError(response, 429, "A sign-in code was sent recently. Wait 30 seconds before trying again.");
    }
    if (recent.length >= maximumChallengesPerWindow) {
      return respondError(response, 429, "Too many sign-in codes were requested. Please wait 15 minutes and try again.");
    }
    const token = await createChallenge(session.user.email, session);
    setChallengeCookie(response, token);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ message: "A six-digit sign-in code was sent to your email." });
  } catch (error) {
    console.error("Could not start Skillmate email verification.", error);
    return respondError(response, 503, "Email verification is temporarily unavailable. Please try again shortly.");
  }
}

async function signUp(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return respondError(response, 405, "Method not allowed.");
  }
  const email = String(request.body?.email || "").trim().toLowerCase();
  const password = String(request.body?.password || "");
  const fullName = String(request.body?.fullName || "").trim();
  const university = String(request.body?.university || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 1024
    || fullName.length < 2 || fullName.length > 80 || university.length < 2 || university.length > 120) {
    return respondError(response, 400, "Enter a valid email, password, name, and university.");
  }

  try {
    getServiceKey();
    getOtpSecret();
    const recent = await findRecentChallenge(email);
    if (recent[0] && Date.now() - new Date(recent[0].last_sent_at).getTime() < resendCooldownMs) {
      return respondError(response, 429, "A sign-in code was sent recently. Wait 30 seconds before trying again.");
    }
    if (recent.length >= maximumChallengesPerWindow) {
      return respondError(response, 429, "Too many sign-in codes were requested. Please wait 15 minutes and try again.");
    }
    const token = await createChallenge(email, { type: "signup", email, password, fullName, university });
    setChallengeCookie(response, token);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ message: "A six-digit verification code was sent to your email." });
  } catch (error) {
    console.error("Could not start Skillmate signup verification.", error);
    return respondError(response, 503, "Email verification is temporarily unavailable. Please try again shortly.");
  }
}

async function createSupabaseAccount(pending) {
  const { response: createResponse, result: createdUser } = await supabaseRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: pending.email,
      password: pending.password,
      email_confirm: true,
      user_metadata: { full_name: pending.fullName, university: pending.university },
    }),
  }, true);
  if (createResponse.status === 409 || createResponse.status === 422) {
    return { error: "An account may already exist with this email. Try signing in instead.", status: 409 };
  }
  if (!createResponse.ok || !createdUser.id) throw new Error("Could not create the verified Skillmate account.");

  const { response: authResponse, result: session } = await supabaseRequest(
    "/auth/v1/token?grant_type=password",
    { method: "POST", body: JSON.stringify({ email: pending.email, password: pending.password }) },
  );
  if (!authResponse.ok || !session.access_token || !session.refresh_token) {
    throw new Error("The account was created but a sign-in session could not be issued.");
  }
  return { session };
}

async function verify(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return respondError(response, 405, "Method not allowed.");
  }
  const token = getCookie(request);
  const code = String(request.body?.code || "");
  if (!token || !/^\d{6}$/.test(code)) return respondError(response, 400, "Enter the six-digit code from your email.");

  try {
    const { response: consumeResponse, result } = await supabaseRequest("/rest/v1/rpc/consume_email_login_challenge", {
      method: "POST",
      body: JSON.stringify({
        p_challenge_hash: hashValue(token),
        p_code_hash: hashValue(`${hashValue(token)}:${code}`),
      }),
    }, true);
    if (!consumeResponse.ok) throw new Error("Could not verify the email code.");
    if (result?.status === "verified" && result.session) {
      const pending = decryptSession(result.session);
      if (pending.type === "recovery") {
        if (!pending.userId) throw new Error("The password recovery challenge is incomplete.");
        const recoveryToken = await createPasswordRecoveryGrant(pending.userId);
        clearChallengeCookie(response);
        setPasswordRecoveryCookie(response, recoveryToken);
        response.setHeader("Cache-Control", "no-store");
        return response.status(200).json({ recovery: true });
      }
      clearChallengeCookie(response);
      let verifiedSession = pending.session;
      if (pending.type === "signup") {
        const account = await createSupabaseAccount(pending);
        if (account.error) return respondError(response, account.status, account.error);
        verifiedSession = account.session;
      }
      if (!verifiedSession?.access_token || !verifiedSession?.refresh_token) {
        throw new Error("The verified sign-in session is incomplete.");
      }
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({ session: verifiedSession });
    }
    if (result?.status === "expired") {
      clearChallengeCookie(response);
      return respondError(response, 410, "That code has expired. Sign in again to get a new one.");
    }
    if (result?.status === "locked") {
      clearChallengeCookie(response);
      return respondError(response, 429, "Too many incorrect codes. Sign in again to request a new code.");
    }
    return respondError(response, 400, "That code doesn’t match. Check it and try again.");
  } catch (error) {
    console.error("Could not verify the Skillmate email code.", error);
    return respondError(response, 503, "Could not verify your code right now. Please try again.");
  }
}

async function resend(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return respondError(response, 405, "Method not allowed.");
  }
  const token = getCookie(request);
  if (!token) return respondError(response, 410, "Your verification has expired. Sign in again to get a new code.");

  try {
    const challengeHash = hashValue(token);
    const query = new URLSearchParams({
      select: "email,expires_at,last_sent_at,resend_count,session_data",
      challenge_hash: `eq.${challengeHash}`,
      expires_at: `gt.${new Date().toISOString()}`,
      resend_count: "lt.5",
      limit: "1",
    });
    const { response: lookupResponse, result } = await supabaseRequest(`/rest/v1/auth_login_challenges?${query}`, {}, true);
    const challenge = result[0];
    if (!lookupResponse.ok) throw new Error("Could not load the email verification challenge.");
    if (!challenge) {
      clearChallengeCookie(response);
      return respondError(response, 410, "Your verification expired or reached its resend limit. Sign in again to get a new code.");
    }
    if (Date.now() - new Date(challenge.last_sent_at).getTime() < resendCooldownMs) {
      const seconds = Math.ceil((resendCooldownMs - (Date.now() - new Date(challenge.last_sent_at).getTime())) / 1000);
      return respondError(response, 429, `Please wait ${seconds} seconds before requesting another code.`);
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const { response: updateResponse } = await supabaseRequest(
      `/rest/v1/auth_login_challenges?challenge_hash=eq.${challengeHash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          code_hash: hashValue(`${challengeHash}:${code}`),
          last_sent_at: new Date().toISOString(),
          resend_count: challenge.resend_count + 1,
        }),
      },
      true,
    );
    if (!updateResponse.ok) throw new Error("Could not update the email verification code.");
    const pending = decryptSession(challenge.session_data);
    await sendCode(challenge.email, code, pending.type);
    return response.status(200).json({ message: "A new code was sent to your email." });
  } catch (error) {
    console.error("Could not resend the Skillmate email code.", error);
    return respondError(response, 503, "Could not resend your code right now. Please try again.");
  }
}

module.exports = {
  requestPasswordRecovery,
  resend,
  signIn,
  signUp,
  updateRecoveredPassword,
  verify,
};