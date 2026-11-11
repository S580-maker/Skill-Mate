/* User-authored fields must remain text when opened by spreadsheet software. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.skillmateCsv = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  function cell(value) {
    const text = String(value ?? "");
    const safe = /^[\s\u0000-\u001f]*[=+\-@]|^[\t\r\n]/u.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  }
  function encode(rows) { return rows.map(row => row.map(cell).join(",")).join("\r\n"); }
  return { cell, encode };
});
