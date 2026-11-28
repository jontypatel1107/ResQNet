import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Colors } from "../constants/colors";
import { Hazard } from "../types";

export type EmergencyMapViewProps = {
  latitude: number;
  longitude: number;
  title?: string;
  address?: string;
  responderLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  } | null;
  responderTrail?: {
    coordinates: [number, number];
    heading?: number;
    speed?: number;
    timestamp?: string;
  }[];
  responderName?: string;
  hazards?: Hazard[];
  showIncidentMarker?: boolean;
  focusedHazardCoords?: { latitude: number; longitude: number } | null;
  selectedPinCoords?: { latitude: number; longitude: number } | null;
  onSelectMapLocation?: (coords: { latitude: number; longitude: number }) => void;
};

export default function EmergencyMapView({
  latitude,
  longitude,
  title = "Emergency Location",
  address = "",
  responderLocation,
  responderTrail = [],
  responderName = "Assigned Responder",
  hazards = [],
  showIncidentMarker = true,
  focusedHazardCoords = null,
  selectedPinCoords = null,
  onSelectMapLocation,
}: EmergencyMapViewProps) {
  const rLat = responderLocation?.latitude ?? null;
  const rLng = responderLocation?.longitude ?? null;
  const trailJson = JSON.stringify(responderTrail || []);
  const hazardsJson = JSON.stringify(hazards || []);
  const focusedJson = JSON.stringify(focusedHazardCoords);
  const pinJson = JSON.stringify(selectedPinCoords);

  const htmlSource = useMemo(() => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <style>
    * { margin:0; padding:0; box-sizing: border-box; }
    html, body, #map { width:100%; height:100%; }
    .incident-marker {
      width: 32px; height: 32px; background: #E53935; border: 3px solid #FFFFFF; border-radius: 50%;
      box-shadow: 0 0 10px rgba(229,57,53,0.7); display: flex; align-items: center; justify-content: center;
      color: #FFF; font-size: 15px;
    }
    .responder-marker {
      width: 36px; height: 36px; background: #3182CE; border: 3px solid #FFFFFF; border-radius: 50%;
      box-shadow: 0 0 12px rgba(49,130,206,0.8); display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    .selected-pin-marker {
      width: 36px; height: 36px; background: #F59E0B; border: 3px solid #FFFFFF; border-radius: 50%;
      box-shadow: 0 0 14px rgba(245,158,11,0.9); display: flex; align-items: center; justify-content: center;
      font-size: 18px; animation: bounce 1s infinite alternate;
    }
    @keyframes bounce {
      from { transform: translateY(0); }
      to { transform: translateY(-6px); }
    }
    .custom-popup .leaflet-popup-content-wrapper {
      background: #14283F; color: #FFF; border-radius: 8px; font-family: sans-serif;
    }
    .custom-popup .leaflet-popup-tip { background: #14283F; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const incidentCoords = [${latitude}, ${longitude}];
    const rCoords = ${rLat && rLng ? `[${rLat}, ${rLng}]` : "null"};
    const trailData = ${trailJson};
    const focusedCoords = ${focusedJson};
    const selectedCoords = ${pinJson};

    const map = L.map('map', { zoomControl: true }).setView(incidentCoords, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    ${showIncidentMarker ? `
    // Incident Marker (Red SOS)
    const incIcon = L.divIcon({
      className: '',
      html: '<div class="incident-marker">🆘</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker(incidentCoords, { icon: incIcon }).addTo(map)
      .bindPopup("<b>${title.replace(/"/g, '\\"')}</b><br>${address.replace(/"/g, '\\"')}", { className: 'custom-popup' });
    ` : `
    // Standalone Hazard Map Center Marker
    const centerIcon = L.divIcon({
      className: '',
      html: '<div style="width:28px;height:28px;background:#2563EB;border:3px solid #FFF;border-radius:50%;box-shadow:0 0 10px rgba(37,99,235,0.7);display:flex;align-items:center;justify-content:center;font-size:14px;color:#FFF;">📍</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    L.marker(incidentCoords, { icon: centerIcon }).addTo(map)
      .bindPopup("<b>My Location Area</b>", { className: 'custom-popup' });
    `}

    // Breadcrumb Trail (Blue Polyline)
    if (trailData && trailData.length > 0) {
      const latlngs = trailData.map(pt => [pt.coordinates[1], pt.coordinates[0]]);
      L.polyline(latlngs, {
        color: '#3182CE',
        weight: 4,
        opacity: 0.8,
        dashArray: '5, 8',
        lineCap: 'round'
      }).addTo(map);
    }

    // Responder Marker (Blue Ambulance)
    let responderMarker = null;
    if (rCoords) {
      const respIcon = L.divIcon({
        className: '',
        html: '<div class="responder-marker">🚑</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      responderMarker = L.marker(rCoords, { icon: respIcon }).addTo(map)
        .bindPopup("<b>${responderName.replace(/"/g, '\\"')}</b><br>En route to location", { className: 'custom-popup' });
    }

    // Hazard & Road Blockage Markers
    const hazardsData = ${hazardsJson};
    const HAZARD_ICONS = {
      flooded_road: '🌊',
      downed_powerline: '⚡',
      fallen_tree: '🌲',
      collapsed_structure: '🏚️',
      gas_leak: '☣️',
      landslide: '🪨',
      other: '⚠️'
    };
    const SEVERITY_COLORS = {
      critical: '#DC2626',
      high: '#EA580C',
      medium: '#D97706',
      low: '#CA8A04'
    };

    const hazardMarkerMap = {};

    if (hazardsData && hazardsData.length > 0) {
      hazardsData.forEach(h => {
        if (!h.location || !h.location.coordinates) return;
        const hLng = h.location.coordinates[0];
        const hLat = h.location.coordinates[1];
        const iconSym = HAZARD_ICONS[h.type] || '⚠️';
        const sevColor = SEVERITY_COLORS[h.severity] || '#EA580C';

        const hzIcon = L.divIcon({
          className: '',
          html: '<div style="width:36px;height:36px;background:#FEF3C7;border:3px solid ' + sevColor + ';border-radius:50%;box-shadow:0 0 12px ' + sevColor + ';display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;">' + iconSym + '</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        const statusTag = h.status === 'cleared'
          ? '<span style="color:#22C55E;font-weight:bold;">✅ Cleared</span>'
          : '<span style="color:' + sevColor + ';font-weight:bold;">⚠️ Active Hazard</span>';

        const popupContent = '<div style="min-width:180px;font-family:sans-serif;">' +
          '<b style="font-size:13px;color:#FFF;">' + iconSym + ' ' + (h.title || 'Hazard').replace(/"/g, '&quot;') + '</b><br>' +
          '<div style="margin:4px 0;">' + statusTag + ' &bull; <span style="text-transform:uppercase;font-size:10px;color:#CBD5E1;">' + (h.severity || 'high') + '</span></div>' +
          (h.address ? '<div style="font-size:11px;color:#94A3B8;margin-bottom:4px;">📍 ' + h.address.replace(/"/g, '&quot;') + '</div>' : '') +
          (h.description ? '<div style="font-size:11px;color:#E2E8F0;font-style:italic;">' + h.description.replace(/"/g, '&quot;') + '</div>' : '') +
          (h.reporterName ? '<div style="font-size:10px;color:#64748B;margin-top:4px;">Reported by ' + h.reporterName.replace(/"/g, '&quot;') + '</div>' : '') +
        '</div>';

        const mk = L.marker([hLat, hLng], { icon: hzIcon }).addTo(map)
          .bindPopup(popupContent, { className: 'custom-popup' });

        if (h._id) {
          hazardMarkerMap[h._id] = mk;
        }
      });
    }

    // Selected Pin Marker (when user taps on map to set a hazard spot)
    let selectedMarker = null;
    if (selectedCoords && selectedCoords.latitude && selectedCoords.longitude) {
      const pinIcon = L.divIcon({
        className: '',
        html: '<div class="selected-pin-marker">⚠️</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      selectedMarker = L.marker([selectedCoords.latitude, selectedCoords.longitude], { icon: pinIcon }).addTo(map)
        .bindPopup("<b>Target Hazard Spot</b><br>Selected on map", { className: 'custom-popup' }).openPopup();
    }

    // Map Tap Listener to select location
    map.on('click', function(e) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MAP_CLICK',
          latitude: lat,
          longitude: lng
        }));
      }
    });

    // If focused on specific hazard, animate to it
    if (focusedCoords && focusedCoords.latitude && focusedCoords.longitude) {
      map.setView([focusedCoords.latitude, focusedCoords.longitude], 16, { animate: true });
    } else {
      // Fit bounds to show incident, responder, and active hazards
      const boundsGroup = [incidentCoords];
      if (rCoords) boundsGroup.push(rCoords);
      if (trailData && trailData.length > 0) {
        trailData.forEach(pt => boundsGroup.push([pt.coordinates[1], pt.coordinates[0]]));
      }
      if (hazardsData && hazardsData.length > 0) {
        hazardsData.forEach(h => {
          if (h.location?.coordinates) {
            boundsGroup.push([h.location.coordinates[1], h.location.coordinates[0]]);
          }
        });
      }
      map.fitBounds(L.latLngBounds(boundsGroup), { padding: [40, 40], maxZoom: 16 });
    }
  </script>
</body>
</html>`;
  }, [
    latitude,
    longitude,
    title,
    address,
    showIncidentMarker,
    rLat,
    rLng,
    trailJson,
    responderName,
    hazardsJson,
    focusedJson,
    pinJson,
  ]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === "MAP_CLICK" && onSelectMapLocation) {
        onSelectMapLocation({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        style={styles.map}
        source={{ html: htmlSource }}
        originWhitelist={["*"]}
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  map: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
});
