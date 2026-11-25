import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { useAuthStore } from "../../src/store/authStore";
import { Colors } from "../../src/constants/colors";

const SKILL_OPTIONS = [
  { id: "first_aid", label: "First Aid & CPR", icon: "🩹" },
  { id: "medical", label: "Paramedic / Nursing", icon: "🩺" },
  { id: "rescue", label: "Search & Evacuation", icon: "🛶" },
  { id: "driving", label: "Emergency Driving", icon: "🚐" },
  { id: "food_distribution", label: "Relief Logistics", icon: "🍲" },
  { id: "general_assistance", label: "General Volunteer", icon: "🤝" },
];

const RADIUS_OPTIONS = [5, 10, 25, 50];

export default function VolunteerProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, updateVolunteerProfile, logout } = useAuthStore();

  const volunteer = user?.volunteerProfile;

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [available, setAvailable] = useState(volunteer?.availability ?? true);
  const [skills, setSkills] = useState<string[]>(
    volunteer?.skills && volunteer.skills.length > 0
      ? (volunteer.skills as string[])
      : ["general_assistance"]
  );
  const [serviceRadius, setServiceRadius] = useState<number>(volunteer?.serviceRadius || 10);
  const [saving, setSaving] = useState(false);
  const [calibratingGPS, setCalibratingGPS] = useState(false);

  const toggleSkill = (skillId: string) => {
    if (skills.includes(skillId)) {
      if (skills.length > 1) {
        setSkills(skills.filter((s) => s !== skillId));
      }
    } else {
      setSkills([...skills, skillId]);
    }
  };

  const handleCalibrateGPS = async () => {
    try {
      setCalibratingGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "GPS permission is required to calibrate dispatch location.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      await updateVolunteerProfile({
        location: {
          type: "Point",
          coordinates: [loc.coords.longitude, loc.coords.latitude],
        },
      });
      Alert.alert(
        "GPS Calibrated",
        `Dispatch base coordinates updated: ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`
      );
    } catch {
      Alert.alert("GPS Error", "Failed to retrieve position.");
    } finally {
      setCalibratingGPS(false);
    }
  };

  const handleSaveVolunteerSettings = async () => {
    setSaving(true);
    await updateProfile({ name: name.trim(), phone: phone.trim() });
    const res = await updateVolunteerProfile({
      availability: available,
      skills: skills as any,
      serviceRadius,
    });
    setSaving(false);

    if (res.success) {
      Alert.alert("Saved", "Volunteer duty settings updated.");
    } else {
      Alert.alert("Error", res.message || "Could not save settings.");
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name ? name[0].toUpperCase() : "V"}</Text>
        </View>
        <Text style={styles.userName}>{name || "Volunteer"}</Text>
        <Text style={styles.userEmail}>{user?.email || "No email"}</Text>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, volunteer?.verified ? styles.verifiedBadge : styles.pendingBadge]}>
            <Text style={styles.badgeText}>
              {volunteer?.verified ? "✓ VERIFIED RESPONDER" : "⏳ VERIFICATION PENDING"}
            </Text>
          </View>
        </View>
      </View>

      {/* Duty Readiness Switch Card */}
      <View style={styles.dutyCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dutyTitle}>Emergency Readiness</Text>
          <Text style={styles.dutySub}>
            {available
              ? "Available to receive incoming emergency dispatches"
              : "Off-duty (incidents will not trigger notifications)"}
          </Text>
        </View>
        <Switch
          value={available}
          onValueChange={setAvailable}
          trackColor={{ false: "#CBD5E0", true: "#68D391" }}
          thumbColor={available ? Colors.success : "#A0AEC0"}
        />
      </View>

      {/* Skills Picker Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Certified Relief Competencies</Text>
        <Text style={styles.cardSub}>Select the skills you are equipped to perform in the field:</Text>

        <View style={styles.skillsGrid}>
          {SKILL_OPTIONS.map((s) => {
            const isSelected = skills.includes(s.id);
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.skillChip, isSelected && styles.skillChipActive]}
                onPress={() => toggleSkill(s.id)}
              >
                <Text style={styles.skillIcon}>{s.icon}</Text>
                <Text style={[styles.skillText, isSelected && styles.skillTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Dispatch Radius & GPS Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Operational Dispatch Radius</Text>
        <Text style={styles.cardSub}>Maximum response distance for incident radar:</Text>

        <View style={styles.radiusRow}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusBtn, serviceRadius === r && styles.radiusBtnActive]}
              onPress={() => setServiceRadius(r)}
            >
              <Text style={[styles.radiusText, serviceRadius === r && styles.radiusTextActive]}>
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.gpsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.gpsTitle}>Base Dispatch Location</Text>
            <Text style={styles.gpsCoords}>
              {volunteer?.location?.coordinates
                ? `Lng: ${volunteer.location.coordinates[0].toFixed(3)}, Lat: ${volunteer.location.coordinates[1].toFixed(3)}`
                : "Using device GPS automatically"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.gpsBtn}
            onPress={handleCalibrateGPS}
            disabled={calibratingGPS}
          >
            {calibratingGPS ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.gpsBtnText}>📍 Calibrate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Responder Contact Details</Text>
        <Text style={styles.label}>Full Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Emergency Mobile Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={styles.saveBtn}
        onPress={handleSaveVolunteerSettings}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveBtnText}>Update Volunteer Profile</Text>
        )}
      </TouchableOpacity>

      {/* Logout Button */}
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
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  verifiedBadge: {
    backgroundColor: Colors.success,
  },
  pendingBadge: {
    backgroundColor: Colors.warning,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dutyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  dutyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  dutySub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    paddingRight: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  cardSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 12,
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillChip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
    gap: 6,
  },
  skillChipActive: {
    borderColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  skillIcon: {
    fontSize: 14,
  },
  skillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  skillTextActive: {
    color: Colors.successDark,
    fontWeight: "700",
  },
  radiusRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  radiusBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  radiusBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  radiusText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  radiusTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gpsTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  gpsCoords: {
    fontSize: 11,
    color: Colors.info,
    fontWeight: "600",
    marginTop: 2,
  },
  gpsBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gpsBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  saveBtn: {
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  logoutBtn: {
    marginTop: 12,
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#FED7D7",
  },
  logoutText: {
    color: Colors.emergencyDark,
    fontSize: 15,
    fontWeight: "700",
  },
});
