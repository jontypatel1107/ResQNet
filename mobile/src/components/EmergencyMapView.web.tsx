import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Linking from "expo-linking";
import { Colors } from "../constants/colors";
import { buildGoogleMapsUrl, MapCoordinates } from "../utils/location";

type EmergencyMapViewProps = MapCoordinates & {
  title?: string;
  address?: string;
};

export default function EmergencyMapViewWeb({
  latitude,
  longitude,
  address,
}: EmergencyMapViewProps) {
  const openInMaps = () => {
    void Linking.openURL(buildGoogleMapsUrl({ latitude, longitude })).catch(() => {
      Alert.alert("Could Not Open Map", "Open this link in a browser to view the location.");
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.title}>Map preview is available in the mobile app</Text>
      <Text style={styles.address}>{address || "Emergency location pin"}</Text>
      <TouchableOpacity style={styles.button} onPress={openInMaps}>
        <Text style={styles.buttonText}>Open in Google Maps</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  icon: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  address: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
  },
  button: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: Colors.textWhite,
    fontWeight: "700",
  },
});
