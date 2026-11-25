import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { getSocket } from "../../src/services/socket";
import { EmergencyRequest } from "../../src/types";
import { isReadableAddress, toMapCoordinates } from "../../src/utils/location";
import { Colors } from "../../src/constants/colors";

export default function EmergencyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [emergency, setEmergency] = useState<EmergencyRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!id) return;

    try {
      const res = await api.get(`/emergencies/${id}`);
      if (res.data?.success) {
        setEmergency(res.data.data.emergency);
      }
    } catch {
      setEmergency(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchDetail();

      const socket = getSocket();
      const onEmergencyUpdated = (updated: EmergencyRequest) => {
        if (updated._id === id) setEmergency(updated);
      };
      socket.on("emergency_updated", onEmergencyUpdated);

      return () => {
        socket.off("emergency_updated", onEmergencyUpdated);
      };
    }, [fetchDetail, id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!emergency) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Emergency incident not found.</Text>
      </View>
    );
  }

  const statusColor = Colors.status[emergency.status] || Colors.textSecondary;
  const mapCoords = toMapCoordinates(emergency.location);
  const addressText = isReadableAddress(emergency.address)
    ? emergency.address!.trim()
    : "Address not provided";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={[styles.priorityBadge, { backgroundColor: emergency.priority === "critical" ? Colors.emergency : Colors.warning }]}>
            <Text style={styles.priorityText}>{emergency.priority.toUpperCase()}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{emergency.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.title}>{emergency.title}</Text>
        <Text style={styles.category}>Category: {emergency.category.toUpperCase()}</Text>

        <View style={styles.divider} />

        <Text style={styles.sectionHeader}>Incident Description</Text>
        <Text style={styles.description}>{emergency.description}</Text>

        <Text style={styles.sectionHeader}>Location</Text>
        <Text style={styles.address}>📍 {addressText}</Text>
        {mapCoords ? (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() =>
              router.push(
                `/location-map?lat=${mapCoords.latitude}&lng=${mapCoords.longitude}&address=${encodeURIComponent(
                  isReadableAddress(emergency.address) ? emergency.address!.trim() : ""
                )}&title=${encodeURIComponent(emergency.title)}`
              )
            }
          >
            <Text style={styles.mapBtnText}>🗺️ View on Map</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.divider} />

        <Text style={styles.timestamp}>
          Logged: {new Date(emergency.createdAt).toLocaleString()}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
      >
        <Text style={styles.backBtnText}>Return to Previous Screen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priorityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  category: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  address: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginTop: 4,
    fontWeight: "500",
    lineHeight: 20,
  },
  mapBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.info,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  mapBtnText: {
    color: Colors.info,
    fontSize: 13,
    fontWeight: "700",
  },
  timestamp: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  backBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
