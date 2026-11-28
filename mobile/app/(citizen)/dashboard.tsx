import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { useAuthStore } from "../../src/store/authStore";
import { safetyService } from "../../src/services/safetyService";
import { SafetyStatus, PublicSafetyResult } from "../../src/types";
import { Colors } from "../../src/constants/colors";
import { buildGoogleMapsUrl } from "../../src/utils/location";

export default function CitizenDashboard() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  // Family Safety Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<PublicSafetyResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Fetch current safety status on focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const fetchStatus = async () => {
        try {
          const status = await safetyService.getMySafetyStatus();
          if (isMounted) setSafetyStatus(status);
        } catch {}
      };
      void fetchStatus();
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const handleSafetyCheckIn = async (status: "safe" | "needs_assistance") => {
    try {
      setCheckingIn(true);

      let coordinates: [number, number] | undefined = undefined;
      let address = "";

      try {
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          coordinates = [pos.coords.longitude, pos.coords.latitude];

          const reverse = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (reverse.length > 0) {
            const r = reverse[0];
            const parts = [r.name, r.street, r.district || r.subregion, r.city].filter(Boolean);
            address = parts.join(", ");
          }
        }
      } catch (locErr) {
        console.warn("[SafetyCheckIn] Location fetch skipped:", locErr);
      }

      const res = await safetyService.recordCheckIn({
        status,
        coordinates,
        address,
        notifyCircle: true,
      });

      if (res?.safetyStatus) {
        setSafetyStatus(res.safetyStatus);
      }

      const notifiedCount = res?.circleResult?.contactsNotified || 0;
      const message =
        status === "safe"
          ? `Your status was marked as SAFE. ${
              notifiedCount > 0
                ? `Your Trusted Circle (${notifiedCount} channel/contacts) was notified with your location.`
                : "Configure your Trusted Circle to automatically send SMS/WhatsApp updates."
            }`
          : "Your status was marked as NEEDS ASSISTANCE and an alert was dispatched to your Trusted Circle.";

      Alert.alert(status === "safe" ? "🟢 Check-In Confirmed" : "🟡 Help Alert Sent", message);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Please try again.";
      Alert.alert("Check-In Error", errorMsg);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleSearchFamily = async () => {
    const clean = searchPhone.trim();
    if (!clean) {
      Alert.alert("Input Required", "Please enter a phone number to search.");
      return;
    }

    try {
      setSearching(true);
      const res = await safetyService.lookupPublicStatus(clean);
      setSearchResult(res);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Search failed. Please try again.";
      Alert.alert("Search Error", errorMsg);
    } finally {
      setSearching(false);
    }
  };

  const handleOpenInGoogleMaps = () => {
    if (!searchResult) return;
    let url = "";
    if (
      searchResult.coordinates &&
      Array.isArray(searchResult.coordinates) &&
      searchResult.coordinates.length === 2 &&
      (searchResult.coordinates[0] !== 0 || searchResult.coordinates[1] !== 0)
    ) {
      const [lng, lat] = searchResult.coordinates;
      url = buildGoogleMapsUrl({ latitude: lat, longitude: lng });
    } else if (searchResult.address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchResult.address)}`;
    }

    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert("Map Error", "Unable to open Google Maps.");
      });
    } else {
      Alert.alert("No Location", "No location coordinates or address recorded for this check-in.");
    }
  };

  const isSafe = safetyStatus?.status === "safe";
  const needsHelp = safetyStatus?.status === "needs_assistance";

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

      {/* 1-Tap Disaster Safety Check-In Card */}
      <View style={[styles.safetyCard, isSafe && styles.safetyCardSafe]}>
        <View style={styles.safetyHeaderRow}>
          <View style={styles.safetyStatusLeft}>
            <Text style={styles.safetyCardTitle}>Disaster Safety Check-In</Text>
            <Text style={styles.safetyStatusSub}>
              {isSafe && safetyStatus?.lastCheckIn
                ? `🟢 Marked SAFE · ${new Date(safetyStatus.lastCheckIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : needsHelp && safetyStatus?.lastCheckIn
                ? `🟡 NEEDS ASSISTANCE · ${new Date(safetyStatus.lastCheckIn).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Broadcast your safe status to your family & Trusted Circle"}
            </Text>
            {safetyStatus?.address ? (
              <Text style={styles.safetyLocationText} numberOfLines={1}>
                📍 {safetyStatus.address}
              </Text>
            ) : null}
          </View>
          <View
            style={[
              styles.statusPill,
              isSafe ? styles.safePill : needsHelp ? styles.needsHelpPill : styles.unknownPill,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                isSafe
                  ? styles.safePillText
                  : needsHelp
                  ? styles.needsHelpPillText
                  : styles.unknownPillText,
              ]}
            >
              {isSafe ? "I AM SAFE" : needsHelp ? "NEEDS AID" : "UNCONFIRMED"}
            </Text>
          </View>
        </View>

        <View style={styles.safetyActionRow}>
          <TouchableOpacity
            style={[styles.safeCheckinBtn, checkingIn && styles.safeCheckinBtnDisabled]}
            activeOpacity={0.8}
            onPress={() => handleSafetyCheckIn("safe")}
            disabled={checkingIn}
          >
            {checkingIn ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.safeCheckinBtnText}>🟢 I Am Safe</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.needHelpCheckinBtn, checkingIn && styles.safeCheckinBtnDisabled]}
            activeOpacity={0.8}
            onPress={() => handleSafetyCheckIn("needs_assistance")}
            disabled={checkingIn}
          >
            <Text style={styles.needHelpCheckinBtnText}>🟡 Need Help</Text>
          </TouchableOpacity>
        </View>
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

      {/* Family Safety Finder (Expandable) */}
      <View style={styles.searchSection}>
        <TouchableOpacity
          style={styles.searchToggleHeader}
          onPress={() => setShowSearch((prev) => !prev)}
        >
          <Text style={styles.searchToggleTitle}>🔎 Search Family Safety Status</Text>
          <Text style={styles.searchToggleArrow}>{showSearch ? "▲" : "▼"}</Text>
        </TouchableOpacity>

        {showSearch ? (
          <View style={styles.searchBody}>
            <Text style={styles.searchSub}>
              Enter a relative or friend&apos;s phone number to check their safe check-in record:
            </Text>
            <View style={styles.searchInputRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="e.g. +919876543210"
                placeholderTextColor={Colors.textMuted}
                value={searchPhone}
                onChangeText={setSearchPhone}
                keyboardType="phone-pad"
              />
              <TouchableOpacity
                style={[styles.searchBtn, searching && styles.searchBtnDisabled]}
                onPress={handleSearchFamily}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchBtnText}>Search</Text>
                )}
              </TouchableOpacity>
            </View>

            {searchResult ? (
              <View
                style={[
                  styles.resultCard,
                  searchResult.found ? styles.resultCardFound : styles.resultCardMissing,
                ]}
              >
                {searchResult.found ? (
                  <>
                    <View style={styles.resultHeader}>
                      <Text style={styles.resultName}>{searchResult.name}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          searchResult.status === "safe" ? styles.safePill : styles.needsHelpPill,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            searchResult.status === "safe"
                              ? styles.safePillText
                              : styles.needsHelpPillText,
                          ]}
                        >
                          {searchResult.status === "safe" ? "SAFE" : "NEEDS AID"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.resultMeta}>
                      🕒 Checked In:{" "}
                      {searchResult.lastCheckIn
                        ? new Date(searchResult.lastCheckIn).toLocaleString()
                        : "Recently"}
                    </Text>
                    {searchResult.address ? (
                      <Text style={styles.resultMeta}>📍 Location: {searchResult.address}</Text>
                    ) : null}
                    {searchResult.note ? (
                      <Text style={styles.resultNote}>Note: {searchResult.note}</Text>
                    ) : null}
                    {searchResult.address || (searchResult.coordinates && searchResult.coordinates.length === 2) ? (
                      <TouchableOpacity
                        style={styles.openMapsBtn}
                        onPress={handleOpenInGoogleMaps}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.openMapsBtnIcon}>📍</Text>
                        <Text style={styles.openMapsBtnText}>Open in Google Maps</Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.resultMissingText}>
                    ⚪ No safety check-in record found for this number yet.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

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
    marginBottom: 16,
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
  safetyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  safetyCardSafe: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  safetyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  safetyStatusLeft: {
    flex: 1,
  },
  safetyCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  safetyStatusSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  safetyLocationText: {
    fontSize: 11,
    color: Colors.info,
    marginTop: 2,
    fontWeight: "600",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  safePill: {
    backgroundColor: "#DCFCE7",
  },
  safePillText: {
    color: "#15803D",
    fontSize: 10,
    fontWeight: "800",
  },
  needsHelpPill: {
    backgroundColor: "#FEF3C7",
  },
  needsHelpPillText: {
    color: "#B45309",
    fontSize: 10,
    fontWeight: "800",
  },
  unknownPill: {
    backgroundColor: "#F1F5F9",
  },
  unknownPillText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  safetyActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  safeCheckinBtn: {
    flex: 2,
    backgroundColor: "#16A34A",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  safeCheckinBtnDisabled: {
    opacity: 0.6,
  },
  safeCheckinBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  needHelpCheckinBtn: {
    flex: 1,
    backgroundColor: "#D97706",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  needHelpCheckinBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  sosButton: {
    backgroundColor: Colors.emergencyLight,
    borderWidth: 3,
    borderColor: Colors.emergency,
    borderRadius: 24,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
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
  searchSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    overflow: "hidden",
  },
  searchToggleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchToggleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  searchToggleArrow: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  searchBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  searchSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 16,
  },
  searchInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  searchBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  resultCard: {
    marginTop: 10,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  resultCardFound: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  resultCardMissing: {
    backgroundColor: "#F8FAFC",
    borderColor: Colors.border,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  resultName: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  resultMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultNote: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontStyle: "italic",
    marginTop: 4,
  },
  resultMissingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  openMapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1D4ED8",
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 6,
  },
  openMapsBtnIcon: {
    fontSize: 14,
  },
  openMapsBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
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
