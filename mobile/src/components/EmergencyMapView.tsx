import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Colors } from "../constants/colors";

type EmergencyMapViewProps = {
  latitude: number;
  longitude: number;
  title?: string;
  address?: string;
};

export default function EmergencyMapView({
  latitude,
  longitude,
}: EmergencyMapViewProps) {
  // Expo Go no longer supports native Google Maps tiles, so render a web map
  // with an embedded pin instead. This also avoids needing a Maps API key.
  const delta = 0.01;
  const bbox = [
    longitude - delta,
    latitude - delta,
    longitude + delta,
    latitude + delta,
  ].join("%2C");
  const marker = `${latitude}%2C${longitude}`;
  const uri = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;

  return (
    <View style={styles.container}>
      <WebView
        style={styles.map}
        source={{ uri }}
        originWhitelist={["https://*"]}
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
