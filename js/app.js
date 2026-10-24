// Advent Calendar Map Application
(function() {
  'use strict';

  const { renderCard } = window.CalendarCard;

  // Locations come from js/locations.js
  let locations = window.LOCATIONS;

  // Initialize map
  let map;
  let markers = [];
  let activeMarker = null;

  // Create custom Christmas tree icon
  const christmasTreeIcon = L.divIcon({
    html: '<div style="font-size: 32px;">🎄</div>',
    className: 'christmas-tree-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });

  // Create yellow star icon for preview days
  const previewIcon = L.divIcon({
    html: '<div style="font-size: 28px;">⭐</div>',
    className: 'preview-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });

  const defaultIcon = new L.Icon.Default();

  function initMap() {
    // Create map centered on Littoisten Verkatehdas with autoPan options
    // Coordinates: N=6710372.038, E=247233.694 (ETRS-TM35FIN)
    map = L.map('map', {
      autoPanOnFocus: true,
      autoPan: true
    }).setView([60.4502, 22.4112], 15);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Add markers for all locations
    updateMapMarkers();
  }

  // A day is active from its own date through endDay (default: the day itself)
  function isActiveToday(location) {
    const today = new Date();
    if (today.getMonth() !== 11) return false;
    const endDay = Number.isInteger(location.endDay) ? location.endDay : location.day;
    return location.day <= today.getDate() && today.getDate() <= endDay;
  }

  // A day is over once December has passed its last day on display
  function isExpired(location) {
    if (isPreviewAllMode()) return false;
    const today = new Date();
    if (today.getMonth() !== 11) return false;
    const endDay = Number.isInteger(location.endDay) ? location.endDay : location.day;
    return today.getDate() > endDay;
  }

  function isActiveOnlyMode() {
    return document.getElementById('activeOnly').checked;
  }

  // Helper function to check if a location should show preview content
  function shouldShowPreview(location) {
    // In preview_all mode, never show preview (show full content)
    if (isPreviewAllMode()) return false;

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();

    // Before December or in December before the day: show preview if preview description exists
    if (currentMonth < 11 || (currentMonth === 11 && currentDay < location.day)) {
      return location.previewDescription;
    }
    return false;
  }

  // Check if dev mode is enabled via URL parameter
  function isDevMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('dev_mode') === 'on';
  }

  // Check if preview_all mode is enabled via URL parameter
  // This mode shows all locations as they would appear on December 24th
  function isPreviewAllMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('preview_all') === 'on';
  }

  // Check if a day is publicly accessible
  function isDayAccessible(day) {
    const location = locations.find(loc => loc.day === day);
    if (!location) return false;

    // In preview_all mode, all days are accessible
    if (isPreviewAllMode()) return true;

    // In dev mode, all days are accessible
    if (isDevMode()) return true;

    // Check if day is publicly available
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();

    const dayHasArrived = currentMonth === 11 && day <= currentDay;
    const hasPreview = shouldShowPreview(location);

    return dayHasArrived || hasPreview;
  }

  function updateMapMarkers(selectedDay = null) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Get current date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth(); // 0-indexed, so December is 11, November is 10

    // Add new markers for locations
    locations.forEach(location => {
      if (isActiveOnlyMode() && !isActiveToday(location)) return;
      const dayHasArrived = currentMonth === 11 && location.day <= currentDay;
      const hasPreview = shouldShowPreview(location);

      // In preview_all mode, show all locations
      if (isPreviewAllMode()) {
        // Show all locations in preview_all mode
      } else {
        // Show if:
        // - In December and day has arrived, OR
        // - Has preview content (shown in any month before the day), OR
        // - This is the selected day (always show selected marker in dev mode)
        const isSelected = selectedDay !== null && location.day === selectedDay && isDevMode();

        if (!dayHasArrived && !hasPreview && !isSelected) return;
      }

      // Choose icon based on whether day has arrived or is preview
      let markerIcon = defaultIcon;
      if (hasPreview && !dayHasArrived) {
        markerIcon = previewIcon; // Yellow star for preview days
      }

      const marker = L.marker([location.lat, location.lng], { icon: markerIcon })
        .addTo(map);

      // Store location data with marker
      marker.locationDay = location.day;
      marker.isPreview = hasPreview && !dayHasArrived;

      // Add click handler to marker
      marker.on('click', () => {
        setActiveLocation(location.day);
      });

      markers.push(marker);
    });
  }

  function setActiveLocation(day, updateUrl = true) {
    const location = locations.find(loc => loc.day === day);
    if (!location) return;

    // Check if day is accessible (unless in dev mode)
    if (!isDayAccessible(day)) {
      console.log(`Day ${day} is not yet accessible`);
      return;
    }

    // Reset previous active marker to appropriate icon (preview or default)
    if (activeMarker) {
      if (activeMarker.isPreview) {
        activeMarker.setIcon(previewIcon);
      } else {
        activeMarker.setIcon(defaultIcon);
      }
    }

    // Update markers to ensure the selected day is visible
    updateMapMarkers(day);

    // Find and set new active marker
    markers.forEach(marker => {
      if (marker.locationDay === day) {
        marker.setIcon(christmasTreeIcon);
        activeMarker = marker;
      }
    });

    // Zoom to location
    map.setView([location.lat, location.lng], 18);

    // Scroll to map section (position at top of viewport) after a brief delay to let map pan
    setTimeout(() => {
      const mapSection = document.querySelector('.map-section');
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    // Update URL hash
    if (updateUrl) {
      window.history.pushState(null, '', `#day-${day}`);
    }

    // Move card to top
    moveCardToTop(day);
  }

  function moveCardToTop(day) {
    const listContainer = document.getElementById('locationsList');

    // Remove any existing highlighted card at the top
    const existingHighlight = listContainer.querySelector('.highlighted-card');
    if (existingHighlight) {
      existingHighlight.remove();
    }

    // Find the location data
    const location = locations.find(loc => loc.day === day);
    if (!location) return;

    // Build the card from the shared renderer
    const template = document.createElement('template');
    template.innerHTML = renderCard(location, {
      variant: 'highlighted',
      showPreview: Boolean(shouldShowPreview(location)),
      expired: isExpired(location)
    }).trim();
    const highlightedCard = template.content.firstElementChild;

    // Add click handler to the highlighted card
    highlightedCard.addEventListener('click', () => {
      setActiveLocation(location.day);
    });


    // Insert at the top
    listContainer.insertBefore(highlightedCard, listContainer.firstChild);
  }

  function renderLocationsList() {
    const listContainer = document.getElementById('locationsList');

    // Get current date
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth(); // 0-indexed, so December is 11, November is 10

    // Filter locations to show
    const sortedLocations = [...locations]
      .filter(loc => {
        if (isActiveOnlyMode() && !isActiveToday(loc)) return false;

        // In preview_all mode, show all locations
        if (isPreviewAllMode()) return true;

        // Show if:
        // - In December and day has arrived, OR
        // - Has preview content (shown in any month before the day)
        const dayHasArrived = currentMonth === 11 && loc.day <= currentDay;
        const hasPreview = shouldShowPreview(loc);
        return dayHasArrived || hasPreview;
      })
      .sort((a, b) => a.day - b.day);

    // If no locations to show, display message
    if (sortedLocations.length === 0 && isActiveOnlyMode()) {
      listContainer.innerHTML = '<p style="text-align: center; color: #718096; padding: 2rem;">Tänään ei ole esillä olevia luukkuja.</p>';
      return;
    }
    if (sortedLocations.length === 0) {
      listContainer.innerHTML = '<p style="text-align: center; color: #718096; padding: 2rem;">Joulukalenteri avautuu joulukuussa! 🎄</p>';
      return;
    }

    listContainer.innerHTML = sortedLocations.map(location =>
      renderCard(location, {
        variant: 'list',
        showPreview: Boolean(shouldShowPreview(location))
      })
    ).join('');

    // Add click handlers for cards
    document.querySelectorAll('.location-card').forEach(card => {
      card.addEventListener('click', () => {
        const day = parseInt(card.dataset.day);
        setActiveLocation(day);
      });
    });
  }

  // Check URL hash and activate location
  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash.startsWith('#day-')) {
      const day = parseInt(hash.replace('#day-', ''));
      if (day >= 1 && day <= 24) {
        // Only allow access if day is publicly accessible or dev mode is on
        if (isDayAccessible(day)) {
          setTimeout(() => {
            setActiveLocation(day, false); // Don't update URL since we're loading from it
          }, 500);
          return true;
        } else {
          // Clear invalid hash
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          return false;
        }
      }
    }
    return false;
  }

  // Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    initMap();
    renderLocationsList();

    document.getElementById('activeOnly').addEventListener('change', () => {
      updateMapMarkers();
      renderLocationsList();
    });

    // Check if URL has a hash to load specific day
    const hasHash = checkUrlHash();

    // Auto-select current date location if no hash in URL
    if (!hasHash) {
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth(); // 0-indexed, so December is 11, November is 10

      // Auto-select current day in December (1-24)
      if (currentMonth === 11 && currentDay >= 1 && currentDay <= 24) {
        setTimeout(() => {
          setActiveLocation(currentDay);
        }, 500);
      }
      // In other months (except November), default to day 1
      else if (currentMonth !== 10) {
        setTimeout(() => {
          setActiveLocation(1);
        }, 500);
      }
    }
  });

  // Handle hash changes (back/forward navigation)
  window.addEventListener('hashchange', () => {
    checkUrlHash();
  });

})();
