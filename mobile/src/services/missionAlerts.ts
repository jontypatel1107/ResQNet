import * as Notifications from "expo-notifications";
import { Alert, Platform } from "react-native";
import { MissionAcceptedPayload, UserRole } from "../types";
import { getSocket } from "./socket";

const CHANNEL_ID = "sos-updates";
let configured = false;

const configureNotifications = async () => {
  if (configured || Platform.OS === "web") return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    if (Platform.OS === "android") {
      try {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: "SOS updates",
          description: "Responder acceptance and emergency status updates",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      } catch (channelErr) {
        // In Expo Go or when NotificationsChannelsProvider is unavailable on Android,
        // ignore the channel error so the app does not crash.
        console.warn("[Notifications] Android channel setup skipped:", channelErr);
      }
    }

    configured = true;
  } catch (err) {
    console.warn("[Notifications] Configuration failed:", err);
  }
};

const requestNotificationPermission = async () => {
  if (Platform.OS === "web") return false;
  try {
    await configureNotifications();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.warn("[Notifications] Permission request skipped:", err);
    return false;
  }
};

const showMissionNotification = async (payload: MissionAcceptedPayload) => {
  if (Platform.OS === "web") return;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const responderName = payload.mission?.volunteer?.name || "A volunteer";
    const sosTitle = payload.emergency?.title || "your SOS";
    const url =
      payload.url || (payload.emergency?._id ? `/emergency/${payload.emergency._id}` : "");

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Help is on the way 🚑",
        body: `${responderName} accepted your SOS: ${sosTitle}.`,
        data: {
          event: "mission_accepted",
          emergencyId: payload.emergency?._id,
          url,
        },
      },
      trigger: null,
    });
  } catch (notifErr) {
    console.warn("[Notifications] Local notification display skipped:", notifErr);
  }
};

/** Navigate when the citizen taps the local acceptance notification. */
export const setupNotificationNavigation = (onOpen: (url: string) => void) => {
  if (Platform.OS === "web") return () => {};

  const handleResponse = (response: Notifications.NotificationResponse) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("/")) {
      onOpen(url);
    }
  };

  const initial = Notifications.getLastNotificationResponse();
  if (initial) handleResponse(initial);

  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  return () => subscription.remove();
};

/** Show acceptance updates for the signed-in citizen, regardless of active screen. */
export const watchCitizenMissionAlerts = (
  userId: string | undefined,
  role: UserRole | null | undefined,
  onOpen: (url: string) => void
) => {
  if (role !== "citizen" || !userId) return () => {};

  void configureNotifications()
    .then(() => requestNotificationPermission())
    .catch((err) => {
      console.warn("[Notifications] Initialization skipped:", err);
    });

  const socket = getSocket();
  const onMissionAccepted = (payload: MissionAcceptedPayload) => {
    if (!payload?.emergency?._id) return;

    const responderName = payload.mission?.volunteer?.name || "A volunteer";
    const sosTitle = payload.emergency.title || "your SOS";
    const url = payload.url || `/emergency/${payload.emergency._id}`;

    void showMissionNotification(payload).catch(() => {
      // Local notification failures should not block the in-app alert.
    });

    Alert.alert(
      "Help is on the way 🚑",
      `${responderName} accepted your SOS: ${sosTitle}.`,
      [
        { text: "View Details", onPress: () => onOpen(url) },
        { text: "OK", style: "cancel" },
      ]
    );
  };

  socket.on("mission_accepted", onMissionAccepted);
  return () => {
    socket.off("mission_accepted", onMissionAccepted);
  };
};
