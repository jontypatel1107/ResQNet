import { useEffect } from "react";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "../src/store/authStore";
import { startAutoSync } from "../src/services/connectivity";
import { ensureServerBaseUrl } from "../src/services/serverConfig";
import {
  setupNotificationNavigation,
  watchCitizenMissionAlerts,
} from "../src/services/missionAlerts";
import { Colors } from "../src/constants/colors";

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.role);

  useEffect(() => {
    const stopNavigation = setupNotificationNavigation((url) => router.push(url));
    return stopNavigation;
  }, []);

  useEffect(() => {
    const stopWatching = watchCitizenMissionAlerts(userId, role, (url) => router.push(url));
    return stopWatching;
  }, [userId, role]);

  useEffect(() => {
    let cancelled = false;
    let stopAutoSync: (() => void) | undefined;

    (async () => {
      // Find whichever port the backend actually bound before auth/socket setup.
      await ensureServerBaseUrl();
      if (cancelled) return;

      await initializeAuth();
      if (cancelled) return;

      stopAutoSync = startAutoSync();
    })();

    return () => {
      cancelled = true;
      stopAutoSync?.();
    };
  }, [initializeAuth]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: Colors.textWhite,
          headerTitleStyle: {
            fontWeight: "700",
          },
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(citizen)" options={{ headerShown: false }} />
        <Stack.Screen name="(volunteer)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen
          name="emergency/[id]"
          options={{
            title: "Emergency Details",
            presentation: "card",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="location-map"
          options={{
            title: "Emergency Location",
            presentation: "card",
            headerBackTitle: "Back",
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
