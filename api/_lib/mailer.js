const nodemailer = require("nodemailer");

function getMailer(transportOptions = {}) {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  const missingSettings = [
    !host && "SMTP_HOST",
    !user && "SMTP_USER",
    !pass && "SMTP_PASS",
    !from && "SMTP_FROM",
  ].filter(Boolean);
  if (missingSettings.length) {
    throw new Error(`Missing required email server settings: ${missingSettings.join(", ")}.`);
  }
  const port = Number(process.env.SMTP_PORT || 587);
  return {
    from: from.includes("<") ? from : `Skillmate <${from}>`,
    transport: nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user, pass },
      ...transportOptions,
    }),
  };
}

module.exports = { getMailer };
