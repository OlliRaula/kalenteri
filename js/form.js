// Day submission form: modes, map picker, live preview.
(function () {
  'use strict';

  const { renderCard } = window.CalendarCard;
  const { takenDays, descriptionToEditorHtml, editorHtmlToDescription, buildSnippet } = window.FormLib;

  const ENDPOINT = 'https://api.web3forms.com/submit';
  const ACCESS_KEY = '212871f3-7df2-4fd7-b65d-3358700e818c';
  const MAX_IMAGE_SIDE = 800;
  const MAX_IMAGE_CHARS = 200000;
  const MAX_DESCRIPTION = 3000;
  const MAX_PREVIEW = 600;

  const DEFAULT_CENTER = [60.4502, 22.4112];

  const params = new URLSearchParams(window.location.search);
  const isEdit = params.get('edit') === '1';
  const editKey = params.get('key');
  const existing = isEdit
    ? window.LOCATIONS.find(loc => loc.day === parseInt(params.get('day'), 10))
    : null;

  const state = { lat: null, lng: null, imageDataUrl: null };
  let busy = false;
  let photoToken = 0;
  let photoPending = false;

  const $ = id => document.getElementById(id);

  function showBlocked() {
    $('dayForm').hidden = true;
    $('blocked').hidden = false;
  }

  // Only shows what is already in the calendar; submissions not yet processed are not known here.
  function showTakenDays() {
    const days = takenDays(window.LOCATIONS);
    if (!days.length) return;
    $('takenDays').textContent = `Kalenterista on varattu jo luukut päiville: ${days.join(', ')}. ` +
      'Huomaa, että lähetettyjä ehdotuksia ei ole välttämättä vielä käsitelty, joten myös muut päivät voivat olla jo varattuja.';
    $('takenDays').hidden = false;
  }

  function setupMode() {
    if (!isEdit) {
      showTakenDays();
      return;
    }
    $('formTitle').textContent = `🎄 Muokkaa luukkua ${existing.day} 🎄`;
    $('formIntro').textContent = 'Muokkaa tietoja, tarkista esikatselu ja lähetä lomake.';
    $('dayGroup').hidden = true;
    $('day').required = false;
    $('description').innerHTML = descriptionToEditorHtml(existing.description);
    $('previewDescription').innerHTML = descriptionToEditorHtml(existing.previewDescription);
    $('endDay').min = String(existing.day);
    $('endDay').value = Number.isInteger(existing.endDay) ? String(existing.endDay) : '';
  }

  // Blank or an invalid number means "only on the day itself"
  function readEndDay() {
    const value = parseInt($('endDay').value, 10);
    return Number.isInteger(value) && $('endDay').checkValidity() ? value : null;
  }

  function setLocationStatus() {
    $('locationStatus').textContent = state.lat === null
      ? 'Sijaintia ei ole vielä valittu.'
      : 'Sijainti valittu.';
  }

  function initMap() {
    const hasStart = existing && Number.isFinite(existing.lat) && Number.isFinite(existing.lng);
    const map = L.map('map').setView(hasStart ? [existing.lat, existing.lng] : DEFAULT_CENTER, hasStart ? 18 : 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    let marker = null;
    function place(latlng) {
      state.lat = latlng.lat;
      state.lng = latlng.lng;
      if (marker) {
        marker.setLatLng(latlng);
      } else {
        marker = L.marker(latlng, { draggable: true }).addTo(map);
        marker.on('dragend', () => place(marker.getLatLng()));
      }
      refresh();
    }
    map.on('click', e => place(e.latlng));
    if (hasStart) place(L.latLng(existing.lat, existing.lng));
  }

  function readText(id) {
    return editorHtmlToDescription($(id).innerHTML);
  }

  function textIsValid() {
    const description = readText('description');
    return description !== '' && description.length <= MAX_DESCRIPTION &&
      readText('previewDescription').length <= MAX_PREVIEW;
  }

  function currentLocation() {
    return {
      day: isEdit ? existing.day : '?',
      description: readText('description'),
      previewDescription: readText('previewDescription'),
      endDay: readEndDay() || undefined,
      image: existing ? existing.image : undefined
    };
  }

  function renderPreview() {
    const showPreview = document.querySelector('input[name="previewMode"]:checked').value === 'before';
    const location = currentLocation();
    if (showPreview && !location.previewDescription) {
      $('locationsList').innerHTML = '<p class="preview-note">Ennakkotekstiä ei ole, joten luukku ei näy kalenterissa ennen päivää.</p>';
      return;
    }
    $('locationsList').innerHTML = renderCard(location, {
      variant: 'list',
      showPreview,
      imageUrl: state.imageDataUrl || undefined
    });
  }

  function canSubmit() {
    return !busy && !photoPending && state.lat !== null && textIsValid() && $('dayForm').checkValidity();
  }

  // Human-readable list of what still blocks sending, shown next to the disabled button
  function missingReasons() {
    const reasons = [];
    if (photoPending) reasons.push('Kuvaa käsitellään, odota hetki.');
    if (!isEdit && !$('day').value.trim()) reasons.push('Kerro, mikä päivä (Luukun tiedot).');
    const description = readText('description');
    if (description === '') reasons.push('Kirjoita kuvaus.');
    else if (description.length > MAX_DESCRIPTION) reasons.push(`Kuvaus on liian pitkä (enintään ${MAX_DESCRIPTION} merkkiä).`);
    if (readText('previewDescription').length > MAX_PREVIEW) reasons.push(`Ennakkoteksti on liian pitkä (enintään ${MAX_PREVIEW} merkkiä).`);
    if (!$('endDay').checkValidity()) reasons.push('Viimeinen esilläolopäivä ei kelpaa.');
    if (state.lat === null) reasons.push('Valitse sijainti kartalta.');
    if (!$('name').value.trim()) reasons.push('Täytä nimi.');
    if (!$('email').value.trim()) reasons.push('Täytä sähköposti.');
    else if (!$('email').checkValidity()) reasons.push('Sähköpostiosoite ei kelpaa.');
    if (!$('phone').value.trim()) reasons.push('Täytä puhelinnumero.');
    return reasons;
  }

  function refresh() {
    setLocationStatus();
    renderPreview();
    const enabled = canSubmit();
    $('submitBtn').disabled = !enabled;
    const reasons = enabled || busy ? [] : missingReasons();
    $('submitHint').textContent = reasons.length ? `Lähetys ei ole vielä mahdollista: ${reasons.join(' ')}` : '';
  }

  // Resize in the browser so the base64 stays small enough for an email text field.
  // Modern browsers apply EXIF orientation when drawing an <img> to a canvas.
  async function resizeImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Kuvaa ei voitu lukea. Kokeile toista kuvaa.'));
        img.src = url;
      });
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.7;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);
      while (dataUrl.length > MAX_IMAGE_CHARS && quality > 0.4) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }
      return dataUrl;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function onPhotoChange() {
    const file = $('photo').files[0];
    const token = ++photoToken;
    $('photoError').textContent = '';
    if (!file) {
      photoPending = false;
      state.imageDataUrl = null;
      refresh();
      return;
    }
    // Block Send until this resize is done; a newer pick supersedes an older one.
    photoPending = true;
    refresh();
    try {
      const dataUrl = await resizeImage(file);
      if (token !== photoToken) return;
      state.imageDataUrl = dataUrl;
    } catch (err) {
      if (token !== photoToken) return;
      state.imageDataUrl = null;
      $('photo').value = '';
      $('photoError').textContent = err.message;
    }
    photoPending = false;
    refresh();
  }

  function snippetImage() {
    if (state.imageDataUrl) return isEdit ? `${existing.day}.jpg` : '0.jpg';
    return isEdit && existing.image ? existing.image : null;
  }

  function setBusy(value) {
    busy = value;
    $('submitBtn').textContent = value ? 'Lähetetään...' : 'Lähetä';
    refresh();
  }

  function showFallback(snippet) {
    const contact = [
      `Nimi: ${$('name').value.trim()}`,
      `Sähköposti: ${$('email').value.trim()}`,
      `Puhelin: ${$('phone').value.trim()}`
    ].join('\n');
    $('fallbackText').value = `${contact}\n\n${snippet}`;
    $('fallback').hidden = false;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!canSubmit()) return;
    setBusy(true);
    $('status').className = 'status';
    $('status').textContent = '';

    const snippet = buildSnippet({
      mode: isEdit ? 'edit' : 'new',
      day: isEdit ? existing.day : null,
      dayText: $('day').value,
      image: snippetImage(),
      description: readText('description'),
      previewDescription: readText('previewDescription'),
      endDay: readEndDay(),
      lat: state.lat,
      lng: state.lng
    });

    const formData = new FormData($('dayForm'));
    formData.delete('previewMode');
    formData.set('description', readText('description'));
    formData.set('previewDescription', readText('previewDescription'));
    formData.set('access_key', ACCESS_KEY);
    formData.set('mode', isEdit ? 'edit' : 'new');
    formData.set('subject', isEdit
      ? `Joulukalenteri: muokkaus luukku ${existing.day}`
      : 'Joulukalenteri: uusi luukkuehdotus');
    if (isEdit) {
      formData.set('day', String(existing.day));
      formData.set('key', editKey);
    }
    formData.set('snippet', snippet);
    if (state.imageDataUrl) formData.set('image', state.imageDataUrl);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || response.statusText);
      }
      $('status').className = 'status success';
      $('status').textContent = 'Kiitos! Lomake lähetettiin.';
      Array.from($('dayForm').elements).forEach(el => { el.disabled = true; });
    } catch (err) {
      $('status').className = 'status error';
      $('status').textContent = `Lähetys epäonnistui (${err.message}). Yritä uudelleen tai kopioi teksti alta.`;
      showFallback(snippet);
      setBusy(false);
    }
  }

  async function copyFallback() {
    try {
      await navigator.clipboard.writeText($('fallbackText').value);
      $('copyBtn').textContent = 'Kopioitu';
    } catch {
      $('fallbackText').select();
    }
  }


  function init() {
    if (isEdit && (!existing || !editKey)) {
      showBlocked();
      return;
    }
    setupMode();
    initMap();
    document.querySelectorAll('.bold-btn').forEach(button => {
      // mousedown + preventDefault keeps the text selection in the editor
      button.addEventListener('mousedown', e => e.preventDefault());
      button.addEventListener('click', () => {
        $(button.dataset.target).focus();
        document.execCommand('bold');
        refresh();
      });
    });
    document.querySelectorAll('.editor').forEach(editor => {
      // Paste as plain text so no formatting from other apps sneaks in
      editor.addEventListener('paste', e => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      });
    });
    $('dayForm').addEventListener('input', refresh);
    $('dayForm').addEventListener('change', refresh);
    $('photo').addEventListener('change', onPhotoChange);
    $('dayForm').addEventListener('submit', onSubmit);
    $('copyBtn').addEventListener('click', copyFallback);
    refresh();
  }

  init();
})();
