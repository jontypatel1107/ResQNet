import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { api } from "../../src/services/api";
import { addToSyncQueue } from "../../src/database/sync";
import { getCachedTrustedContacts } from "../../src/database/sqlite";
import { isOnline } from "../../src/services/connectivity";
import { getApiErrorMessage, isNetworkError } from "../../src/utils/errors";
import { formatGeocodedAddress } from "../../src/utils/location";
import { Colors } from "../../src/constants/colors";
import { getTrustedCircle } from "../../src/services/trustedCircleService";
import { TrustedContact, TrustedCircleSettings } from "../../src/types";
import { useAuthStore } from "../../src/store/authStore";
import { formatSosSms, dispatchSmsSos } from "../../src/services/smsFallbackService";
import * as Battery from "expo-battery";
import NetInfo from "@react-native-community/netinfo";

const CATEGORIES = [
  { id: "medical", label: "Medical Aid", icon: "🚑" },
  { id: "rescue", label: "Rescue", icon: "🛶" },
  { id: "food", label: "Food Rations", icon: "🍲" },
  { id: "water", label: "Clean Water", icon: "💧" },
  { id: "transportation", label: "Evacuation Transport", icon: "🚐" },
  { id: "other", label: "Other Urgency", icon: "🆘" },
];

const PRIORITIES = ["critical", "high", "medium", "normal"] as const;

export default function CreateEmergency() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("medical");
  const [priority, setPriority] = useState<"critical" | "high" | "medium" | "normal">("high");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);

  // Trusted Circle State
  const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([]);
  const [trustedSettings, setTrustedSettings] = useState<TrustedCircleSettings | null>(null);

  const { user } = useAuthStore();
  const [isOffline, setIsOffline] = useState(false);

  // SMS Fallback State
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsPreviewText, setSmsPreviewText] = useState("");
  const [smsRecipients, setSmsRecipients] = useState<string[]>([]);
  const [dispatchingSms, setDispatchingSms] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });
    NetInfo.fetch().then((state) => {
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenSmsPreview = async () => {
    let batteryLevel: number | null = null;
    try {
      const b = await Battery.getBatteryLevelAsync();
      if (b >= 0) batteryLevel = Math.round(b * 100);
    } catch {}

    let contactsToUse = trustedContacts;
    if (contactsToUse.length === 0) {
      contactsToUse = await getCachedTrustedContacts();
      if (contactsToUse.length === 0 && user?.trustedContacts) {
        contactsToUse = user.trustedContacts;
      }
      if (contactsToUse.length > 0) {
        setTrustedContacts(contactsToUse);
      }
    }

    const activeRecipients = contactsToUse
      .filter((c) => c.notifyOnSOS !== false && c.phone)
      .map((c) => c.phone);

    const defaultTitle = `${
      CATEGORIES.find((c) => c.id === category)?.label || "Emergency"
    } SOS`;

    const preview = formatSosSms({
      title: title.trim() || defaultTitle,
      description: description.trim(),
      category,
      priority,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      address: address.trim(),
      senderName: user?.name,
      batteryLevel,
    });

    setSmsPreviewText(preview);
    setSmsRecipients(activeRecipients);
    setShowSmsModal(true);
  };

  const handleDispatchSms = async () => {
    try {
      setDispatchingSms(true);
      const defaultTitle = `${
        CATEGORIES.find((c) => c.id === category)?.label || "Emergency"
      } SOS`;

      const result = await dispatchSmsSos({
        title: title.trim() || defaultTitle,
        description: description.trim(),
        category,
        priority,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        address: address.trim(),
        senderName: user?.name,
        recipients: smsRecipients,
      });

      if (!result.success && result.error) {
        Alert.alert("SMS Notice", result.error);
      } else {
        setShowSmsModal(false);
      }
    } catch {
      Alert.alert("SMS Error", "Failed to launch device SMS composer.");
    } finally {
      setDispatchingSms(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      const loadCircle = async () => {
        try {
          const res = await getTrustedCircle();
          if (isMounted && res) {
            setTrustedContacts(res.contacts || []);
            setTrustedSettings(res.settings || null);
            return;
          }
        } catch {
          // Non-blocking fallback
        }
        if (isMounted && user?.trustedContacts && user.trustedContacts.length > 0) {
          setTrustedContacts(user.trustedContacts);
          if (user.trustedCircleSettings) setTrustedSettings(user.trustedCircleSettings);
        }
      };
      loadCircle();
      return () => {
        isMounted = false;
      };
    }, [user])
  );

  const fetchGPS = async () => {
    try {
      setFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to find your address.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const location = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCoords(location);

      // Reverse geocoding is native-only. If it is unavailable, keep the pin
      // and ask the user for a landmark instead of showing raw coordinates.
      let readableAddress = "";
      try {
        const results = await Location.reverseGeocodeAsync(location);
        readableAddress = formatGeocodedAddress(results[0]);
      } catch {
        readableAddress = "";
      }

      if (readableAddress) {
        setAddress(readableAddress);
      } else {
        setAddress("Current device location");
        Alert.alert(
          "Location Captured",
          "We could not resolve a street address. Please add a landmark or address so responders can find you."
        );
      }
    } catch {
      Alert.alert("GPS Error", "Failed to retrieve your location. Please enter an address manually.");
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Missing Details", "Please provide a title and incident description.");
      return;
    }

    let batteryLevel: number | null = null;
    try {
      const bLevel = await Battery.getBatteryLevelAsync();
      if (bLevel >= 0) {
        batteryLevel = Math.round(bLevel * 100);
      }
    } catch {}

    let networkStatus: string = "online";
    try {
      const netState = await NetInfo.fetch();
      networkStatus = netState.isConnected ? (netState.type || "online") : "offline";
    } catch {}

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      latitude: coords ? coords.latitude : 0.0,
      longitude: coords ? coords.longitude : 0.0,
      address,
      deviceTelemetry: {
        batteryLevel,
        networkStatus,
      },
    };

    try {
      setLoading(true);
      const res = await api.post("/emergencies", payload);
      if (res.data?.success) {
        const createdId = res.data?.data?.emergency?._id;
        const circleResult = res.data?.data?.trustedCircleResult;

        const isCircleNotified =
          (circleResult?.dispatched || circleResult?.success) &&
          (circleResult?.contactsNotified || 0) > 0;

        if (isCircleNotified) {
          Alert.alert(
            "🚨 SOS Broadcasted & Contacts Alerted!",
            `Your emergency request has been broadcasted to local volunteers.\n\n🛡️ ${circleResult.contactsNotified} contact(s) in your Trusted Circle have also been alerted via SMS/WhatsApp with live GPS tracking.`,
            [
              {
                text: "View Live Status",
                onPress: () => {
                  if (createdId) {
                    router.replace(`/emergency/${createdId}`);
                  } else {
                    router.push("/(citizen)/my-requests");
                  }
                },
              },
            ]
          );
        } else if (createdId) {
          // Move straight to the live status screen so the citizen can see PENDING.
          router.replace(`/emergency/${createdId}`);
        } else {
          Alert.alert("SOS Transmitted", "Emergency dispatch request has been logged.", [
            { text: "View Requests", onPress: () => router.push("/(citizen)/my-requests") },
          ]);
        }
      }
    } catch (error: unknown) {
      const online = await isOnline();
      const transportFailure = online ? isNetworkError(error) : true;

      if (transportFailure) {
        // Only queue when the request never reached the server.
        await addToSyncQueue("POST", "/emergencies", payload);
        Alert.alert(
          online ? "Server Unreachable · SOS Queued" : "Offline Mode · SOS Queued",
          online
            ? "Could not reach ResQNet servers. Your request is queued locally.\n\nWould you like to dispatch this SOS immediately via SMS to your emergency contacts?"
            : "No internet connection detected. Your request is queued locally.\n\nWould you like to dispatch this SOS immediately via SMS to your emergency contacts?",
          [
            {
              text: "Keep Local Only",
              style: "cancel",
              onPress: () => router.push("/(citizen)/my-requests"),
            },
            {
              text: "📲 Dispatch via SMS",
              onPress: () => void handleOpenSmsPreview(),
            },
          ]
        );
      } else {
        // The server responded with an error. Show the real reason instead of
        // pretending the device is offline.
        Alert.alert(
          "SOS Not Sent",
          getApiErrorMessage(error, "Failed to transmit the emergency request. Please try again.")
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineBannerTop}>
            <Text style={styles.offlineBannerIcon}>📶</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBannerTitle}>Offline Mode Detected</Text>
              <Text style={styles.offlineBannerSub}>
                No internet detected. ResQNet can dispatch this emergency directly via SMS text message.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.offlineBannerActionBtn}
            onPress={handleOpenSmsPreview}
            activeOpacity={0.8}
          >
            <Text style={styles.offlineBannerActionText}>📲 Quick Dispatch via SMS</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <Text style={styles.header}>Report Emergency</Text>
      <Text style={styles.subheader}>
        Provide incident information for immediate responder dispatch
      </Text>

      <Text style={styles.label}>Emergency Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.catBtn, category === c.id && styles.catBtnActive]}
            onPress={() => setCategory(c.id)}
          >
            <Text style={styles.catIcon}>{c.icon}</Text>
            <Text style={[styles.catText, category === c.id && styles.catTextActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Priority Level</Text>
      <View style={styles.priorityRow}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.priorityBtn, priority === p && styles.priorityBtnActive]}
            onPress={() => setPriority(p)}
          >
            <Text style={[styles.priorityText, priority === p && styles.priorityTextActive]}>
              {p.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Short Title / Situation</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., Flood water entering ground floor"
        placeholderTextColor="#8898AA"
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.label}>Description & Urgency</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Number of persons trapped, medical conditions, landmark details..."
        placeholderTextColor="#8898AA"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
      />

      <Text style={styles.label}>Location / Address</Text>
      <View style={styles.locationRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Enter address or landmark"
          placeholderTextColor="#8898AA"
          value={address}
          onChangeText={setAddress}
        />
        <TouchableOpacity style={styles.gpsBtn} onPress={fetchGPS} disabled={fetchingLocation}>
          {fetchingLocation ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.gpsText}>GPS 📍</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Trusted Circle Auto-Alert Status Card */}
      {(() => {
        const activeContacts = trustedContacts.filter((c) => c.notifyOnSOS !== false);
        const isAutoAlertOn = trustedSettings ? trustedSettings.autoAlertEnabled : true;
        const willAlert = isAutoAlertOn && activeContacts.length > 0;

        return (
          <TouchableOpacity
            style={[
              styles.circleCard,
              willAlert ? styles.circleCardActive : styles.circleCardInactive,
            ]}
            onPress={() => router.push("/(citizen)/trusted-circle")}
            activeOpacity={0.8}
          >
            <View style={styles.circleCardHeader}>
              <View style={styles.circleTitleRow}>
                <Text style={styles.circleIcon}>{willAlert ? "🛡️" : "⚠️"}</Text>
                <Text style={styles.circleTitle}>
                  {willAlert
                    ? `Trusted Circle: ${activeContacts.length} Contact${activeContacts.length > 1 ? "s" : ""} Alerting`
                    : activeContacts.length === 0
                    ? "Trusted Circle: No Contacts Set"
                    : "Trusted Circle: Auto-Alert Paused"}
                </Text>
              </View>
              <View
                style={[
                  styles.circleBadge,
                  { backgroundColor: willAlert ? Colors.success : "#A0AEC0" },
                ]}
              >
                <Text style={styles.circleBadgeText}>
                  {willAlert ? "ACTIVE" : "OFF"}
                </Text>
              </View>
            </View>

            <Text style={styles.circleDescription}>
              {willAlert
                ? `SMS / WhatsApp notifications with live GPS tracking will be automatically sent to your ${activeContacts.length} contact(s) upon submission.`
                : activeContacts.length === 0
                ? "Tap to add emergency contacts (family, doctors, friends) so they are automatically notified during emergencies."
                : "Auto-alerts to emergency contacts are disabled in your settings. Tap to manage preferences."}
            </Text>

            <View style={styles.circleLinkRow}>
              <Text style={styles.circleLinkText}>
                {activeContacts.length === 0 ? "+ Set Up Emergency Circle" : "Manage Contacts & Settings →"}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })()}

      <TouchableOpacity
        style={styles.submitBtn}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitBtnText}>🚨 BROADCAST EMERGENCY SOS</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.smsFallbackBtn}
        onPress={handleOpenSmsPreview}
        activeOpacity={0.8}
      >
        <Text style={styles.smsFallbackBtnIcon}>📲</Text>
        <Text style={styles.smsFallbackBtnText}>Send SOS via SMS (Offline Fallback)</Text>
      </TouchableOpacity>

      {/* Emergency SMS Preview & Dispatch Modal */}
      <Modal
        visible={showSmsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSmsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.smsModalCard}>
            <View style={styles.smsModalHeader}>
              <Text style={styles.smsModalTitle}>🚨 Emergency SMS Dispatch</Text>
              <TouchableOpacity onPress={() => setShowSmsModal(false)}>
                <Text style={styles.smsModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.smsModalSub}>
              This will launch your device&apos;s SMS composer with a pre-formatted disaster SOS payload:
            </Text>

            <View style={styles.smsPreviewBox}>
              <ScrollView style={{ maxHeight: 180 }}>
                <Text style={styles.smsPreviewText}>{smsPreviewText}</Text>
              </ScrollView>
            </View>

            <View style={styles.smsRecipientsRow}>
              <Text style={styles.smsRecipientsLabel}>
                👥 Recipients ({smsRecipients.length}):
              </Text>
              <Text style={styles.smsRecipientsValue}>
                {smsRecipients.length > 0
                  ? smsRecipients.join(", ")
                  : "Emergency Hotline / Choose in messaging app"}
              </Text>
            </View>

            <View style={styles.smsModalBtnRow}>
              <TouchableOpacity
                style={styles.smsCancelBtn}
                onPress={() => setShowSmsModal(false)}
              >
                <Text style={styles.smsCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smsLaunchBtn}
                onPress={handleDispatchSms}
                disabled={dispatchingSms}
              >
                {dispatchingSms ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.smsLaunchText}>🚀 Open SMS App</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  subheader: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    marginTop: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 14,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catBtn: {
    width: "31%",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  catBtnActive: {
    borderColor: Colors.emergency,
    backgroundColor: Colors.emergencyLight,
  },
  catIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  catText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  catTextActive: {
    color: Colors.emergency,
    fontWeight: "700",
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  priorityBtnActive: {
    borderColor: Colors.emergency,
    backgroundColor: Colors.emergency,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  priorityTextActive: {
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  locationRow: {
    flexDirection: "row",
    gap: 8,
  },
  gpsBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  gpsText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: Colors.emergency,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 28,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },
  circleCard: {
    marginTop: 20,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  circleCardActive: {
    backgroundColor: "#F0FFF4",
    borderColor: "#C6F6D5",
  },
  circleCardInactive: {
    backgroundColor: "#F7FAFC",
    borderColor: Colors.border,
  },
  circleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  circleTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  circleIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  circleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
  },
  circleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  circleBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  circleDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    lineHeight: 17,
  },
  circleLinkRow: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  circleLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  offlineBanner: {
    backgroundColor: "#FFFBEB",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  offlineBannerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  offlineBannerIcon: {
    fontSize: 22,
  },
  offlineBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#B45309",
  },
  offlineBannerSub: {
    fontSize: 12,
    color: "#92400E",
    marginTop: 2,
    lineHeight: 16,
  },
  offlineBannerActionBtn: {
    marginTop: 10,
    backgroundColor: "#D97706",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  offlineBannerActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  smsFallbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderColor: "#94A3B8",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    gap: 8,
  },
  smsFallbackBtnIcon: {
    fontSize: 18,
  },
  smsFallbackBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  smsModalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  smsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  smsModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  smsModalClose: {
    fontSize: 18,
    color: Colors.textMuted,
    padding: 4,
  },
  smsModalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  smsPreviewBox: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  smsPreviewText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#38BDF8",
    lineHeight: 18,
  },
  smsRecipientsRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  smsRecipientsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  smsRecipientsValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  smsModalBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  smsCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  smsCancelText: {
    color: Colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  smsLaunchBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  smsLaunchText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
});
