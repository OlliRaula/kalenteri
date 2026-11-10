const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'form.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/form.js'), 'utf8');

// canSubmit() uses form.checkValidity(), which counts hidden fields too. In edit mode the day and
// contact fields are hidden, so any of them left `required` keeps the send button disabled forever
// (regression: edit mode could never be submitted). Required inputs that stay visible and are filled
// in by the user in edit mode can be listed here; there are none today.
const REQUIRED_IN_EDIT_MODE = [];

function requiredInputIds() {
  return [...html.matchAll(/<input\b[^>]*>/g)]
    .map(m => m[0])
    .filter(tag => /\srequired(\s|>|=|\/)/.test(tag))
    .map(tag => /\sid="([^"]+)"/.exec(tag)?.[1])
    .filter(Boolean);
}

function setupModeBody() {
  const start = js.indexOf('function setupMode()');
  assert.notEqual(start, -1, 'setupMode() not found in js/form.js');
  const end = js.indexOf('\n  }\n', start);
  return js.slice(start, end);
}

function idsClearedInSetupMode() {
  const body = setupModeBody();
  const ids = new Set();
  for (const m of body.matchAll(/\$\('(\w+)'\)\.required\s*=\s*false/g)) ids.add(m[1]);
  for (const m of body.matchAll(/\[([^\]]*)\]\.forEach\([^;]*\.required\s*=\s*false/g)) {
    for (const id of m[1].matchAll(/'(\w+)'/g)) ids.add(id[1]);
  }
  return ids;
}

describe('form edit mode keeps the send button usable', () => {
  it('finds the required inputs (sanity check for the parsing)', () => {
    const ids = requiredInputIds();
    assert.ok(ids.includes('name') && ids.includes('email') && ids.includes('phone'), `got: ${ids}`);
  });

  it('setupMode() clears `required` on every required input that is hidden in edit mode', () => {
    const cleared = idsClearedInSetupMode();
    const missing = requiredInputIds().filter(id => !cleared.has(id) && !REQUIRED_IN_EDIT_MODE.includes(id));
    assert.deepEqual(missing, [],
      `Required inputs still required in edit mode, so form.checkValidity() always fails: ${missing.join(', ')}. ` +
      'Clear them in setupMode() (or add to REQUIRED_IN_EDIT_MODE if they are visible and validated).');
  });
});
