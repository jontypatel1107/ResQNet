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
import { useFocusEffect } from "expo-router";
import { api } from "../../src/services/api";
import { getSocket } from "../../src/services/socket";
import { AssistanceAssignment, EmergencyRequest } from "../../src/types";
import { getApiErrorMessage } from "../../src/utils/errors";
import { Colors } from "../../src/constants/colors";

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  accepted: Colors.info,
  in_progress: Colors.warning,
  completed: Colors.success,
  cancelled: Colors.textMuted,
  rejected: Colors.emergency,
};

export default function VolunteerAssignments() {
  const [assignments, setAssignments] = useState<AssistanceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await api.get("/assignments/my");
      if (res.data?.success) {
        setAssignments(res.data.data.assignments || []);
      }
    } catch {
      // Keep the last known list if refresh fails.
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAssignments();

      const socket = getSocket();
      const refresh = () => fetchAssignments();
      socket.on("assignment_updated", refresh);
      socket.on("emergency_updated", refresh);

      return () => {
        socket.off("assignment_updated", refresh);
        socket.off("emergency_updated", refresh);
      };
    }, [fetchAssignments])
  );

  const changeStatus = async (id: string, status: "in_progress" | "completed" | "cancelled") => {
    try {
      setBusyId(id);
      await api.patch(`/assignments/${id}/status`, { status });
      await fetchAssignments();
      Alert.alert(
        "Mission Updated",
        status === "cancelled"
          ? "The mission was cancelled and the SOS is open for another volunteer."
          : status === "completed"
            ? "Mission completed. The citizen's request is marked resolved."
            : "Mission is now in progress."
      );
    } catch (error: unknown) {
      Alert.alert("Could Not Update Mission", getApiErrorMessage(error, "Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const acceptMission = async (requestId: string) => {
    try {
      setBusyId(requestId);
      await api.patch(`/assignments/${requestId}/accept`);
      await fetchAssignments();
      Alert.alert("Mission Accepted", "You can now start or cancel this mission.");
    } catch (error: unknown) {
      Alert.alert("Could Not Accept Mission", getApiErrorMessage(error, "Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: AssistanceAssignment }) => {
    const request = typeof item.requestId === "object" ? (item.requestId as EmergencyRequest) : null;
    const requestId = typeof item.requestId === "string" ? item.requestId : request?._id || "";
    const title = request?.title || `Mission ID: ${item._id.slice(-6).toUpperCase()}`;
    const busy = busyId === item._id || busyId === requestId;

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || Colors.primary }]}>
            <Text style={styles.statusText}>{item.status.replace("_", " ").toUpperCase()}</Text>
          </View>
        </View>

        <Text style={styles.notes}>
          {item.notes || "Emergency assistance active. Follow safety protocols."}
        </Text>

        {item.status === "pending" ? (
          <TouchableOpacity
            style={[styles.btn, styles.acceptBtn]}
            onPress={() => acceptMission(requestId)}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnText}>Accept Mission</Text>}
          </TouchableOpacity>
        ) : null}

        {item.status === "accepted" ? (
          <View style={styles.actionStack}>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.progressBtn]}
                onPress={() => changeStatus(item._id, "in_progress")}
                disabled={busy}
              >
                <Text style={styles.btnText}>Mark In Progress</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.completeBtn]}
                onPress={() => changeStatus(item._id, "completed")}
                disabled={busy}
              >
                <Text style={styles.btnText}>Complete Mission</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={() => changeStatus(item._id, "cancelled")}
              disabled={busy}
            >
              <Text style={styles.btnText}>Cancel Mission</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {item.status === "in_progress" ? (
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.completeBtn]}
              onPress={() => changeStatus(item._id, "completed")}
              disabled={busy}
            >
              <Text style={styles.btnText}>Complete Mission</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn]}
              onPress={() => changeStatus(item._id, "cancelled")}
              disabled={busy}
            >
              <Text style={styles.btnText}>Cancel Mission</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {["completed", "cancelled", "rejected"].includes(item.status) ? (
          <Text style={styles.closedText}>No further action required.</Text>
        ) : null}
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
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  notes: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  actionStack: {
    gap: 8,
  },
  btnRow: {
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    flex: 1,
    minHeight: 40,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    backgroundColor: Colors.success,
  },
  progressBtn: {
    backgroundColor: Colors.info,
  },
  completeBtn: {
    backgroundColor: Colors.success,
  },
  cancelBtn: {
    backgroundColor: Colors.emergency,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  closedText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
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
