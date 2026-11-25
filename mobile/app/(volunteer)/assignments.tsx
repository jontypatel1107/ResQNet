import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { api } from "../../src/services/api";
import { AssistanceAssignment } from "../../src/types";
import { Colors } from "../../src/constants/colors";

export default function VolunteerAssignments() {
  const [assignments, setAssignments] = useState<AssistanceAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    try {
      const res = await api.get("/assignments/my");
      if (res.data?.success) {
        setAssignments(res.data.data.assignments || []);
      }
    } catch {
      // Empty fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/assignments/${id}/status`, { status });
      fetchAssignments();
    } catch {}
  };

  const renderItem = ({ item }: { item: AssistanceAssignment }) => {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Mission ID: {item._id.slice(-6).toUpperCase()}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.notes}>
          {item.notes || "Emergency assistance active. Follow safety protocols."}
        </Text>

        <View style={styles.btnRow}>
          {item.status === "accepted" && (
            <TouchableOpacity
              style={[styles.btn, styles.progressBtn]}
              onPress={() => updateStatus(item._id, "in_progress")}
            >
              <Text style={styles.btnText}>Mark In Progress</Text>
            </TouchableOpacity>
          )}

          {item.status === "in_progress" && (
            <TouchableOpacity
              style={[styles.btn, styles.completeBtn]}
              onPress={() => updateStatus(item._id, "completed")}
            >
              <Text style={styles.btnText}>Resolve & Complete</Text>
            </TouchableOpacity>
          )}
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
      ) : assignments.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>No Active Missions</Text>
          <Text style={styles.emptySub}>
            Claim emergency requests in the Nearby SOS tab to begin rescue operations.
          </Text>
        </View>
      ) : (
        <FlatList
          data={assignments}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  statusBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  notes: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  progressBtn: {
    backgroundColor: Colors.info,
  },
  completeBtn: {
    backgroundColor: Colors.success,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
