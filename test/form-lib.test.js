const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

const { takenDays, sanitizeDescription, flattenComment, roundCoord, buildSnippet, descriptionToEditorHtml, editorHtmlToDescription } = require('../js/form-lib.js');

// Evaluate a snippet as JS the way pasting it into the locations array would.
function evalSnippet(snippet) {
  return vm.runInNewContext('(' + snippet.replace(/,\s*$/, '') + ')');
}

describe('sanitizeDescription', () => {
  it('keeps plain b tags', () => {
    assert.equal(sanitizeDescription('Klo <b>17</b> alkaen'), 'Klo <b>17</b> alkaen');
  });
  it('normalises case and escapes everything else', () => {
    assert.equal(sanitizeDescription('<B>a</B>'), '<b>a</b>');
    assert.equal(sanitizeDescription('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
    assert.equal(sanitizeDescription('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(sanitizeDescription('<b onclick="x">a</b>'), '&lt;b onclick="x"&gt;a');
  });
  it('balances b tags', () => {
    assert.equal(sanitizeDescription('a</b>b'), 'ab');
    assert.equal(sanitizeDescription('<b>a'), '<b>a</b>');
    assert.equal(sanitizeDescription('<b><b>a'), '<b><b>a</b></b>');
  });
  it('normalises line endings and trims', () => {
    assert.equal(sanitizeDescription('  a\r\nb\rc \n'), 'a\nb\nc');
  });
});

describe('flattenComment', () => {
  it('collapses whitespace and every JS line terminator', () => {
    assert.equal(flattenComment(' 12. tai\n15.\r\n(ei' + LS + '20.)' + PS + ' '), '12. tai 15. (ei 20.)');
  });
});

describe('roundCoord', () => {
  it('rounds to 6 decimals', () => {
    assert.equal(roundCoord(60.45084722008606), 60.450847);
    assert.equal(roundCoord(22.402141327176924), 22.402141);
    assert.equal(roundCoord(60.45), 60.45);
  });
});

describe('buildSnippet', () => {
  const base = { dayText: '', previewDescription: '', lat: 60.45, lng: 22.4 };

  it('formats an edit snippet exactly', () => {
    const snippet = buildSnippet({
      ...base,
      mode: 'edit',
      day: 12,
      image: '12.jpg',
      description: 'Hei "maailma"\nToinen',
      previewDescription: 'Klo <b>17</b>',
      lat: 60.45084722008606,
      lng: 22.402141327176924
    });
    assert.equal(snippet, [
      '{',
      '  day: 12,',
      '  image: "12.jpg",',
      String.raw`  description: "Hei \"maailma\"\nToinen",`,
      '  previewDescription: "Klo <b>17</b>",',
      '  lat: 60.450847,',
      '  lng: 22.402141',
      '},'
    ].join('\n'));
  });

  it('formats a new snippet with the requested day as a comment and a rename hint', () => {
    const snippet = buildSnippet({
      ...base,
      mode: 'new',
      day: null,
      dayText: '12. tai 15.\n(ei 20.)',
      image: '0.jpg',
      description: 'Hei'
    });
    assert.equal(snippet, [
      '{',
      '  day: 0, // requested: "12. tai 15. (ei 20.)"',
      '  image: "0.jpg", // rename to <day>.jpg',
      '  description: "Hei",',
      '  lat: 60.45,',
      '  lng: 22.4',
      '},'
    ].join('\n'));
  });

  it('omits image when none is given and previewDescription when empty', () => {
    const obj = evalSnippet(buildSnippet({ ...base, mode: 'edit', day: 3, image: null, description: 'a' }));
    assert.equal(Object.keys(obj).join(','), 'day,description,lat,lng');
  });

  it('includes endDay before the coordinates only when given', () => {
    const withEnd = evalSnippet(buildSnippet({ ...base, mode: 'edit', day: 3, image: null, description: 'a', endDay: 10 }));
    assert.equal(Object.keys(withEnd).join(','), 'day,description,endDay,lat,lng');
    assert.equal(withEnd.endDay, 10);
    const without = evalSnippet(buildSnippet({ ...base, mode: 'edit', day: 3, image: null, description: 'a', endDay: null }));
    assert.equal('endDay' in without, false);
  });

  it('keeps the existing image name in edit mode without a new photo', () => {
    const obj = evalSnippet(buildSnippet({ ...base, mode: 'edit', day: 3, image: '3.png', description: 'a' }));
    assert.equal(obj.image, '3.png');
  });

  it('stays valid JS for hostile description text', () => {
    const description = 'a "q" \\ back\nline </script> ' + LS + ' sep ' + PS + ' end';
    const obj = evalSnippet(buildSnippet({ ...base, mode: 'edit', day: 3, image: null, description }));
    assert.equal(obj.description, sanitizeDescription(description));
  });

  it('cannot be broken out of via the free-text day', () => {
    for (const dayText of ['12\n}, evil: 1, {', 'x' + LS + 'y: 1', 'x' + PS + 'y: 1', '"; evil: 1 //']) {
      const obj = evalSnippet(buildSnippet({ ...base, mode: 'new', day: null, dayText, image: null, description: 'a' }));
      assert.equal(Object.keys(obj).join(','), 'day,description,lat,lng', JSON.stringify(dayText));
    }
  });

  it('sanitises pasted HTML inside the snippet', () => {
    const obj = evalSnippet(buildSnippet({ ...base, mode: 'edit', day: 3, image: null, description: '<img src=x onerror=1><b>a' }));
    assert.equal(obj.description, '&lt;img src=x onerror=1&gt;<b>a</b>');
  });
});

describe('rich text box conversion', () => {
  it('round-trips bold and line breaks', () => {
    const text = 'Hei <b>maailma</b>\nToinen & <rivi>';
    const html = descriptionToEditorHtml(text);
    assert.equal(html, 'Hei <b>maailma</b><br>Toinen &amp; &lt;rivi&gt;');
    assert.equal(editorHtmlToDescription(html), sanitizeDescription(text));
  });

  it('turns browser div lines into newlines and keeps empty lines', () => {
    assert.equal(editorHtmlToDescription('a<div><br></div><div>b</div>'), 'a\n\nb');
    assert.equal(editorHtmlToDescription('a<div>b</div>'), 'a\nb');
  });

  it('maps strong to b and drops other markup and nbsp', () => {
    assert.equal(editorHtmlToDescription('<strong>x</strong>&nbsp;<span style="color:red">y</span>'), '<b>x</b> y');
  });
});

describe('takenDays', () => {
  it('returns sorted unique real days and skips placeholders', () => {
    assert.deepEqual(takenDays([{ day: 5 }, { day: 0 }, { day: 2 }, { day: 5 }, {}]), [2, 5]);
  });
});
