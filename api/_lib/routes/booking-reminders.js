const { timingSafeEqual } = require("node:crypto");
const { getSupabaseConfig } = require("../supabase");

module.exports = async function bookingReminders(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  const expected = process.env.CRON_SECRET?.trim();
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || Buffer.byteLength(expected) !== Buffer.byteLength(provided)
    || !timingSafeEqual(Buffer.from(expected), Buffer.from(provided))) {
    return response.status(401).json({ error: "Unauthorized." });
  }
  try {
    const { url } = getSupabaseConfig();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceKey) throw new Error("Reminder service is not configured.");
    const result = await fetch(`${url}/rest/v1/rpc/generate_booking_reminders`, {
      method: "POST", headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
      body: "{}", signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error("Reminder generation failed.");
    return response.status(200).json({ created: await result.json() });
  } catch {
    return response.status(503).json({ error: "Booking reminders are temporarily unavailable." });
  }
};
