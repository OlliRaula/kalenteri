// Shared card markup for the calendar list and the submission form preview.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.CalendarCard = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Default image to use when no image is specified
  const DEFAULT_IMAGE = 'img/default.png';
  const YEAR = 2026;

  // Helper function to get full image path
  function getImagePath(imageFilename) {
    if (!imageFilename) return DEFAULT_IMAGE;
    // If already has img/ prefix or is a full path, return as is
    if (imageFilename.startsWith('img/') || imageFilename.startsWith('/')) {
      return imageFilename;
    }
    // Otherwise, prepend img/
    return `img/${imageFilename}`;
  }

  // options.variant: 'list' (default) or 'highlighted' (the card moved to the top)
  // options.showPreview: show previewDescription and the default image
  // options.expired: the day is over, so the highlighted card says it can't be visited anymore
  // options.imageUrl: explicit photo URL (e.g. a data URL) used when not previewing
  function renderCard(location, options) {
    const opts = options || {};
    const showPreview = Boolean(opts.showPreview);
    const description = showPreview && location.previewDescription
      ? location.previewDescription
      : (location.description || 'Tule ja ylläty!');
    // Convert \n to <br> for HTML display
    const descriptionHtml = description.replace(/\n/g, '<br>');
    const imageUrl = showPreview ? DEFAULT_IMAGE : (opts.imageUrl || getImagePath(location.image));
    const day = location.day;
    const dateText = typeof day === 'number' ? `${day}. joulukuuta ${YEAR}` : `joulukuuta ${YEAR}`;

    const image = `<img src="${imageUrl}" alt="Luukku ${day}" class="card-image">`;
    const badge = `<div class="day-badge">${day}</div>`;
    const date = `<div class="date">${dateText}</div>`;
    // Days people leave up after their date get a note after the description
    const showEnd = !showPreview && Number.isInteger(location.endDay) && location.endDay > day;
    const showExpired = !showPreview && Boolean(opts.expired) && opts.variant === 'highlighted';
    const desc = `<div class="description">${descriptionHtml}</div>` +
      (showExpired ? '<div class="end-note">Tämä luukku ei ole enää vierailtavissa</div>' : showEnd ? `<div class="end-note">Esillä ${location.endDay}. joulukuuta asti</div>` : '');

    if (opts.variant === 'highlighted') {
      return `<div class="location-card highlighted-card" data-day="${day}">
        ${image}
        <div class="card-content">
          ${badge}
          ${date}
          ${desc}
        </div>
      </div>`;
    }
    return `<div class="location-card" data-day="${day}">
      ${image}
      ${badge}
      ${date}
      ${desc}
    </div>`;
  }

  return { DEFAULT_IMAGE, getImagePath, renderCard };
});
