const crypto = require("node:crypto");

function responseError(response, status, message) {
  return response.status(status).json({ error: message });
}

function validPaystackSignature(rawBody, signature, secretKey) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !/^[a-f0-9]{128}$/i.test(signature)) {
    return false;
  }
  const expected = crypto.createHmac("sha512", secretKey).update(rawBody).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { responseError, validPaystackSignature };
