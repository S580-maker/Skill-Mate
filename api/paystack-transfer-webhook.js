const { endpointRateLimits, runRateLimited } = require("./_lib/rate-limit");
const { handlePaystackTransferWebhook } = require("./_lib/paystack-payouts");

module.exports = async function paystackTransferWebhook(request, response) {
  return runRateLimited(request, response, endpointRateLimits["paystack-transfer-webhook"], async () => {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return response.status(405).json({ error: "Method not allowed." });
    }
    if (!Buffer.isBuffer(request.rawBody)) {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > 1024 * 1024) {
          return response.status(413).json({ error: "Transfer webhook payload is too large." });
        }
        chunks.push(buffer);
      }
      request.rawBody = Buffer.concat(chunks);
    }
    return handlePaystackTransferWebhook(request, response);
  });
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
