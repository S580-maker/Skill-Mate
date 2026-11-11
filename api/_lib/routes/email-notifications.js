const { timingSafeEqual } = require("node:crypto");
const { getMailer } = require("../mailer");
const { getSupabaseConfig } = require("../supabase");

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAuthorized(request) {
  const expected = process.env.CRON_SECRET?.trim();
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  return Boolean(expected)
    && Buffer.byteLength(expected) === Buffer.byteLength(provided)
    && timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

async function supabaseRequest(url, serviceKey, options = {}) {
  const result = await fetch(url, {
    ...options,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!result.ok) throw new Error(`Supabase email processing returned HTTP ${result.status}.`);
  if (result.status === 204) return null;
  return result.json();
}

function buildMessage(events) {
  const messages = events.filter((event) => event.event_type === "message").length;
  const bookings = events.filter((event) => event.event_type.startsWith("booking_")).length;
  const lines = [];
  if (messages) lines.push(`You have ${messages} unread message${messages === 1 ? "" : "s"} waiting in Skill Flex.`);
  if (bookings) lines.push(`You have ${bookings} booking update${bookings === 1 ? "" : "s"} in Skill Flex.`);
  const text = `${lines.join("\n\n")}\n\nSign in to Skill Flex to view them.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#172033;max-width:480px;margin:0 auto;padding:32px"><div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#596b8a">SKILL FLEX</div><h1 style="font-size:24px;margin:28px 0 16px">You have an update</h1>${lines.map((line) => `<p style="color:#596273;line-height:1.6">${line}</p>`).join("")}<p style="color:#596273;line-height:1.6">Sign in to Skill Flex to view it.</p></div>`;
  return {
    subject: messages && bookings
      ? "New messages and booking updates on Skill Flex"
      : messages
        ? "You have unread messages on Skill Flex"
        : "You have a booking update on Skill Flex",
    text,
    html,
  };
}

async function runNotifications(config, serviceKey) {
  const baseUrl = config.url;
  const headers = { Prefer: "return=representation" };
  const claimed = await supabaseRequest(`${baseUrl}/rest/v1/rpc/claim_marketplace_email_notifications`, serviceKey, {
    method: "POST",
    body: "{}",
  });
  if (!Array.isArray(claimed)) throw new Error("The email notification queue returned an invalid response.");
  if (!claimed.length) return { processed: 0, sent: 0, retrying: 0 };
  const claimToken = claimed[0].claim_token;
  if (!uuidPattern.test(claimToken) || claimed.some((item) =>
    !uuidPattern.test(item.id) || !uuidPattern.test(item.recipient_id) || item.claim_token !== claimToken
    || !["message", "booking_request", "booking_update"].includes(item.event_type))) {
    throw new Error("The email notification queue returned an invalid claim.");
  }

  const recipients = [...new Set(claimed.map((item) => item.recipient_id))];
  const recipientQuery = new URLSearchParams({
    select: "id,notify_messages,notify_booking_updates",
    id: `in.(${recipients.join(",")})`,
  });
  const profiles = await supabaseRequest(`${baseUrl}/rest/v1/profiles?${recipientQuery}`, serviceKey);
  if (!Array.isArray(profiles)) throw new Error("Could not load email notification preferences.");
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const messageIds = [...new Set(claimed.filter((item) => item.event_type === "message").map((item) => item.message_id))];
  let unreadMessageIds = new Set();
  if (messageIds.length) {
    if (messageIds.some((id) => !uuidPattern.test(id))) throw new Error("The email queue contains an invalid message reference.");
    const messageQuery = new URLSearchParams({ select: "id,read_at", id: `in.(${messageIds.join(",")})` });
    const messages = await supabaseRequest(`${baseUrl}/rest/v1/messages?${messageQuery}`, serviceKey);
    if (!Array.isArray(messages)) throw new Error("Could not verify unread messages.");
    unreadMessageIds = new Set(messages.filter((message) => message.read_at === null).map((message) => message.id));
  }

  const completedIds = [];
  const eligibleByRecipient = new Map();
  for (const event of claimed) {
    const profile = profileById.get(event.recipient_id);
    const preferenceEnabled = event.event_type === "message"
      ? profile?.notify_messages
      : profile?.notify_booking_updates;
    const isUnread = event.event_type !== "message" || unreadMessageIds.has(event.message_id);
    if (!preferenceEnabled || !isUnread) {
      completedIds.push(event.id);
      continue;
    }
    const events = eligibleByRecipient.get(event.recipient_id) || [];
    events.push(event);
    eligibleByRecipient.set(event.recipient_id, events);
  }

  const deliveryFailures = [];
  let sent = 0;
  if (eligibleByRecipient.size) {
    let mailer;
    try {
      mailer = getMailer({
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 8000,
      });
    } catch (error) {
      deliveryFailures.push(...[...eligibleByRecipient.values()].flat().map((event) => event.id));
      console.error("Marketplace email delivery is not configured.", {
        name: error?.name || "Error",
      });
    }
    const recipientsToSend = mailer ? [...eligibleByRecipient.entries()] : [];
    for (let offset = 0; offset < recipientsToSend.length; offset += 8) {
      await Promise.all(recipientsToSend.slice(offset, offset + 8).map(async ([recipientId, events]) => {
        try {
          const latestProfileQuery = new URLSearchParams({
            select: "id,notify_messages,notify_booking_updates",
            id: `eq.${recipientId}`,
          });
          const latestProfiles = await supabaseRequest(
            `${baseUrl}/rest/v1/profiles?${latestProfileQuery}`,
            serviceKey,
          );
          if (!Array.isArray(latestProfiles)) throw new Error("Could not verify current email preferences.");
          const latestProfile = latestProfiles[0];
          const currentEvents = events.filter((event) =>
            event.event_type === "message"
              ? latestProfile?.notify_messages
              : latestProfile?.notify_booking_updates);
          completedIds.push(...events.filter((event) => !currentEvents.includes(event)).map((event) => event.id));
          if (!currentEvents.length) return;

          const currentMessageIds = currentEvents
            .filter((event) => event.event_type === "message")
            .map((event) => event.message_id);
          let stillUnreadMessageIds = new Set();
          if (currentMessageIds.length) {
            const currentMessageQuery = new URLSearchParams({
              select: "id,read_at",
              id: `in.(${currentMessageIds.join(",")})`,
            });
            const currentMessages = await supabaseRequest(
              `${baseUrl}/rest/v1/messages?${currentMessageQuery}`,
              serviceKey,
            );
            if (!Array.isArray(currentMessages)) throw new Error("Could not verify current message status.");
            stillUnreadMessageIds = new Set(
              currentMessages.filter((message) => message.read_at === null).map((message) => message.id),
            );
          }
          const deliverableEvents = currentEvents.filter((event) =>
            event.event_type !== "message" || stillUnreadMessageIds.has(event.message_id));
          completedIds.push(...currentEvents.filter((event) => !deliverableEvents.includes(event)).map((event) => event.id));
          if (!deliverableEvents.length) return;

          const user = await supabaseRequest(
            `${baseUrl}/auth/v1/admin/users/${encodeURIComponent(recipientId)}`,
            serviceKey,
          );
          if (typeof user?.email !== "string" || !user.email.includes("@")) {
            completedIds.push(...deliverableEvents.map((event) => event.id));
            return;
          }
          await mailer.transport.sendMail({ from: mailer.from, to: user.email, ...buildMessage(deliverableEvents) });
          completedIds.push(...deliverableEvents.map((event) => event.id));
          sent += 1;
        } catch (error) {
          deliveryFailures.push(...events
            .filter((event) => !completedIds.includes(event.id))
            .map((event) => event.id));
          console.error("Marketplace email delivery failed.", {
            name: error?.name || "Error",
            code: error?.code || "UNKNOWN",
          });
        }
      }));
    }
  }

  async function finish(ids, succeeded) {
    if (!ids.length) return;
    await supabaseRequest(`${baseUrl}/rest/v1/rpc/finish_marketplace_email_notifications`, serviceKey, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_claim_token: claimToken,
        p_outbox_ids: ids,
        p_succeeded: succeeded,
      }),
    });
  }
  await finish(completedIds, true);
  await finish(deliveryFailures, false);
  return { processed: completedIds.length + deliveryFailures.length, sent, retrying: deliveryFailures.length };
}

module.exports = async function emailNotifications(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed." });
  }
  if (!isAuthorized(request)) return response.status(401).json({ error: "Unauthorized." });

  try {
    const config = getSupabaseConfig();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceKey) throw new Error("Marketplace email service is not configured.");
    return response.status(200).json(await runNotifications(config, serviceKey));
  } catch (error) {
    console.error("Marketplace email notification job failed.", {
      name: error?.name || "Error",
      code: error?.code || "UNKNOWN",
    });
    return response.status(503).json({ error: "Email notifications are temporarily unavailable." });
  }
};
