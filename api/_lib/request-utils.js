function isSameOrigin(request) {
  const origin = request.headers?.origin;
  const host = request.headers?.host;
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

module.exports = { isSameOrigin, readJson };
