import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { getSocket } from "../../src/services/socket";
import { EmergencyRequest } from "../../src/types";
import { isReadableAddress, toMapCoordinates } from "../../src/utils/location";
import { getApiErrorMessage } from "../../src/utils/errors";
import { Colors } from "../../src/constants/colors";

export default function NearbyRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchNearby = useCallback(async () => {
    try {
      const res = await api.get("/volunteers/nearby");
      if (res.data?.success) {
        setRequests(res.data.data.emergencies || []);
      }
    } catch {
      // Keep the last known list if refresh fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNearby();

      const socket = getSocket();
      const refresh = () => fetchNearby();
      socket.on("new_emergency", refresh);
      socket.on("emergency_updated", refresh);

      return () => {
        socket.off("new_emergency", refresh);
        socket.off("emergency_updated", refresh);
      };
    }, [fetchNearby])
  );

  const handleClaim = async (requestId: string) => {
    try {
      setClaimingId(requestId);
      const res = await api.patch(`/assignments/${requestId}/accept`);
      if (res.data?.success) {
        setRequests((current) => current.filter((item) => item._id !== requestId));
        Alert.alert("Mission Accepted", "The SOS is now assigned to you. Start it from My Assignments.", [
          { text: "View Assignments", onPress: () => router.push("/(volunteer)/assignments") },
          { text: "Stay Here", style: "cancel" },
        ]);
      }
    } catch (error: unknown) {
      Alert.alert(
        "Could Not Accept Mission",
        getApiErrorMessage(error, "Please try again or check the mission list.")
      );
      fetchNearby();
    } finally {
      setClaimingId(null);
    }
  };

  const renderItem = ({ item }: { item: EmergencyRequest }) => {
    const mapCoords = toMapCoordinates(item.location);
    const addressText = isReadableAddress(item.address)
      ? item.address!.trim()
      : mapCoords
        ? "Location available on map"
        : "Address not provided";

    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.priority.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.desc}>{item.description}</Text>

        <Text style={styles.address}>📍 {addressText}</Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => router.push(`/emergency/${item._id}`)}
          >
            <Text style={styles.detailText}>Details</Text>
          </TouchableOpacity>

          {mapCoords ? (
            <TouchableOpacity
              style={styles.mapBtn}
              onPress={() =>
                router.push(
                  `/location-map?lat=${mapCoords.latitude}&lng=${mapCoords.longitude}&address=${encodeURIComponent(
                    isReadableAddress(item.address) ? item.address!.trim() : ""
                  )}&title=${encodeURIComponent(item.title)}&emergencyId=${item._id}`
                )
              }
            >
              <Text style={styles.mapBtnText}>Map</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.claimBtn, claimingId === item._id && styles.claimBtnDisabled]}
            onPress={() => handleClaim(item._id)}
            disabled={claimingId !== null}
          >
            {claimingId === item._id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.claimText}>Accept Mission</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyTitle}>All Clear in Your Zone</Text>
          <Text style={styles.emptySub}>No open emergencies awaiting dispatch right now.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
  },
  badge: {
    backgroundColor: Colors.emergencyLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: Colors.emergency,
    fontSize: 11,
    fontWeight: "800",
  },
  desc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  address: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  detailBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  detailText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  mapBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  mapBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.info,
  },
  claimBtn: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  claimBtnDisabled: {
    opacity: 0.6,
  },
  claimText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
});
