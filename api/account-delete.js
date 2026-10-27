const {
  getSessionCookie,
} = require("./_lib/supabase");
const { handleAccountDelete } = require("./_lib/account-delete");

module.exports = async function accountDelete(request, response) {
  return handleAccountDelete(request, response, getSessionCookie(request));
};
