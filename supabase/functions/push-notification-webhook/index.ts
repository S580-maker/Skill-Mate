import { withSupabase } from "npm:@supabase/server@1";
import { createPushWebhookHandler } from "./handler.mjs";

const handler = createPushWebhookHandler({
  getEnv: (name) => Deno.env.get(name) || "",
});

Deno.serve(withSupabase({ auth: "secret" }, handler));
