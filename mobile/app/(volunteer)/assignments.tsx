import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Location from "expo-location";
import { api } from "../../src/services/api";
import { getSocket } from "../../src/services/socket";
import { trackingService } from "../../src/services/trackingService";
import { AssistanceAssignment, EmergencyRequest } from "../../src/types";
import { getApiErrorMessage } from "../../src/utils/errors";
import { toMapCoordinates, isReadableAddress } from "../../src/utils/location";
import { Colors } from "../../src/constants/colors";
import { useAuthStore } from "../../src/store/authStore";

const STATUS_COLORS: Record<string, string> = {
  pending: Colors.warning,
  accepted: Colors.info,
  in_progress: Colors.warning,
  completed: Colors.success,
  cancelled: Colors.textMuted,
  rejected: Colors.emergency,
};

export default function VolunteerAssignments() {
  const router = useRouter();
  const { user, setDutyStatus } = useAuthStore();
  const [assignments, setAssignments] = useState<AssistanceAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Volunteer Duty Status
  const [available, setAvailable] = useState<boolean>(
    user?.volunteerProfile?.availability ?? true
  );

  // Live GPS Tracking Broadcast state
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const [pinging, setPinging] = useState<boolean>(false);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const stopBroadcasting = useCallback(() => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
    setBroadcastingId(null);
    setLastPingTime(null);
  }, []);

  // Cleanup watcher when leaving screen
  useEffect(() => {
    return () => {
      stopBroadcasting();
    };
  }, [stopBroadcasting]);

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

      // Sync volunteer duty status
      api
        .get("/volunteers/profile")
        .then((res) => {
          if (res.data?.success && res.data.data?.profile) {
            setAvailable(res.data.data.profile.availability ?? false);
          }
        })
        .catch(() => {
          if (user?.volunteerProfile) {
            setAvailable(user.volunteerProfile.availability ?? false);
          }
        });

      return () => {
        socket.off("assignment_updated", refresh);
        socket.off("emergency_updated", refresh);
      };
    }, [fetchAssignments, user])
  );

  const handleToggleDuty = async (val: boolean) => {
    const prev = available;
    setAvailable(val);
    try {
      const res = await setDutyStatus(val);
      if (!res.success) {
        setAvailable(prev);
        Alert.alert(
          "Duty Status Update Failed",
          res.message || "Could not update your duty status on the server. Please check your connection."
        );
      }
    } catch {
      setAvailable(prev);
      Alert.alert(
        "Duty Status Error",
        "An unexpected error occurred while updating your duty status."
      );
    }
  };

  const toggleBroadcasting = async (emergencyId: string) => {
    if (broadcastingId === emergencyId) {
      stopBroadcasting();
      Alert.alert("GPS Broadcasting Stopped", "Live location updates have been stopped.");
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Foreground location permission is required to stream live GPS to dispatch and trusted contacts."
        );
        return;
      }

      // Stop any previous active watcher
      stopBroadcasting();
      setPinging(true);
      setBroadcastingId(emergencyId);

      // Send immediate first ping
      try {
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const speedKmH =
          cur.coords.speed && cur.coords.speed > 0 ? cur.coords.speed * 3.6 : 0;
        await trackingService.sendLocationPing(emergencyId, {
          latitude: cur.coords.latitude,
          longitude: cur.coords.longitude,
          coordinates: [cur.coords.longitude, cur.coords.latitude],
          heading: cur.coords.heading ?? 0,
          speed: Math.round(speedKmH),
        });
        setLastPingTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.warn("[GPS] Initial ping failed:", err);
      } finally {
        setPinging(false);
      }

      // Watch position every 4s or 5m of movement
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 4000,
          distanceInterval: 5,
        },
        async (loc) => {
          try {
            const speedKmH =
              loc.coords.speed && loc.coords.speed > 0 ? loc.coords.speed * 3.6 : 0;
            await trackingService.sendLocationPing(emergencyId, {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              coordinates: [loc.coords.longitude, loc.coords.latitude],
              heading: loc.coords.heading ?? 0,
              speed: Math.round(speedKmH),
            });
            setLastPingTime(new Date().toLocaleTimeString());
          } catch (err) {
            console.warn("[GPS] Streaming ping failed:", err);
          }
        }
      );

      watchSubscriptionRef.current = sub;
      Alert.alert(
        "Live GPS Active",
        "Your live location breadcrumbs and ETA are now broadcasting to the citizen and public tracking page."
      );
    } catch (error: unknown) {
      stopBroadcasting();
      Alert.alert("Failed to Start GPS Streaming", getApiErrorMessage(error, "Please try again."));
    }
  };

  const changeStatus = async (id: string, status: "in_progress" | "completed" | "cancelled") => {
    try {
      setBusyId(id);
      await api.patch(`/assignments/${id}/status`, { status });
      if (status === "completed" || status === "cancelled") {
        const targetAssignment = assignments.find((a) => a._id === id);
        const req = targetAssignment?.requestId;
        const targetEmergencyId = typeof req === "object" ? req?._id : req;
        if (targetEmergencyId && broadcastingId === targetEmergencyId) {
          stopBroadcasting();
        }
      }
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
    const mapCoords = request ? toMapCoordinates(request.location) : null;
    const isBroadcasting = broadcastingId === requestId;

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

        {/* Live ETA Banner if available */}
        {request?.eta && request.eta.durationMinutes !== undefined ? (
          <View style={styles.etaCard}>
            <Text style={styles.etaText}>
              ⏱️ <Text style={styles.etaHighlight}>~{request.eta.durationMinutes} min</Text> (
              {request.eta.distanceKm} km to emergency site)
            </Text>
          </View>
        ) : null}

        {/* Live GPS Broadcast Status */}
        {isBroadcasting ? (
          <View style={styles.broadcastingBanner}>
            <View style={styles.pulseDot} />
            <Text style={styles.broadcastingText}>
              📡 Broadcasting Live GPS ({lastPingTime ? `Ping: ${lastPingTime}` : "Connecting..."})
            </Text>
          </View>
        ) : null}

        {item.status === "pending" ? (
          <TouchableOpacity
            style={[styles.btn, styles.acceptBtn]}
            onPress={() => acceptMission(requestId)}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.btnText}>Accept Mission</Text>}
          </TouchableOpacity>
        ) : null}

        {item.status === "accepted" || item.status === "in_progress" ? (
          <View style={styles.actionStack}>
            {/* Live Navigation, Chat & GPS Broadcast Row */}
            <View style={styles.btnRow}>
              {mapCoords ? (
                <TouchableOpacity
                  style={[styles.btn, styles.mapBtn]}
                  onPress={() =>
                    router.push(
                      `/location-map?lat=${mapCoords.latitude}&lng=${mapCoords.longitude}&address=${encodeURIComponent(
                        isReadableAddress(request?.address) ? request!.address!.trim() : ""
                      )}&title=${encodeURIComponent(title)}&emergencyId=${requestId}`
                    )
                  }
                >
                  <Text style={styles.btnText}>🗺️ Map</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.btn, styles.chatBtn]}
                onPress={() => {
                  const cName = typeof request?.userId === "object" ? request.userId?.name || "" : "";
                  router.push(
                    `/chat/${requestId}?citizenName=${encodeURIComponent(cName)}`
                  );
                }}
              >
                <Text style={styles.btnText}>💬 Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  isBroadcasting ? styles.stopBroadcastBtn : styles.startBroadcastBtn,
                ]}
                onPress={() => toggleBroadcasting(requestId)}
                disabled={pinging}
              >
                {pinging ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnText}>
                    {isBroadcasting ? "🛑 Stop GPS" : "📡 Stream GPS"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Status Transition Row */}
            {item.status === "accepted" ? (
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
            ) : (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.completeBtn]}
                  onPress={() => changeStatus(item._id, "completed")}
                  disabled={busy}
                >
                  <Text style={styles.btnText}>Complete Mission</Text>
                </TouchableOpacity>
              </View>
            )}

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
      {/* Duty Status Bar */}
      <View style={[styles.dutyBar, !available && styles.dutyBarOff]}>
        <View style={styles.dutyBarLeft}>
          <View style={[styles.dutyPill, available ? styles.dutyPillOn : styles.dutyPillOff]}>
            <Text style={styles.dutyPillText}>{available ? "🟢 ON DUTY" : "⚪ OFF DUTY"}</Text>
          </View>
          <Text style={styles.dutyTitle}>
            {available ? "Receiving Dispatches" : "Auto-Dispatch Paused"}
          </Text>
        </View>
        <Switch
          value={available}
          onValueChange={handleToggleDuty}
          trackColor={{ false: "#64748B", true: "#86EFAC" }}
          thumbColor={available ? Colors.success : "#E2E8F0"}
        />
      </View>

      {!available ? (
        <View style={styles.dutyNoticeStrip}>
          <Text style={styles.dutyNoticeText}>
            ⏸️ Off Duty: You will not receive new automated dispatch alerts. Active missions can still be executed.
          </Text>
        </View>
      ) : null}

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
  etaCard: {
    backgroundColor: "rgba(49, 130, 206, 0.1)",
    borderColor: "rgba(49, 130, 206, 0.3)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  etaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  etaHighlight: {
    color: Colors.info,
    fontWeight: "800",
  },
  broadcastingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(46, 213, 115, 0.12)",
    borderColor: "#2ED573",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2ED573",
  },
  broadcastingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2ED573",
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
  mapBtn: {
    backgroundColor: "#1B3A57",
    borderColor: Colors.border,
    borderWidth: 1,
  },
  chatBtn: {
    backgroundColor: "#1B3A57",
    borderColor: Colors.info,
    borderWidth: 1,
  },
  startBroadcastBtn: {
    backgroundColor: "#2E7D32",
  },
  stopBroadcastBtn: {
    backgroundColor: "#C62828",
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
  dutyBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  dutyBarOff: {
    backgroundColor: "#1E293B",
  },
  dutyBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dutyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  dutyPillOn: {
    backgroundColor: "#14532D",
    borderColor: "#22C55E",
    borderWidth: 1,
  },
  dutyPillOff: {
    backgroundColor: "#475569",
    borderColor: "#64748B",
    borderWidth: 1,
  },
  dutyPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  dutyTitle: {
    color: "#F1F5F9",
    fontSize: 13,
    fontWeight: "600",
  },
  dutyNoticeStrip: {
    backgroundColor: "#FEF3C7",
    borderBottomColor: "#FDE68A",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dutyNoticeText: {
    color: "#92400E",
    fontSize: 11,
    lineHeight: 15,
  },
});
