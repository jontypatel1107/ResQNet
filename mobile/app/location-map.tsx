import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import EmergencyMapView from "../src/components/EmergencyMapView";
import { Colors } from "../src/constants/colors";
import { isReadableAddress } from "../src/utils/location";

export default function LocationMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    address?: string;
    title?: string;
  }>();

  const latitude = Number(params.lat);
  const longitude = Number(params.lng);
  const hasPin =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0);

  const rawAddress = typeof params.address === "string" ? params.address : "";
  const address = isReadableAddress(rawAddress) ? rawAddress.trim() : "";
  const title = typeof params.title === "string" && params.title.trim()
    ? params.title.trim()
    : "Emergency Location";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency Location</Text>
      </View>

      {hasPin ? (
        <>
          <View style={styles.mapWrap}>
            <EmergencyMapView
              latitude={latitude}
              longitude={longitude}
              title={title}
              address={address}
            />
          </View>
          <View style={styles.details}>
            <Text style={styles.detailsLabel}>📍 Location</Text>
            <Text style={styles.detailsAddress}>
              {address || "Address not provided — use the map pin for navigation."}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.missingIcon}>📍</Text>
          <Text style={styles.missingTitle}>No map pin available</Text>
          <Text style={styles.missingText}>
            This report was submitted with an address but without GPS coordinates.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
  },
  backText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
  },
  details: {
    padding: 16,
    margin: 16,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailsLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  detailsAddress: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  missingIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  missingTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  missingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
  },
});
