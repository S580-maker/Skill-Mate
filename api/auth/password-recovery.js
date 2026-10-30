const {
  requestPasswordRecovery,
  updateRecoveredPassword,
} = require("../_lib/email-2fa");

module.exports = async function passwordRecovery(request, response) {
  if (request.method === "POST") return requestPasswordRecovery(request, response);
  if (request.method === "PUT") return updateRecoveredPassword(request, response);
  response.setHeader("Allow", "POST, PUT");
  return response.status(405).json({ error: "Method not allowed." });
};
