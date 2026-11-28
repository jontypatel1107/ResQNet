import React, { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import EmergencyMapView from "../src/components/EmergencyMapView";
import { Colors } from "../src/constants/colors";
import { isReadableAddress } from "../src/utils/location";
import { trackingService } from "../src/services/trackingService";
import { hazardService } from "../src/services/hazardService";
import { getSocket } from "../src/services/socket";
import { useAuthStore } from "../src/store/authStore";
import { Hazard, HazardSeverity, HazardType } from "../src/types";

const HAZARD_TYPES: { id: HazardType; label: string; icon: string }[] = [
  { id: "flooded_road", label: "Flooded Road / Underpass", icon: "🌊" },
  { id: "downed_powerline", label: "Downed Power Line", icon: "⚡" },
  { id: "fallen_tree", label: "Fallen Tree / Roadblock", icon: "🌲" },
  { id: "collapsed_structure", label: "Collapsed Debris", icon: "🏚️" },
  { id: "gas_leak", label: "Gas Leak / Chemical", icon: "☣️" },
  { id: "landslide", label: "Landslide / Mud", icon: "🪨" },
  { id: "other", label: "General Hazard", icon: "⚠️" },
];

const SEVERITY_LEVELS: { id: HazardSeverity; label: string; color: string }[] = [
  { id: "critical", label: "Critical", color: "#DC2626" },
  { id: "high", label: "High", color: "#EA580C" },
  { id: "medium", label: "Medium", color: "#D97706" },
  { id: "low", label: "Low", color: "#CA8A04" },
];

export default function LocationMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    lat?: string;
    lng?: string;
    address?: string;
    title?: string;
    emergencyId?: string;
  }>();

  const latitude = Number(params.lat);
  const longitude = Number(params.lng);
  const hasPin =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0);

  const rawAddress = typeof params.address === "string" ? params.address : "";
  const address = isReadableAddress(rawAddress) ? rawAddress.trim() : "";
  const title =
    typeof params.title === "string" && params.title.trim()
      ? params.title.trim()
      : "Emergency Location";
  const emergencyId = params.emergencyId;
  const { user } = useAuthStore();
  const isVolunteerOrAdmin = user?.role === "volunteer" || user?.role === "admin";

  // Device location fallback for standalone view
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Hazard State
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [showHazardsList, setShowHazardsList] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [hazardType, setHazardType] = useState<HazardType>("flooded_road");
  const [hazardTitle, setHazardTitle] = useState<string>("");
  const [hazardDesc, setHazardDesc] = useState<string>("");
  const [hazardSeverity, setHazardSeverity] = useState<HazardSeverity>("high");
  const [reporting, setReporting] = useState<boolean>(false);
  const [clearingId, setClearingId] = useState<string | null>(null);

  // Map Interactive Pinning & Hazard Focusing
  const [focusedHazardCoords, setFocusedHazardCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedPinCoords, setSelectedPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);

  // Live Tracking & ETA State
  const [responderLocation, setResponderLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  } | null>(null);

  const [responderTrail, setResponderTrail] = useState<
    { coordinates: [number, number]; timestamp?: string }[]
  >([]);

  const [eta, setEta] = useState<{
    distanceKm?: number;
    durationMinutes?: number;
  } | null>(null);

  const [responderName, setResponderName] = useState<string>("Assigned Responder");

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      // Request device location if no incident pin
      if (!hasPin) {
        Location.requestForegroundPermissionsAsync().then(({ status }) => {
          if (status === "granted") {
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
              .then((pos) => {
                if (isMounted) {
                  setDeviceCoords({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  });
                }
              })
              .catch(() => {});
          }
        }).catch(() => {});
      }

      // 1. Fetch nearby road hazards
      const fetchHazards = async () => {
        try {
          const list = await hazardService.getHazards({
            lat: hasPin ? latitude : undefined,
            lng: hasPin ? longitude : undefined,
            radius: 35,
            status: "active",
          });
          if (isMounted) setHazards(list);
        } catch {
          // Non-blocking fallback
        }
      };
      void fetchHazards();

      // 2. Fetch live tracking if emergencyId exists
      const loadTracking = async () => {
        if (!emergencyId) return;
        try {
          const t = await trackingService.getTracking(emergencyId);
          if (!isMounted || !t) return;
          if (t.responderLocation?.latitude && t.responderLocation?.longitude) {
            setResponderLocation(t.responderLocation);
          }
          if (Array.isArray(t.responderTrail)) {
            setResponderTrail(t.responderTrail);
          }
          if (t.eta) {
            setEta(t.eta);
          }
          if (t.responder?.name) {
            setResponderName(t.responder.name);
          }
        } catch {
          // Non-blocking fallback
        }
      };
      void loadTracking();

      const socket = getSocket();

      const onLocationUpdate = (payload: {
        emergencyId?: string;
        responderLocation?: {
          latitude: number;
          longitude: number;
          heading?: number;
          speed?: number;
        };
        eta?: { distanceKm?: number; durationMinutes?: number };
        trailPoint?: { coordinates: [number, number]; timestamp?: string };
      }) => {
        if (payload?.emergencyId === emergencyId) {
          if (payload.responderLocation) {
            setResponderLocation(payload.responderLocation);
          }
          if (payload.eta) {
            setEta(payload.eta);
          }
          if (payload.trailPoint?.coordinates) {
            setResponderTrail((prev) => [...prev, payload.trailPoint!]);
          }
        }
      };

      const onHazardReported = (newHz: Hazard) => {
        if (newHz && newHz._id) {
          setHazards((prev) => {
            if (prev.some((h) => h._id === newHz._id)) return prev;
            return [newHz, ...prev];
          });
        }
      };

      const onHazardCleared = ({ hazardId }: { hazardId: string }) => {
        if (hazardId) {
          setHazards((prev) => prev.filter((h) => h._id !== hazardId));
        }
      };

      socket.on("location_update", onLocationUpdate);
      socket.on("hazard_reported", onHazardReported);
      socket.on("hazard_cleared", onHazardCleared);

      return () => {
        isMounted = false;
        socket.off("location_update", onLocationUpdate);
        socket.off("hazard_reported", onHazardReported);
        socket.off("hazard_cleared", onHazardCleared);
      };
    }, [emergencyId, hasPin, latitude, longitude])
  );

  const handleClearHazard = (hazardId: string) => {
    Alert.alert(
      "Clear Hazard Report",
      "Confirm that this road obstruction or hazard has been cleared and is now safe for vehicles and responders?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Cleared ✅",
          onPress: async () => {
            try {
              setClearingId(hazardId);
              await hazardService.clearHazard(hazardId, "Cleared by responder on scene");
              setHazards((prev) => prev.filter((h) => h._id !== hazardId));
              Alert.alert("Hazard Cleared", "The blockage has been marked as safe and removed from active maps.");
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Failed to clear hazard";
              Alert.alert("Error", msg);
            } finally {
              setClearingId(null);
            }
          },
        },
      ]
    );
  };

  const handleSubmitHazard = async () => {
    if (!hazardTitle.trim()) {
      Alert.alert("Title Required", "Please provide a short title or street name for this hazard.");
      return;
    }

    try {
      setReporting(true);
      // Prioritize manually tapped spot on map, then incident pin, then device GPS
      let targetLat = selectedPinCoords ? selectedPinCoords.latitude : (hasPin ? latitude : (deviceCoords?.latitude || 0));
      let targetLng = selectedPinCoords ? selectedPinCoords.longitude : (hasPin ? longitude : (deviceCoords?.longitude || 0));

      // Try reading live device GPS if not already picked
      if (!selectedPinCoords && !hasPin && (!targetLat || !targetLng)) {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            targetLat = loc.coords.latitude;
            targetLng = loc.coords.longitude;
          }
        } catch {
          // Fall back
        }
      }

      if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng) || (targetLat === 0 && targetLng === 0)) {
        // Default disaster zone fallback
        targetLat = 23.2381;
        targetLng = 72.5012;
      }

      const created = await hazardService.reportHazard({
        type: hazardType,
        title: hazardTitle.trim(),
        description: hazardDesc.trim(),
        severity: hazardSeverity,
        coordinates: [targetLng, targetLat],
        address: address || "Pinned hazard location",
      });

      setHazards((prev) => [created, ...prev]);
      setShowReportModal(false);
      setHazardTitle("");
      setHazardDesc("");
      setSelectedPinCoords(null);
      setIsPickingLocation(false);
      // Automatically fly to newly reported hazard
      setFocusedHazardCoords({ latitude: targetLat, longitude: targetLng });
      Alert.alert("Hazard Pinned ⚠️", "Road obstruction reported and pinned to all live responder maps.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to report hazard";
      Alert.alert("Submission Error", msg);
    } finally {
      setReporting(false);
    }
  };

  const activeLat = hasPin ? latitude : (deviceCoords?.latitude || 23.2381);
  const activeLng = hasPin ? longitude : (deviceCoords?.longitude || 72.5012);
  const isStandaloneHazardsMap = !emergencyId && !hasPin;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(citizen)/dashboard");
            }
          }}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isStandaloneHazardsMap ? "⚠️ Road Hazards & Blockages" : "Live Emergency Map"}
        </Text>
      </View>

      {/* Live ETA Banner (when responder is active) */}
      {responderLocation ? (
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Text style={styles.etaIcon}>🚑</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.etaHeaderLine}>
                <Text style={styles.etaLabel}>RESPONDER EN ROUTE</Text>
                <View style={styles.liveTag}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveTagText}>LIVE GPS</Text>
                </View>
              </View>
              <Text style={styles.etaMinutes}>
                {eta?.durationMinutes !== undefined
                  ? eta.durationMinutes === 0
                    ? "Arrived at SOS Scene"
                    : `~${eta.durationMinutes} mins estimated arrival`
                  : "Calculating ETA..."}
              </Text>
              <Text style={styles.etaSub}>
                {responderName} • {eta?.distanceKm !== undefined ? `${eta.distanceKm} km away` : "Moving"}
                {responderLocation.speed ? ` • ${Math.round(responderLocation.speed)} km/h` : ""}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Nearby Hazard Alert Banner */}
      {hazards.length > 0 ? (
        <TouchableOpacity
          style={styles.hazardBanner}
          onPress={() => setShowHazardsList((prev) => !prev)}
          activeOpacity={0.8}
        >
          <Text style={styles.hazardBannerIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.hazardBannerTitle}>
              {hazards.length} Road Hazard{hazards.length > 1 ? "s" : ""} Reported Nearby
            </Text>
            <Text style={styles.hazardBannerSub}>
              Flooded roads or blockages active. Tap to {showHazardsList ? "hide" : "view details"} {showHazardsList ? "▲" : "▼"}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Expandable Hazards List */}
      {showHazardsList && hazards.length > 0 ? (
        <View style={styles.hazardListCard}>
          <ScrollView style={{ maxHeight: 180 }}>
            {hazards.map((h) => {
              const hzType = HAZARD_TYPES.find((t) => t.id === h.type);
              const isClearing = clearingId === h._id;
              return (
                <TouchableOpacity
                  key={h._id}
                  style={styles.hazardItem}
                  onPress={() => {
                    if (h.location?.coordinates && h.location.coordinates.length === 2) {
                      setFocusedHazardCoords({
                        latitude: h.location.coordinates[1],
                        longitude: h.location.coordinates[0],
                      });
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.hazardItemIcon}>{hzType?.icon || "⚠️"}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.hazardItemHeader}>
                      <Text style={styles.hazardItemTitle}>{h.title}</Text>
                      <View
                        style={[
                          styles.severityBadge,
                          {
                            backgroundColor:
                              h.severity === "critical"
                                ? "#FEE2E2"
                                : h.severity === "high"
                                ? "#FFEDD5"
                                : "#FEF3C7",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.severityText,
                            {
                              color:
                                h.severity === "critical"
                                  ? "#DC2626"
                                  : h.severity === "high"
                                  ? "#EA580C"
                                  : "#D97706",
                            },
                          ]}
                        >
                          {h.severity.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {h.address ? (
                      <Text style={styles.hazardItemAddress}>📍 {h.address}</Text>
                    ) : null}
                    {h.description ? (
                      <Text style={styles.hazardItemDesc}>{h.description}</Text>
                    ) : null}

                    <View style={styles.hazardItemActionRow}>
                      <Text style={styles.locateTapHint}>🎯 Tap to locate on map</Text>
                      {/* Volunteers/Admins can mark as cleared */}
                      {isVolunteerOrAdmin ? (
                        <TouchableOpacity
                          style={styles.clearBtn}
                          onPress={() => handleClearHazard(h._id)}
                          disabled={isClearing}
                        >
                          {isClearing ? (
                            <ActivityIndicator size="small" color="#15803D" />
                          ) : (
                            <Text style={styles.clearBtnText}>✅ Mark Cleared</Text>
                          )}
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.mapWrap}>
        <EmergencyMapView
          latitude={activeLat}
          longitude={activeLng}
          title={hasPin ? title : "Your Area / Disaster Zone"}
          address={hasPin ? address : "Live Road Hazard Map"}
          responderLocation={responderLocation}
          responderTrail={responderTrail}
          responderName={responderName}
          hazards={hazards}
          showIncidentMarker={Boolean(hasPin)}
          focusedHazardCoords={focusedHazardCoords}
          selectedPinCoords={selectedPinCoords}
          onSelectMapLocation={(coords) => {
            setSelectedPinCoords(coords);
            if (isPickingLocation) {
              setIsPickingLocation(false);
              setShowReportModal(true);
            }
          }}
        />

        {isPickingLocation ? (
          <View style={styles.pickingBanner}>
            <Text style={styles.pickingText}>📍 Tap anywhere on the map to place the hazard pin</Text>
            <TouchableOpacity
              style={styles.pickingCancelBtn}
              onPress={() => setIsPickingLocation(false)}
            >
              <Text style={styles.pickingCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.details}>
        <View style={styles.detailsTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailsLabel}>
              {hasPin ? "📍 Incident Location" : "⚠️ Active Road Hazards Map"}
            </Text>
            <Text style={styles.detailsAddress}>
              {hasPin
                ? address || "Address not provided — use the red marker for coordinates."
                : `${hazards.length} hazards currently reported. Tap any marker to view details or clear blockages.`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.reportHazardBtn}
            onPress={() => setShowReportModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.reportHazardBtnIcon}>⚠️</Text>
            <Text style={styles.reportHazardBtnText}>Report Hazard</Text>
          </TouchableOpacity>
        </View>

        {responderTrail.length > 0 ? (
          <Text style={styles.trailMeta}>
            🔵 Breadcrumb Trail: {responderTrail.length} location pings tracked
          </Text>
        ) : null}
      </View>

      {/* Report Road Hazard Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowReportModal(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={styles.modalIconWrap}>
                  <Text style={styles.modalIconText}>⚠️</Text>
                </View>
                <View>
                  <Text style={styles.modalTitle}>Report Road Hazard</Text>
                  <Text style={styles.modalSubtitle}>Pin dangerous blockage for all responders</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowReportModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.modalLabel}>SELECT HAZARD TYPE</Text>
              <View style={styles.hazardTypeGrid}>
                {HAZARD_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.hazardTypeBtn,
                      hazardType === t.id && styles.hazardTypeBtnActive,
                    ]}
                    onPress={() => setHazardType(t.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.hazardTypeIcon}>{t.icon}</Text>
                    <Text
                      style={[
                        styles.hazardTypeText,
                        hazardType === t.id && styles.hazardTypeTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>SEVERITY LEVEL</Text>
              <View style={styles.severityRow}>
                {SEVERITY_LEVELS.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.severityOptionBtn,
                      hazardSeverity === s.id && {
                        backgroundColor: s.color,
                        borderColor: s.color,
                        elevation: 2,
                      },
                    ]}
                    onPress={() => setHazardSeverity(s.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.severityOptionText,
                        hazardSeverity === s.id && styles.severityOptionTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalSubHeaderRow}>
                <Text style={styles.modalLabel}>HAZARD LOCATION / TITLE *</Text>
                <TouchableOpacity
                  style={styles.chooseOnMapBtn}
                  onPress={() => {
                    setShowReportModal(false);
                    setIsPickingLocation(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chooseOnMapText}>📍 {selectedPinCoords ? "Change Map Spot" : "Pick on Map"}</Text>
                </TouchableOpacity>
              </View>

              {selectedPinCoords ? (
                <View style={styles.selectedCoordsBanner}>
                  <Text style={styles.selectedCoordsText}>
                    📍 Selected Coordinates: {selectedPinCoords.latitude.toFixed(5)}, {selectedPinCoords.longitude.toFixed(5)}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedPinCoords(null)}>
                    <Text style={styles.removeCoordsText}>Reset to GPS</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Underpass flooded 4ft near Railway Stn"
                placeholderTextColor={Colors.textMuted}
                value={hazardTitle}
                onChangeText={setHazardTitle}
              />

              <Text style={styles.modalLabel}>OBSTRUCTION DETAILS (OPTIONAL)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="e.g. Water depth, blocked lanes, downed high voltage wires..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                value={hazardDesc}
                onChangeText={setHazardDesc}
              />

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowReportModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, reporting && styles.modalSubmitBtnDisabled]}
                  onPress={handleSubmitHazard}
                  disabled={reporting}
                  activeOpacity={0.8}
                >
                  {reporting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>🚨 Pin Hazard on Map</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    paddingVertical: 6,
  },
  backText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  etaCard: {
    backgroundColor: "#EBF8FF",
    borderWidth: 1,
    borderColor: "#BEE3F8",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
    padding: 12,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  etaIcon: {
    fontSize: 28,
  },
  etaHeaderLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  etaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2B6CB0",
    letterSpacing: 0.5,
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderWidth: 1,
    borderColor: "#FEB2B2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.emergency,
  },
  liveTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.emergency,
  },
  etaMinutes: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1A365D",
  },
  etaSub: {
    fontSize: 12,
    color: "#4A5568",
    marginTop: 2,
  },
  mapWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 8,
  },
  details: {
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  detailsAddress: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  trailMeta: {
    fontSize: 11,
    color: Colors.info,
    fontWeight: "600",
    marginTop: 6,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  missingIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  missingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  missingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  detailsTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  reportHazardBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 5,
  },
  reportHazardBtnIcon: {
    fontSize: 14,
  },
  reportHazardBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  hazardBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  hazardBannerIcon: {
    fontSize: 20,
  },
  hazardBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
  },
  hazardBannerSub: {
    fontSize: 11,
    color: "#B45309",
    marginTop: 1,
  },
  hazardListCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 4,
    padding: 10,
  },
  hazardItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  hazardItemIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  hazardItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hazardItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  severityText: {
    fontSize: 9,
    fontWeight: "800",
  },
  hazardItemAddress: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  hazardItemDesc: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
    fontStyle: "italic",
  },
  hazardItemActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  locateTapHint: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2563EB",
  },
  clearBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearBtnText: {
    color: "#15803D",
    fontSize: 11,
    fontWeight: "700",
  },
  pickingBanner: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "#1E293B",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  pickingText: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  pickingCancelBtn: {
    backgroundColor: "#334155",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pickingCancelText: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },
  modalSubHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 8,
  },
  chooseOnMapBtn: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  chooseOnMapText: {
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "700",
  },
  selectedCoordsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  selectedCoordsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },
  removeCoordsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DC2626",
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 9999,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    maxHeight: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    zIndex: 10000,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  modalIconText: {
    fontSize: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "700",
  },
  modalScroll: {
    maxHeight: 460,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
  },
  hazardTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hazardTypeBtn: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  hazardTypeBtnActive: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
  },
  hazardTypeIcon: {
    fontSize: 18,
  },
  hazardTypeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  hazardTypeTextActive: {
    color: "#DC2626",
    fontWeight: "800",
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
  },
  severityOptionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  severityOptionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  severityOptionTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
  },
  modalTextArea: {
    height: 75,
    textAlignVertical: "top",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    marginBottom: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalSubmitBtnDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
