(function initializeSkillflexSupabase() {
  const config = window.SKILLFLEX_SUPABASE_CONFIG;
  if (!config?.url && !config?.anonKey) {
    window.skillflexSupabase = null;
    window.skillflexSupabaseError = "";
    return;
  }

  if (!config.url || !config.anonKey) {
    window.skillflexSupabase = null;
    window.skillflexSupabaseError = "Set both SUPABASE_URL and SUPABASE_ANON_KEY in the server's .env file.";
    return;
  }

  let projectUrl;
  try {
    projectUrl = new URL(config.url);
  } catch {
    window.skillflexSupabase = null;
    window.skillflexSupabaseError = "The Supabase URL is invalid. Use the Project URL from Project Settings → API, not the database connection string.";
    return;
  }
  const apiPath = projectUrl.pathname.replace(/\/+$/, "");
  if (!["https:", "http:"].includes(projectUrl.protocol)
    || projectUrl.hostname.includes("pooler")
    || (apiPath !== "" && apiPath !== "/rest/v1")
    || projectUrl.search
    || projectUrl.hash) {
    window.skillflexSupabase = null;
    window.skillflexSupabaseError = "The Supabase URL must be the HTTPS Project URL from Project Settings → API, not a database pooler URL.";
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("Supabase JS did not load. Check the network connection and script source.");
    window.skillflexSupabase = null;
    window.skillflexSupabaseError = "Supabase’s browser library did not load. Check your internet connection, then reload.";
    return;
  }

  try {
    window.skillflexSupabase = window.supabase.createClient(projectUrl.origin, config.anonKey, {
      global: {
        fetch(input, options = {}) {
          const url = new URL(typeof input === "string" ? input : input.url || input.href, projectUrl.origin);
          const method = (options.method || input.method || "GET").toUpperCase();
          const uploading = url.pathname.startsWith("/storage/v1/object/") && ["POST", "PUT"].includes(method);
          // Reads, RPCs and writes all settle. Uploads get more time for campus
          // connections; timed-out writes are never retried by this transport.
          return window.skillflexApi.request(input, options, { timeout: uploading ? 60000 : 15000 });
        },
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    window.skillflexSupabaseError = "";
    window.skillflexSession = null;
    window.skillflexSupabase.auth.onAuthStateChange((event, session) => {
      window.skillflexSession = session;
      window.dispatchEvent(new CustomEvent("skillflex:auth-state-change", {
        detail: { event, session },
      }));
    });
    window.skillflexRestoreSession = async function restoreSkillflexSession() {
      const { data, error } = await window.skillflexSupabase.auth.getSession();
      if (error) throw error;
      window.skillflexSession = data.session;
      window.dispatchEvent(new CustomEvent("skillflex:auth-state-change", {
        detail: { event: "SESSION_RESTORED", session: data.session },
      }));
      return data.session;
    };
    window.skillflexSignOut = async function signOutSkillflex() {
      const { error } = await window.skillflexSupabase.auth.signOut();
      if (error) throw error;
      await window.clearSkillflexServerSession();
      window.skillflexSession = null;
      window.dispatchEvent(new CustomEvent("skillflex:auth-state-change", {
        detail: { event: "SIGNED_OUT", session: null },
      }));
    };
  } catch (error) {
    console.error("Could not initialize the Skill Flex Supabase client.", error);
    window.skillflexSupabase = null;
    window.skillflexSupabaseError = "Could not initialize Supabase. Check that the Project URL and public key belong to the same project.";
  }
})();

window.syncSkillflexServerSession = async function syncSkillflexServerSession(session) {
  if (!session?.access_token) throw new Error("Sign in again to continue.");
  const syncAccessToken = (accessToken) => window.skillflexApi.request("/api/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "same-origin",
  });
  let response = await syncAccessToken(session.access_token);
  if (response.status === 401 && session.refresh_token && window.skillflexSupabase) {
    const { data, error } = await window.skillflexSupabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (error) {
      const message = error.message?.toLowerCase() || "";
      const invalidRefreshToken = error.code === "refresh_token_not_found"
        || message.includes("invalid refresh token")
        || message.includes("refresh token not found");
      if (invalidRefreshToken) {
        await window.clearExpiredSkillflexSession();
        throw new Error("Your sign-in session expired. Please sign in again.");
      }
      throw error;
    }
    if (!data.session?.access_token) throw new Error("Your sign-in session has expired. Please sign in again.");
    response = await syncAccessToken(data.session.access_token);
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(result.error || "Could not establish a secure Skill Flex session.");
    error.code = result.code || "";
    throw error;
  }
};

let serverSessionClearPromise = null;

window.clearExpiredSkillflexSession = async function clearExpiredSkillflexSession() {
  if (window.skillflexSupabase) {
    try {
      const { error } = await window.skillflexSupabase.auth.signOut({ scope: "local" });
      if (error) console.error("Could not clear the expired local Skill Flex session.", error);
    } catch (error) {
      console.error("Could not clear the expired local Skill Flex session.", error);
    }
  }
  try {
    await window.clearSkillflexServerSession();
  } catch (error) {
    console.error("Could not clear the expired Skill Flex server session.", error);
  }
};

window.clearSkillflexServerSession = function clearSkillflexServerSession() {
  if (!serverSessionClearPromise) {
    serverSessionClearPromise = window.skillflexApi.request("/api/session", { method: "DELETE", credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not clear the secure Skill Flex session.");
      })
      .finally(() => {
        serverSessionClearPromise = null;
      });
  }
  return serverSessionClearPromise;
};
