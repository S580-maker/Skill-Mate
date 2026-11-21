const { endpointRateLimits, runRateLimited } = require("./_lib/rate-limit");
const { handlePaystackWebhook } = require("./_lib/paystack-payments");

module.exports = async function paystackWebhook(request, response) {
  return runRateLimited(request, response, endpointRateLimits["paystack-webhook"], async () => {
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
          return response.status(413).json({ error: "Payment webhook payload is too large." });
        }
        chunks.push(buffer);
      }
      request.rawBody = Buffer.concat(chunks);
    }
    return handlePaystackWebhook(request, response);
  });
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
