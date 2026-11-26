import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";
import { Colors } from "../../src/constants/colors";

export default function CitizenDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Banner */}
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeLabel}>Emergency Portal · Citizen</Text>
        <Text style={styles.userName}>Hello, {user?.name || "Citizen"}</Text>
        <Text style={styles.statusSub}>
          ResQNet active: Instant emergency response and real-time relief tracking.
        </Text>
      </View>

      {/* Massive SOS Action Button */}
      <TouchableOpacity
        style={styles.sosButton}
        activeOpacity={0.85}
        onPress={() => router.push("/(citizen)/create-emergency")}
      >
        <View style={styles.sosInnerCircle}>
          <Text style={styles.sosIcon}>🚨</Text>
          <Text style={styles.sosTitle}>SOS</Text>
          <Text style={styles.sosSubtitle}>TAP FOR IMMEDIATE HELP</Text>
        </View>
      </TouchableOpacity>

      {/* Quick Action Cards */}
      <Text style={styles.sectionTitle}>Emergency Services</Text>

      <View style={styles.grid}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/(citizen)/create-emergency")}
        >
          <Text style={styles.cardIcon}>🚑</Text>
          <Text style={styles.cardTitle}>Medical Aid</Text>
          <Text style={styles.cardDesc}>Request doctors & supplies</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/(citizen)/create-emergency")}
        >
          <Text style={styles.cardIcon}>🛶</Text>
          <Text style={styles.cardTitle}>Search & Rescue</Text>
          <Text style={styles.cardDesc}>Evacuation and safety</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/(citizen)/create-emergency")}
        >
          <Text style={styles.cardIcon}>🍲</Text>
          <Text style={styles.cardTitle}>Food & Water</Text>
          <Text style={styles.cardDesc}>Ration kits distribution</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/(citizen)/my-requests" as any)}
        >
          <Text style={styles.cardIcon}>📑</Text>
          <Text style={styles.cardTitle}>My Requests</Text>
          <Text style={styles.cardDesc}>Track active dispatches</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderColor: Colors.success, backgroundColor: "#F0FDF4" }]}
          onPress={() => router.push("/(citizen)/trusted-circle" as any)}
        >
          <Text style={styles.cardIcon}>🛡️</Text>
          <Text style={[styles.cardTitle, { color: Colors.successDark }]}>Trusted Circle</Text>
          <Text style={styles.cardDesc}>Auto-alert family & live GPS</Text>
        </TouchableOpacity>
      </View>

      {/* Logout option */}
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
  welcomeCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  welcomeLabel: {
    color: "#68D391",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 4,
  },
  statusSub: {
    color: "#A0B2C6",
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  sosButton: {
    backgroundColor: Colors.emergencyLight,
    borderWidth: 3,
    borderColor: Colors.emergency,
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  sosInnerCircle: {
    alignItems: "center",
    paddingVertical: 12,
  },
  sosIcon: {
    fontSize: 36,
  },
  sosTitle: {
    color: Colors.emergency,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 4,
  },
  sosSubtitle: {
    color: Colors.emergencyDark,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "48%",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logoutBtn: {
    marginTop: 30,
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
