import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

export default function RegisterScreen() {
  const router = useRouter();
  const { register, error, clearError } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"citizen" | "volunteer">("citizen");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["general_assistance"]);
  const [serviceRadius, setServiceRadius] = useState<number>(10);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState("");
  const [locating, setLocating] = useState(false);

  const toggleSkill = (skillId: string) => {
    if (selectedSkills.includes(skillId)) {
      if (selectedSkills.length > 1) {
        setSelectedSkills(selectedSkills.filter((s) => s !== skillId));
      }
    } else {
      setSelectedSkills([...selectedSkills, skillId]);
    }
  };

  const captureGPS = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch {
      // Non-fatal
    } finally {
      setLocating(false);
    }
  };

  const handleRegister = async () => {
    setClientError("");
    clearError();

    if (!name.trim() || !email.trim() || !phone.trim() || !password) {
      setClientError("Please fill in all mandatory fields.");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setClientError("Please enter a valid email address.");
      return;
    }

    if (phone.trim().replace(/\D/g, "").length < 8) {
      setClientError("Phone number must contain at least 8 digits.");
      return;
    }

    if (password.length < 6) {
      setClientError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const result = await register({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      role,
      skills: role === "volunteer" ? selectedSkills : undefined,
      serviceRadius: role === "volunteer" ? serviceRadius : undefined,
      latitude: coords ? coords.latitude : undefined,
      longitude: coords ? coords.longitude : undefined,
    });
    setSubmitting(false);

    if (result.success) {
      if (role === "volunteer") {
        router.replace("/(volunteer)/dashboard");
      } else {
        router.replace("/(citizen)/dashboard");
      }
    }
  };

  const activeError = clientError || error;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Join ResQNet</Text>
          <Text style={styles.subtitle}>Unified Emergency & Disaster Response</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Registration</Text>

          {activeError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          ) : null}

          {/* Role Selection Tabs */}
          <Text style={styles.label}>Register As</Text>
          <View style={styles.roleSelector}>
            <TouchableOpacity
              style={[styles.roleOption, role === "citizen" && styles.roleOptionActive]}
              onPress={() => setRole("citizen")}
            >
              <Text style={styles.roleIcon}>👤</Text>
              <Text
                style={[
                  styles.roleOptionText,
                  role === "citizen" && styles.roleOptionTextActive,
                ]}
              >
                Citizen
              </Text>
              <Text style={styles.roleDesc}>Request emergency help & track relief</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleOption, role === "volunteer" && styles.roleOptionActive]}
              onPress={() => {
                setRole("volunteer");
                captureGPS();
              }}
            >
              <Text style={styles.roleIcon}>🩺</Text>
              <Text
                style={[
                  styles.roleOptionText,
                  role === "volunteer" && styles.roleOptionTextActive,
                ]}
              >
                Volunteer
              </Text>
              <Text style={styles.roleDesc}>First responder & rescue operations</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="John Doe"
            placeholderTextColor="#8898AA"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setClientError("");
            }}
          />

          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="john@example.com"
            placeholderTextColor="#8898AA"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setClientError("");
            }}
          />

          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 555-0199"
            placeholderTextColor="#8898AA"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              setClientError("");
            }}
          />

          <Text style={styles.label}>Password (min. 6 characters) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Create secure password"
            placeholderTextColor="#8898AA"
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setClientError("");
            }}
          />

          {/* Conditional Volunteer Fields */}
          {role === "volunteer" ? (
            <View style={styles.volunteerSection}>
              <View style={styles.divider} />
              <Text style={styles.sectionHeader}>Volunteer Competencies & Radius</Text>
              <Text style={styles.sectionSub}>Select the emergency skills you can provide:</Text>

              <View style={styles.skillsGrid}>
                {SKILL_OPTIONS.map((s) => {
                  const isSelected = selectedSkills.includes(s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.skillChip, isSelected && styles.skillChipActive]}
                      onPress={() => toggleSkill(s.id)}
                    >
                      <Text style={styles.skillIcon}>{s.icon}</Text>
                      <Text
                        style={[
                          styles.skillText,
                          isSelected && styles.skillTextActive,
                        ]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Service Coverage Radius</Text>
              <View style={styles.radiusRow}>
                {RADIUS_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.radiusBtn,
                      serviceRadius === r && styles.radiusBtnActive,
                    ]}
                    onPress={() => setServiceRadius(r)}
                  >
                    <Text
                      style={[
                        styles.radiusText,
                        serviceRadius === r && styles.radiusTextActive,
                      ]}
                    >
                      {r} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.gpsRow}>
                <Text style={styles.gpsInfo}>
                  {coords
                    ? `Base GPS: ${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`
                    : "GPS coordinates not yet locked"}
                </Text>
                <TouchableOpacity
                  style={styles.gpsRefreshBtn}
                  onPress={captureGPS}
                  disabled={locating}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.gpsRefreshText}>📍 Detect GPS</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleRegister}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {role === "volunteer" ? "Register as Volunteer" : "Create Citizen Account"}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already registered? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    padding: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: "#A0B2C6",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.emergencyLight,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.emergencyDark,
    fontWeight: "600",
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
    marginTop: 12,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  roleOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  roleOptionActive: {
    borderColor: Colors.emergency,
    backgroundColor: Colors.emergencyLight,
  },
  roleIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  roleOptionText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  roleOptionTextActive: {
    color: Colors.emergency,
  },
  roleDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  volunteerSection: {
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    marginTop: 2,
  },
  skillsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    padding: 10,
    backgroundColor: "#EDF2F7",
    borderRadius: 10,
  },
  gpsInfo: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  gpsRefreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  gpsRefreshText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: Colors.emergency,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  footerText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  linkText: {
    color: Colors.emergency,
    fontSize: 14,
    fontWeight: "700",
  },
});
