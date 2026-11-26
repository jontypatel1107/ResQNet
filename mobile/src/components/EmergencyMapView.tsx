import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Colors } from "../constants/colors";

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
};

export default function EmergencyMapView({
  latitude,
  longitude,
  title = "Emergency Location",
  address = "",
  responderLocation,
  responderTrail = [],
  responderName = "Assigned Responder",
}: EmergencyMapViewProps) {
  const rLat = responderLocation?.latitude ?? null;
  const rLng = responderLocation?.longitude ?? null;
  const trailJson = JSON.stringify(responderTrail || []);

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

    const map = L.map('map', { zoomControl: false }).setView(incidentCoords, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Incident Marker (Red)
    const incIcon = L.divIcon({
      className: '',
      html: '<div class="incident-marker">🆘</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    L.marker(incidentCoords, { icon: incIcon }).addTo(map)
      .bindPopup("<b>${title.replace(/"/g, '\\"')}</b><br>${address.replace(/"/g, '\\"')}", { className: 'custom-popup' });

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

    // Fit bounds to show both incident and responder trail
    const boundsGroup = [incidentCoords];
    if (rCoords) boundsGroup.push(rCoords);
    if (trailData && trailData.length > 0) {
      trailData.forEach(pt => boundsGroup.push([pt.coordinates[1], pt.coordinates[0]]));
    }
    map.fitBounds(L.latLngBounds(boundsGroup), { padding: [40, 40], maxZoom: 16 });
  </script>
</body>
</html>`;
  }, [latitude, longitude, title, address, rLat, rLng, trailJson, responderName]);

  return (
    <View style={styles.container}>
      <WebView
        style={styles.map}
        source={{ html: htmlSource }}
        originWhitelist={["*"]}
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
