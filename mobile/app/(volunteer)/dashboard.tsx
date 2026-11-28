import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { api } from "../../src/services/api";
import { Colors } from "../../src/constants/colors";

export default function VolunteerDashboard() {
  const router = useRouter();
  const { user, logout, setDutyStatus } = useAuthStore();
  const [available, setAvailable] = useState(
    user?.volunteerProfile?.availability ?? true
  );

  // Sync with user's stored or remote duty status on focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchStatus = async () => {
        try {
          const res = await api.get("/volunteers/profile");
          if (isMounted && res.data?.success && res.data.data?.profile) {
            setAvailable(res.data.data.profile.availability ?? false);
          }
        } catch {
          if (isMounted && user?.volunteerProfile) {
            setAvailable(user.volunteerProfile.availability ?? false);
          }
        }
      };
      fetchStatus();
      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const toggleAvailability = async (val: boolean) => {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Volunteer Status Card */}
      <View style={[styles.statusCard, !available && styles.statusCardOffDuty]}>
        <View style={styles.statusRow}>
          <View>
            <Text style={[styles.volunteerBadge, !available && styles.volunteerBadgeOff]}>
              First Responder · Volunteer
            </Text>
            <Text style={styles.name}>{user?.name || "Responder"}</Text>
          </View>
          <View style={[styles.badge, available ? styles.onlineBadge : styles.offlineBadge]}>
            <Text style={styles.badgeText}>{available ? "🟢 ON DUTY" : "⚪ OFF DUTY"}</Text>
          </View>
        </View>

        <View style={styles.switchContainer}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.switchLabel}>
              {available ? "Active for Emergency Dispatch" : "Duty Paused (Off-Duty)"}
            </Text>
            <Text style={styles.switchSub}>
              {available
                ? "Triage engine will route nearby SOS alerts to you"
                : "Auto-dispatch is paused. You will not receive alerts"}
            </Text>
          </View>
          <Switch
            value={available}
            onValueChange={toggleAvailability}
            trackColor={{ false: "#718096", true: "#68D391" }}
            thumbColor={available ? Colors.success : "#E2E8F0"}
          />
        </View>
      </View>

      {/* Off-Duty Notice Alert if inactive */}
      {!available ? (
        <View style={styles.offDutyNotice}>
          <Text style={styles.offDutyNoticeIcon}>⏸️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.offDutyNoticeTitle}>You are currently Off Duty</Text>
            <Text style={styles.offDutyNoticeDesc}>
              Auto-dispatch alerts and triage notifications are paused. Flip the switch above when you are ready to respond to incidents.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Metrics Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: Colors.emergency }]}>3</Text>
          <Text style={styles.statLabel}>Pending SOS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: Colors.success }]}>1</Text>
          <Text style={styles.statLabel}>Active Mission</Text>
        </View>
      </View>

      {/* Quick Ops Links */}
      <Text style={styles.sectionTitle}>Operations</Text>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => router.push("/(volunteer)/nearby-requests")}
      >
        <Text style={styles.actionIcon}>🗺️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Explore Nearby Incidents</Text>
          <Text style={styles.actionDesc}>View incoming SOS signals within your radius</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => router.push("/(volunteer)/assignments")}
      >
        <Text style={styles.actionIcon}>📋</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionTitle}>Active Missions & Assignments</Text>
          <Text style={styles.actionDesc}>Accept or update disaster rescue tasks</Text>
        </View>
        <Text style={styles.chevron}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          await logout();
          router.replace("/(auth)/login");
        }}
      >
        <Text style={styles.logoutText}>Sign Out</Text>
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
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  statusCardOffDuty: {
    backgroundColor: "#334155",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  volunteerBadge: {
    color: "#68D391",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  volunteerBadgeOff: {
    color: "#94A3B8",
  },
  name: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onlineBadge: {
    backgroundColor: Colors.success,
  },
  offlineBadge: {
    backgroundColor: "#718096",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    marginTop: 16,
    paddingTop: 14,
  },
  switchLabel: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "700",
  },
  switchSub: {
    color: "#CBD5E1",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  offDutyNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderColor: "#94A3B8",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  offDutyNoticeIcon: {
    fontSize: 24,
  },
  offDutyNoticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
  },
  offDutyNoticeDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 15,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  actionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  logoutBtn: {
    marginTop: 24,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  logoutText: {
    color: Colors.textPrimary,
    fontWeight: "600",
  },
});
