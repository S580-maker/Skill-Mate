(function initializeSkillmateSupabase() {
  const config = window.SKILLMATE_SUPABASE_CONFIG;
  if (!config?.url && !config?.anonKey) {
    window.skillmateSupabase = null;
    window.skillmateSupabaseError = "";
    return;
  }

  if (!config.url || !config.anonKey) {
    window.skillmateSupabase = null;
    window.skillmateSupabaseError = "Set both SUPABASE_URL and SUPABASE_ANON_KEY in the server's .env file.";
    return;
  }

  let projectUrl;
  try {
    projectUrl = new URL(config.url);
  } catch {
    window.skillmateSupabase = null;
    window.skillmateSupabaseError = "The Supabase URL is invalid. Use the Project URL from Project Settings → API, not the database connection string.";
    return;
  }
  const apiPath = projectUrl.pathname.replace(/\/+$/, "");
  if (!["https:", "http:"].includes(projectUrl.protocol)
    || projectUrl.hostname.includes("pooler")
    || (apiPath !== "" && apiPath !== "/rest/v1")
    || projectUrl.search
    || projectUrl.hash) {
    window.skillmateSupabase = null;
    window.skillmateSupabaseError = "The Supabase URL must be the HTTPS Project URL from Project Settings → API, not a database pooler URL.";
    return;
  }

  if (!window.supabase?.createClient) {
    console.error("Supabase JS did not load. Check the network connection and script source.");
    window.skillmateSupabase = null;
    window.skillmateSupabaseError = "Supabase’s browser library did not load. Check your internet connection, then reload.";
    return;
  }

  try {
    window.skillmateSupabase = window.supabase.createClient(projectUrl.origin, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    window.skillmateSupabaseError = "";
    window.skillmateSession = null;
    window.skillmateSupabase.auth.onAuthStateChange((event, session) => {
      window.skillmateSession = session;
      window.dispatchEvent(new CustomEvent("skillmate:auth-state-change", {
        detail: { event, session },
      }));
    });
    window.skillmateRestoreSession = async function restoreSkillmateSession() {
      const { data, error } = await window.skillmateSupabase.auth.getSession();
      if (error) throw error;
      window.skillmateSession = data.session;
      window.dispatchEvent(new CustomEvent("skillmate:auth-state-change", {
        detail: { event: "SESSION_RESTORED", session: data.session },
      }));
      return data.session;
    };
    window.skillmateSignOut = async function signOutSkillmate() {
      const { error } = await window.skillmateSupabase.auth.signOut();
      if (error) throw error;
      await window.clearSkillmateServerSession();
      window.skillmateSession = null;
      window.dispatchEvent(new CustomEvent("skillmate:auth-state-change", {
        detail: { event: "SIGNED_OUT", session: null },
      }));
    };
  } catch (error) {
    console.error("Could not initialize the Skillmate Supabase client.", error);
    window.skillmateSupabase = null;
    window.skillmateSupabaseError = "Could not initialize Supabase. Check that the Project URL and public key belong to the same project.";
  }
})();

window.syncSkillmateServerSession = async function syncSkillmateServerSession(session) {
  if (!session?.access_token) throw new Error("Sign in again to continue.");
  const syncAccessToken = (accessToken) => fetch("/api/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: "same-origin",
  });
  let response = await syncAccessToken(session.access_token);
  if (response.status === 401 && session.refresh_token && window.skillmateSupabase) {
    const { data, error } = await window.skillmateSupabase.auth.refreshSession({
      refresh_token: session.refresh_token,
    });
    if (error) {
      const message = error.message?.toLowerCase() || "";
      const invalidRefreshToken = error.code === "refresh_token_not_found"
        || message.includes("invalid refresh token")
        || message.includes("refresh token not found");
      if (invalidRefreshToken) {
        await window.clearExpiredSkillmateSession();
        throw new Error("Your sign-in session expired. Please sign in again.");
      }
      throw error;
    }
    if (!data.session?.access_token) throw new Error("Your sign-in session has expired. Please sign in again.");
    response = await syncAccessToken(data.session.access_token);
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Could not establish a secure Skillmate session.");
  }
};

let serverSessionClearPromise = null;

window.clearExpiredSkillmateSession = async function clearExpiredSkillmateSession() {
  if (window.skillmateSupabase) {
    try {
      const { error } = await window.skillmateSupabase.auth.signOut({ scope: "local" });
      if (error) console.error("Could not clear the expired local Skillmate session.", error);
    } catch (error) {
      console.error("Could not clear the expired local Skillmate session.", error);
    }
  }
  try {
    await window.clearSkillmateServerSession();
  } catch (error) {
    console.error("Could not clear the expired Skillmate server session.", error);
  }
};

window.clearSkillmateServerSession = function clearSkillmateServerSession() {
  if (!serverSessionClearPromise) {
    serverSessionClearPromise = fetch("/api/session", { method: "DELETE", credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("Could not clear the secure Skillmate session.");
      })
      .finally(() => {
        serverSessionClearPromise = null;
      });
  }
  return serverSessionClearPromise;
};
