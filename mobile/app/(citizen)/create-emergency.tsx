import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { api } from "../../src/services/api";
import { addToSyncQueue } from "../../src/database/sync";
import { isOnline } from "../../src/services/connectivity";
import { getApiErrorMessage, isNetworkError } from "../../src/utils/errors";
import { formatGeocodedAddress } from "../../src/utils/location";
import { Colors } from "../../src/constants/colors";

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

    const payload = {
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      latitude: coords ? coords.latitude : 0.0,
      longitude: coords ? coords.longitude : 0.0,
      address,
    };

    try {
      setLoading(true);
      const res = await api.post("/emergencies", payload);
      if (res.data?.success) {
        const createdId = res.data?.data?.emergency?._id;
        if (createdId) {
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
          online ? "Server Unreachable" : "Saved Offline",
          online
            ? "Could not reach the ResQNet server. Your SOS is saved locally and will sync automatically."
            : "No network detected. Your SOS has been saved locally and will auto-sync when back online.",
          [{ text: "OK", onPress: () => router.push("/(citizen)/my-requests") }]
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
});
