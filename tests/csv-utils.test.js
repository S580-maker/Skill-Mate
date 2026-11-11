const { test } = require('node:test');
const assert = require('node:assert/strict');
const csv = require('../csv-utils');
test('CSV neutralizes formula prefixes including leading whitespace and controls', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '  =HYPERLINK("https://example.test")', '\ttext', '\rtext', '\ntext', '\uFEFF=1']) {
    assert.ok(csv.cell(value).startsWith('"\''), JSON.stringify(value));
  }
});
test('CSV preserves Unicode, embedded quotes, separators, multiline text and numeric values', () => {
  assert.equal(csv.encode([['Name','Description'], ['Ama, Mensah', 'A "good"\nservice'], ['GH₵',19.99], [null,'safe text']]), '"Name","Description"\r\n"Ama, Mensah","A ""good""\nservice"\r\n"GH₵","19.99"\r\n"","safe text"');
});
