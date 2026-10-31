// Pure helpers for the day submission form (also loaded by node --test).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FormLib = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Keep only balanced <b>...</b>; escape every other < and >.
  function sanitizeDescription(text) {
    let open = 0;
    const normalized = String(text).replace(/\r\n?/g, '\n').trim();
    const out = normalized.replace(/<\/?b>|[<>]/gi, token => {
      const lower = token.toLowerCase();
      if (lower === '<b>') {
        open++;
        return '<b>';
      }
      if (lower === '</b>') {
        if (open === 0) return '';
        open--;
        return '</b>';
      }
      return token === '<' ? '&lt;' : '&gt;';
    });
    return out + '</b>'.repeat(open);
  }

  function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Description text (with <b> tags and \n) -> HTML for the rich text box.
  function descriptionToEditorHtml(text) {
    return String(text || '')
      .split(/(<\/?b>)/i)
      .map(part => (/^<\/?b>$/i.test(part) ? part.toLowerCase() : escapeHtml(part)))
      .join('')
      .replace(/\r\n?|\n/g, '<br>');
  }

  // HTML from the rich text box -> description text. Only bold and line breaks survive.
  function editorHtmlToDescription(html) {
    const text = String(html || '')
      .replace(/<(div|p)\b[^>]*>\s*<br\s*\/?>/gi, '\n')
      .replace(/<(div|p)\b[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<(\/?)(b|strong)\b[^>]*>/gi, '<$1b>')
      .replace(/<(?!\/?b>)[^>]*>/gi, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    return sanitizeDescription(text);
  }

  // One line, safe to place after //. JS \s also matches U+2028/U+2029, which end a // comment.
  function flattenComment(text) {
    return String(text).replace(/\s+/g, ' ').trim();
  }

  function roundCoord(n) {
    return Number(Number(n).toFixed(6));
  }

  // Builds the object literal the author pastes into js/locations.js.
  function buildSnippet(data) {
    const entries = [];
    if (data.mode === 'new') {
      entries.push({ text: 'day: 0', comment: `requested: "${flattenComment(data.dayText)}"` });
    } else {
      entries.push({ text: `day: ${data.day}` });
    }
    if (data.image) {
      entries.push({
        text: `image: ${JSON.stringify(data.image)}`,
        comment: data.mode === 'new' ? 'rename to <day>.jpg' : undefined
      });
    }
    entries.push({ text: `description: ${JSON.stringify(sanitizeDescription(data.description))}` });
    const preview = sanitizeDescription(data.previewDescription || '');
    if (preview) {
      entries.push({ text: `previewDescription: ${JSON.stringify(preview)}` });
    }
    if (Number.isInteger(data.endDay)) {
      entries.push({ text: `endDay: ${data.endDay}` });
    }
    entries.push({ text: `lat: ${roundCoord(data.lat)}` });
    entries.push({ text: `lng: ${roundCoord(data.lng)}` });

    const lines = entries.map((entry, i) => {
      const comma = i < entries.length - 1 ? ',' : '';
      return `  ${entry.text}${comma}${entry.comment ? ` // ${entry.comment}` : ''}`;
    });
    return `{\n${lines.join('\n')}\n},`;
  }

  // Sorted, de-duplicated list of real day numbers (placeholder day 0 and invalid values are skipped).
  function takenDays(locations) {
    const days = locations.map(loc => loc.day).filter(day => Number.isInteger(day) && day > 0);
    return [...new Set(days)].sort((a, b) => a - b);
  }

  return { takenDays, descriptionToEditorHtml, editorHtmlToDescription, sanitizeDescription, flattenComment, roundCoord, buildSnippet };
});
