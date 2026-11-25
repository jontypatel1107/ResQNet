import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { Colors } from "../src/constants/colors";

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, role, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Not logged in -> go to auth
        router.replace("/(auth)/login");
      } else {
        // Direct to corresponding role dashboard
        if (role === "admin") {
          router.replace("/(admin)/dashboard");
        } else if (role === "volunteer") {
          router.replace("/(volunteer)/dashboard");
        } else {
          router.replace("/(citizen)/dashboard");
        }
      }
    }
  }, [isAuthenticated, role, isLoading, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>SOS</Text>
        </View>
        <Text style={styles.title}>ResQNet</Text>
        <Text style={styles.subtitle}>Emergency Response Network</Text>
        <ActivityIndicator size="large" color={Colors.emergency} style={styles.spinner} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>SOS</Text>
        </View>
        <Text style={styles.title}>ResQNet</Text>
        <Text style={styles.subtitle}>Disaster Response & Emergency Network</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.emergencyButton]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={styles.emergencyButtonText}>Get Started / Login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: "space-between",
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginTop: 100,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.emergency,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  logoBadgeText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: "#A0B2C6",
    marginTop: 8,
    textAlign: "center",
  },
  spinner: {
    marginTop: 40,
  },
  actions: {
    marginBottom: 40,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  emergencyButton: {
    backgroundColor: Colors.emergency,
    shadowColor: Colors.emergency,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  emergencyButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
