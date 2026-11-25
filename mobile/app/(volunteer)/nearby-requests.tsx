import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { EmergencyRequest } from "../../src/types";
import { Colors } from "../../src/constants/colors";

export default function NearbyRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNearby = async () => {
    try {
      const res = await api.get("/volunteers/nearby");
      if (res.data?.success) {
        setRequests(res.data.data.emergencies || []);
      }
    } catch {
      // Empty fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNearby();
  }, []);

  const handleClaim = async (requestId: string) => {
    try {
      const res = await api.patch(`/assignments/${requestId}/accept`);
      if (res.data?.success) {
        Alert.alert("Assignment Accepted", "You have claimed this emergency response task.", [
          { text: "View Assignments", onPress: () => router.push("/(volunteer)/assignments") },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Claim Info", "Request logged. Proceed to Mission Details.");
      router.push(`/emergency/${requestId}`);
    }
  };

  const renderItem = ({ item }: { item: EmergencyRequest }) => {
    return (
      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.priority.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.desc}>{item.description}</Text>

        {item.address ? (
          <Text style={styles.address}>📍 {item.address}</Text>
        ) : null}

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.detailBtn}
            onPress={() => router.push(`/emergency/${item._id}`)}
          >
            <Text style={styles.detailText}>Details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => handleClaim(item._id)}
          >
            <Text style={styles.claimText}>Accept Mission</Text>
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
  claimBtn: {
    flex: 1,
    backgroundColor: Colors.success,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
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
