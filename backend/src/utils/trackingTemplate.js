/**
 * Generate a standalone, mobile-responsive HTML5 live tracking page with
 * an interactive Leaflet map, moving responder pin, breadcrumb trail, and live ETA.
 */
export const renderPublicTrackingHtml = (tracking) => {
  const {
    id,
    title,
    category,
    priority,
    status,
    address,
    coordinates,
    requester,
    responder,
    responderLocation,
    responderTrail,
    eta,
    createdAt,
  } = tracking;

  const lat = coordinates?.latitude || 0;
  const lng = coordinates?.longitude || 0;
  const rLat = responderLocation?.latitude || null;
  const rLng = responderLocation?.longitude || null;
  const trailJson = JSON.stringify(responderTrail || []);
  const categoryLabel = (category || "Emergency").toUpperCase();
  const priorityLabel = (priority || "emergency").toUpperCase();
  const statusLabel = (status || "active").toUpperCase();

  const priorityColor =
    priority === "critical"
      ? "#E53935"
      : priority === "high"
      ? "#DD6B20"
      : priority === "medium"
      ? "#3182CE"
      : "#718096";

  const statusColor =
    status === "resolved"
      ? "#38A169"
      : status === "in_progress"
      ? "#D69E2E"
      : status === "accepted" || status === "assigned"
      ? "#3182CE"
      : "#E53935";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ResQNet Live SOS Tracking — ${escapeHtml(title)}</title>
  
  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F0F4F8;
      color: #1A202C;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    
    header {
      background: #14283F;
      color: #FFFFFF;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 1000;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-icon { font-size: 20px; }
    .brand-title { font-weight: 800; font-size: 16px; letter-spacing: 0.5px; }
    .live-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(229, 57, 53, 0.2);
      border: 1px solid #E53935;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      color: #FF6B6B;
    }
    .pulse-dot {
      width: 7px;
      height: 7px;
      background: #E53935;
      border-radius: 50%;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.4); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.8; }
    }

    #map {
      flex: 1;
      width: 100%;
      z-index: 1;
    }

    .tracking-card {
      background: #FFFFFF;
      border-top-left-radius: 20px;
      border-top-right-radius: 20px;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.12);
      padding: 16px 20px 24px;
      z-index: 1000;
      max-height: 45vh;
      overflow-y: auto;
    }
    .pill-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;
    }
    .badge {
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      color: #FFF;
      text-transform: uppercase;
    }
    .incident-title {
      font-size: 17px;
      font-weight: 800;
      color: #1A202C;
      margin-bottom: 4px;
    }
    .incident-address {
      font-size: 13px;
      color: #718096;
      margin-bottom: 12px;
    }

    /* ETA Banner */
    .eta-box {
      background: #EBF8FF;
      border: 1px solid #BEE3F8;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .eta-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .eta-icon { font-size: 26px; }
    .eta-title { font-size: 11px; font-weight: 700; color: #2B6CB0; text-transform: uppercase; }
    .eta-val { font-size: 18px; font-weight: 900; color: #1A365D; }
    .eta-sub { font-size: 11px; color: #4A5568; margin-top: 1px; }

    /* Responder card */
    .responder-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #F7FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 10px 14px;
    }
    .resp-info { display: flex; flex-direction: column; }
    .resp-name { font-size: 13px; font-weight: 700; color: #2D3748; }
    .resp-status { font-size: 11px; color: #718096; }
    .call-btn {
      background: #3182CE;
      color: #FFF;
      text-decoration: none;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
    }

    /* Leaflet Custom Marker Icons */
    .incident-pin {
      width: 32px;
      height: 32px;
      background: #E53935;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 12px rgba(229,57,53,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFF;
      font-size: 15px;
    }
    .responder-pin {
      width: 36px;
      height: 36px;
      background: #3182CE;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 14px rgba(49,130,206,0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span class="brand-icon">🛡️</span>
      <span class="brand-title">ResQNet Live Tracking</span>
    </div>
    <div class="live-badge">
      <div class="pulse-dot"></div>
      <span>REAL-TIME</span>
    </div>
  </header>

  <div id="map"></div>

  <div class="tracking-card">
    <div class="pill-row">
      <span class="badge" style="background-color: ${priorityColor};">${escapeHtml(priorityLabel)}</span>
      <span class="badge" style="background-color: ${statusColor};" id="status-pill">${escapeHtml(statusLabel)}</span>
      <span style="font-size: 11px; color: #A0AEC0;">${escapeHtml(categoryLabel)}</span>
    </div>

    <div class="incident-title">${escapeHtml(title)}</div>
    <div class="incident-address">📍 ${escapeHtml(address || "Coordinates: " + lat + ", " + lng)}</div>

    <!-- ETA Banner -->
    <div class="eta-box" id="eta-box" style="${responder ? "" : "display:none;"}">
      <div class="eta-left">
        <span class="eta-icon">🚑</span>
        <div>
          <div class="eta-title">Estimated Arrival</div>
          <div class="eta-val" id="eta-val">${eta?.durationMinutes ? "~" + eta.durationMinutes + " MINS" : "CALCULATING ETA..."}</div>
          <div class="eta-sub" id="eta-sub">${eta?.distanceKm ? eta.distanceKm + " km away" : "En route to SOS location"}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 11px; font-weight: 700; color: #2B6CB0;" id="speed-val">${responderLocation?.speed ? Math.round(responderLocation.speed) + " km/h" : "En Route"}</span>
      </div>
    </div>

    <!-- Responder Contact Box -->
    <div class="responder-box" id="responder-box" style="${responder ? "" : "display:none;"}">
      <div class="resp-info">
        <span class="resp-name" id="responder-name">👤 ${escapeHtml(responder?.name || "Assigned Responder")}</span>
        <span class="resp-status" id="responder-status">Status: ${escapeHtml(responder?.status || "Dispatched")}</span>
      </div>
      ${
        responder?.phone
          ? `<a href="tel:${escapeHtml(responder.phone)}" class="call-btn" id="call-btn">📞 Call</a>`
          : ""
      }
    </div>

    ${
      !responder
        ? `<div style="text-align:center; padding: 10px; color: #718096; font-size: 13px;" id="searching-msg">
            📡 Broadcasting alert to nearby certified emergency volunteers...
          </div>`
        : ""
    }
  </div>

  <!-- Leaflet JS -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  
  <script>
    const emergencyId = "${id}";
    const incidentCoords = [${lat}, ${lng}];
    let responderCoords = ${rLat && rLng ? `[${rLat}, ${rLng}]` : "null"};
    let initialTrail = ${trailJson};

    // Initialize Map
    const map = L.map('map', { zoomControl: false }).setView(incidentCoords, 14);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Incident Marker (Red SOS)
    const incidentIcon = L.divIcon({
      className: '',
      html: '<div class="incident-pin">🆘</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    const incidentMarker = L.marker(incidentCoords, { icon: incidentIcon }).addTo(map)
      .bindPopup("<b>Emergency Location</b><br>${escapeHtml(title)}");

    // Responder Marker (Blue Ambulance)
    const responderIcon = L.divIcon({
      className: '',
      html: '<div class="responder-pin">🚑</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    let responderMarker = null;
    if (responderCoords) {
      responderMarker = L.marker(responderCoords, { icon: responderIcon }).addTo(map)
        .bindPopup("<b>Responder Moving</b>");
    }

    // Breadcrumb Trail Polyline
    const trailLatLngs = initialTrail.map(pt => [pt.coordinates[1], pt.coordinates[0]]);
    const trailPolyline = L.polyline(trailLatLngs, {
      color: '#3182CE',
      weight: 4,
      opacity: 0.8,
      dashArray: '6, 8',
      lineCap: 'round'
    }).addTo(map);

    // Auto fit bounds
    function fitAll() {
      const group = [incidentCoords];
      if (responderCoords) group.push(responderCoords);
      if (trailLatLngs.length > 0) group.push(...trailLatLngs);
      map.fitBounds(L.latLngBounds(group), { padding: [50, 50], maxZoom: 16 });
    }
    fitAll();

    // Live Auto-Poll Every 3.5 Seconds for Moving Pin & ETA
    setInterval(async () => {
      try {
        const res = await fetch('/api/emergencies/track/' + emergencyId + '?format=json');
        const data = await res.json();
        if (!data || !data.success || !data.data || !data.data.tracking) return;

        const t = data.data.tracking;

        // Update Status
        const statusPill = document.getElementById('status-pill');
        if (statusPill) statusPill.innerText = (t.status || '').toUpperCase();

        // Update Responder
        if (t.responder) {
          document.getElementById('eta-box').style.display = 'flex';
          document.getElementById('responder-box').style.display = 'flex';
          const sMsg = document.getElementById('searching-msg');
          if (sMsg) sMsg.style.display = 'none';

          document.getElementById('responder-name').innerText = '👤 ' + t.responder.name;
          document.getElementById('responder-status').innerText = 'Status: ' + t.responder.status;

          // Update ETA
          if (t.eta && t.eta.durationMinutes) {
            document.getElementById('eta-val').innerText = '~' + t.eta.durationMinutes + ' MINS';
            document.getElementById('eta-sub').innerText = (t.eta.distanceKm || '0') + ' km away from SOS';
          }
        }

        // Update Moving Responder Marker & Trail
        if (t.responderLocation && t.responderLocation.latitude && t.responderLocation.longitude) {
          const newPos = [t.responderLocation.latitude, t.responderLocation.longitude];
          responderCoords = newPos;

          if (t.responderLocation.speed) {
            document.getElementById('speed-val').innerText = Math.round(t.responderLocation.speed) + ' km/h';
          }

          if (!responderMarker) {
            responderMarker = L.marker(newPos, { icon: responderIcon }).addTo(map)
              .bindPopup("<b>Responder Moving</b>");
          } else {
            responderMarker.setLatLng(newPos);
          }

          // Append to polyline trail
          trailPolyline.addLatLng(newPos);
        }
      } catch (err) {
        // Silently retry on next poll
      }
    }, 3500);
  </script>
</body>
</html>`;
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
