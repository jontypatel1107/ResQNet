import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import EmergencyMapView from "../src/components/EmergencyMapView";
import { Colors } from "../src/constants/colors";
import { isReadableAddress } from "../src/utils/location";
import { trackingService } from "../src/services/trackingService";
import { getSocket } from "../src/services/socket";

export default function LocationMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    address?: string;
    title?: string;
    emergencyId?: string;
  }>();

  const latitude = Number(params.lat);
  const longitude = Number(params.lng);
  const hasPin =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0);

  const rawAddress = typeof params.address === "string" ? params.address : "";
  const address = isReadableAddress(rawAddress) ? rawAddress.trim() : "";
  const title =
    typeof params.title === "string" && params.title.trim()
      ? params.title.trim()
      : "Emergency Location";
  const emergencyId = params.emergencyId;

  // Live Tracking & ETA State
  const [responderLocation, setResponderLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  } | null>(null);

  const [responderTrail, setResponderTrail] = useState<
    { coordinates: [number, number]; timestamp?: string }[]
  >([]);

  const [eta, setEta] = useState<{
    distanceKm?: number;
    durationMinutes?: number;
  } | null>(null);

  const [responderName, setResponderName] = useState<string>("Assigned Responder");

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const load = async () => {
        if (!emergencyId) return;
        try {
          const t = await trackingService.getTracking(emergencyId);
          if (!isMounted || !t) return;
          if (t.responderLocation?.latitude && t.responderLocation?.longitude) {
            setResponderLocation(t.responderLocation);
          }
          if (Array.isArray(t.responderTrail)) {
            setResponderTrail(t.responderTrail);
          }
          if (t.eta) {
            setEta(t.eta);
          }
          if (t.responder?.name) {
            setResponderName(t.responder.name);
          }
        } catch {
          // Non-blocking fallback
        }
      };

      void load();

      if (!emergencyId) return;

      const socket = getSocket();
      const onLocationUpdate = (payload: {
        emergencyId?: string;
        responderLocation?: {
          latitude: number;
          longitude: number;
          heading?: number;
          speed?: number;
        };
        eta?: { distanceKm?: number; durationMinutes?: number };
        trailPoint?: { coordinates: [number, number]; timestamp?: string };
      }) => {
        if (payload?.emergencyId === emergencyId) {
          if (payload.responderLocation) {
            setResponderLocation(payload.responderLocation);
          }
          if (payload.eta) {
            setEta(payload.eta);
          }
          if (payload.trailPoint?.coordinates) {
            setResponderTrail((prev) => [...prev, payload.trailPoint!]);
          }
        }
      };

      socket.on("location_update", onLocationUpdate);

      return () => {
        isMounted = false;
        socket.off("location_update", onLocationUpdate);
      };
    }, [emergencyId])
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Emergency Map</Text>
      </View>

      {/* Live ETA Banner (when responder is active) */}
      {responderLocation ? (
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Text style={styles.etaIcon}>🚑</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.etaHeaderLine}>
                <Text style={styles.etaLabel}>RESPONDER EN ROUTE</Text>
                <View style={styles.liveTag}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveTagText}>LIVE GPS</Text>
                </View>
              </View>
              <Text style={styles.etaMinutes}>
                {eta?.durationMinutes !== undefined
                  ? eta.durationMinutes === 0
                    ? "Arrived at SOS Scene"
                    : `~${eta.durationMinutes} mins estimated arrival`
                  : "Calculating ETA..."}
              </Text>
              <Text style={styles.etaSub}>
                {responderName} • {eta?.distanceKm !== undefined ? `${eta.distanceKm} km away` : "Moving"}
                {responderLocation.speed ? ` • ${Math.round(responderLocation.speed)} km/h` : ""}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {hasPin ? (
        <>
          <View style={styles.mapWrap}>
            <EmergencyMapView
              latitude={latitude}
              longitude={longitude}
              title={title}
              address={address}
              responderLocation={responderLocation}
              responderTrail={responderTrail}
              responderName={responderName}
            />
          </View>
          <View style={styles.details}>
            <Text style={styles.detailsLabel}>📍 Incident Location</Text>
            <Text style={styles.detailsAddress}>
              {address || "Address not provided — use the red marker for coordinates."}
            </Text>
            {responderTrail.length > 0 ? (
              <Text style={styles.trailMeta}>
                🔵 Breadcrumb Trail: {responderTrail.length} location pings tracked
              </Text>
            ) : null}
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  etaCard: {
    backgroundColor: "#EBF8FF",
    borderWidth: 1,
    borderColor: "#BEE3F8",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    padding: 12,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  etaIcon: {
    fontSize: 28,
  },
  etaHeaderLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  etaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2B6CB0",
    letterSpacing: 0.5,
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FEB2B2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.emergency,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.emergency,
  },
  etaMinutes: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A365D",
  },
  etaSub: {
    fontSize: 12,
    color: "#4A5568",
    marginTop: 2,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
  },
  details: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  detailsAddress: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  trailMeta: {
    fontSize: 11,
    color: Colors.info,
    fontWeight: "600",
    marginTop: 6,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  missingIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  missingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  missingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
});
