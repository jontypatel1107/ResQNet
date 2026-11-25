import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../src/services/api";
import { getSocket } from "../../src/services/socket";
import { EmergencyRequest } from "../../src/types";
import { Colors } from "../../src/constants/colors";

export default function MyRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyEmergencies = useCallback(async () => {
    try {
      const res = await api.get("/emergencies/my");
      if (res.data?.success) {
        setRequests(res.data.data.emergencies || []);
      }
    } catch {
      // Keep the last known list if refresh fails.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyEmergencies();

      const socket = getSocket();
      const onEmergencyUpdated = (emergency: EmergencyRequest) => {
        setRequests((current) =>
          current.map((item) => (item._id === emergency._id ? { ...item, ...emergency } : item))
        );
      };
      socket.on("emergency_updated", onEmergencyUpdated);

      return () => {
        socket.off("emergency_updated", onEmergencyUpdated);
      };
    }, [fetchMyEmergencies])
  );

  const renderItem = ({ item }: { item: EmergencyRequest }) => {
    const statusColor = Colors.status[item.status] || Colors.textSecondary;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/emergency/${item._id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.desc} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.categoryText}>🏷️ {item.category.toUpperCase()}</Text>
          <Text style={styles.priorityText}>
            ⚡ {item.priority.toUpperCase()}
          </Text>
        </View>
      </TouchableOpacity>
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
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Emergency Requests</Text>
          <Text style={styles.emptySub}>
            You have not submitted any emergency assistance requests yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              fetchMyEmergencies();
            }} />
          }
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
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
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  desc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.emergency,
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
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
  },
});
