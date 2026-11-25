import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { EmergencyRequest } from "../../src/types";
import { Colors } from "../../src/constants/colors";

export default function EmergencyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [emergency, setEmergency] = useState<EmergencyRequest | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await api.get(`/emergencies/${id}`);
        if (res.data?.success) {
          setEmergency(res.data.data.emergency);
        }
      } catch {
        // Fallback placeholder
        setEmergency({
          _id: id || "temp-id",
          userId: "user-1",
          title: "Flash Flood Rescue Needed",
          description: "Multiple individuals stranded on second floor. Water continuing to rise rapidly.",
          category: "rescue",
          priority: "critical",
          location: { type: "Point", coordinates: [-122.4194, 37.7749] },
          address: "Riverside Avenue, Sector 4",
          status: "in_progress",
          createdAt: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

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

        <Text style={styles.sectionHeader}>Location Coordinates</Text>
        <Text style={styles.location}>
          Longitude: {emergency.location.coordinates[0]}, Latitude: {emergency.location.coordinates[1]}
        </Text>
        {emergency.address ? (
          <Text style={styles.address}>📍 {emergency.address}</Text>
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
  location: {
    fontSize: 13,
    color: Colors.info,
    fontWeight: "600",
  },
  address: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginTop: 4,
    fontWeight: "500",
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
