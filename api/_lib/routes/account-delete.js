const {
  getSessionCookie,
} = require("../supabase");
const { handleAccountDelete } = require("../account-delete");

module.exports = async function accountDelete(request, response) {
  return handleAccountDelete(request, response, getSessionCookie(request));
};
