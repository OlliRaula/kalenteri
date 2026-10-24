const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

globalThis.window = globalThis.window || {};
require('../js/locations.js');
const { renderCard, getImagePath, DEFAULT_IMAGE } = require('../js/card.js');

const normalize = html => html.replace(/>\s+</g, '><').trim();

// Reference copies of the two templates as they existed in js/app.js before the refactor.
function legacyImagePath(f) {
  if (!f) return 'img/default.png';
  if (f.startsWith('img/') || f.startsWith('/')) return f;
  return `img/${f}`;
}
function legacyParts(location, showPreview) {
  const desc = showPreview && location.previewDescription ? location.previewDescription : (location.description || 'Tule ja ylläty!');
  return {
    html: desc.replace(/\n/g, '<br>'),
    img: showPreview ? 'img/default.png' : legacyImagePath(location.image)
  };
}
function legacyList(location, showPreview) {
  const { html, img } = legacyParts(location, showPreview);
  return `<div class="location-card" data-day="${location.day}"><img src="${img}" alt="Luukku ${location.day}" class="card-image"><div class="day-badge">${location.day}</div><div class="date">${location.day}. joulukuuta 2026</div><div class="description">${html}</div></div>`;
}
function legacyHighlighted(location, showPreview) {
  const { html, img } = legacyParts(location, showPreview);
  return `<div class="location-card highlighted-card" data-day="${location.day}"><img src="${img}" alt="Luukku ${location.day}" class="card-image"><div class="card-content"><div class="day-badge">${location.day}</div><div class="date">${location.day}. joulukuuta 2026</div><div class="description">${html}</div></div></div>`;
}

describe('renderCard matches the legacy markup for every location', () => {
  for (const location of window.LOCATIONS) {
    for (const showPreview of [false, true]) {
      it(`day ${location.day}, preview=${showPreview}`, () => {
        assert.equal(normalize(renderCard(location, { variant: 'list', showPreview })), normalize(legacyList(location, showPreview)));
        assert.equal(normalize(renderCard(location, { variant: 'highlighted', showPreview })), normalize(legacyHighlighted(location, showPreview)));
      });
    }
  }
});

describe('renderCard extras', () => {
  it('defaults to the list variant', () => {
    const loc = { day: 3, description: 'Hei', image: '3.png' };
    assert.equal(renderCard(loc), renderCard(loc, { variant: 'list' }));
  });

  it('uses the default image and fallback text when missing', () => {
    const html = normalize(renderCard({ day: 5 }));
    assert.ok(html.includes('src="img/default.png"'));
    assert.ok(html.includes('Tule ja ylläty!'));
  });

  it('imageUrl overrides the photo but not the preview default image', () => {
    const loc = { day: 5, description: 'a', previewDescription: 'b', image: '5.png' };
    assert.ok(renderCard(loc, { imageUrl: 'data:image/jpeg;base64,AAAA' }).includes('src="data:image/jpeg;base64,AAAA"'));
    assert.ok(renderCard(loc, { imageUrl: 'data:image/jpeg;base64,AAAA', showPreview: true }).includes('src="img/default.png"'));
  });

  it('renders a non-numeric day with a year-only date line', () => {
    assert.equal(
      normalize(renderCard({ day: '?', description: 'Hei' })),
      '<div class="location-card" data-day="?"><img src="img/default.png" alt="Luukku ?" class="card-image"><div class="day-badge">?</div><div class="date">joulukuuta 2026</div><div class="description">Hei</div></div>'
    );
  });

  it('adds an end note after the description only for multi-day cards outside preview', () => {
    const loc = { day: 3, description: 'a', previewDescription: 'b', endDay: 10 };
    assert.ok(renderCard(loc).includes('<div class="end-note">Esillä 10. joulukuuta asti</div>'));
    assert.ok(!renderCard(loc, { showPreview: true }).includes('end-note'));
    assert.ok(!renderCard({ ...loc, endDay: 3 }).includes('end-note'));
    assert.ok(!renderCard({ day: 3, description: 'a' }).includes('end-note'));
  });

  it('getImagePath passes through img/ and absolute paths', () => {
    assert.equal(getImagePath('img/x.jpg'), 'img/x.jpg');
    assert.equal(getImagePath('/x.jpg'), '/x.jpg');
    assert.equal(getImagePath('x.jpg'), 'img/x.jpg');
    assert.equal(getImagePath(undefined), DEFAULT_IMAGE);
  });
});

describe('expired note', () => {
  const loc = { day: 3, description: 'a' };
  it('shows only on the highlighted card', () => {
    assert.ok(renderCard(loc, { variant: 'highlighted', expired: true }).includes('ei ole enää vierailtavissa'));
    assert.ok(!renderCard(loc, { variant: 'list', expired: true }).includes('vierailtavissa'));
    assert.ok(!renderCard(loc, { variant: 'highlighted' }).includes('vierailtavissa'));
  });
});
