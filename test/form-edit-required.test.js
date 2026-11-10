const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const js = fs.readFileSync(path.join(__dirname, '../js/form.js'), 'utf8');

function functionBody(name) {
  const start = js.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name}() not found in js/form.js`);
  return js.slice(start, js.indexOf('\n  }\n', start));
}

// Regression: canSubmit() used form.checkValidity(), which counts hidden fields. In edit mode the
// hidden, empty `required` contact inputs kept the send button disabled forever, with no hint.
describe('send button logic', () => {
  it('canSubmit() is derived from validate(), the same source as the visible hints', () => {
    assert.match(functionBody('canSubmit'), /validate\(\)/);
  });

  it('canSubmit() and refresh() do not use form-wide checkValidity()', () => {
    assert.doesNotMatch(functionBody('canSubmit'), /dayForm'\)\.checkValidity/);
    assert.doesNotMatch(functionBody('refresh'), /dayForm'\)\.checkValidity/);
  });
});
