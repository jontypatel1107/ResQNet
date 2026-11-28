import { Linking, Platform } from "react-native";
import * as Battery from "expo-battery";

export interface SmsSosPayload {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  senderName?: string;
  recipients?: string[];
  batteryLevel?: number | null;
}

export interface SmsDispatchResult {
  success: boolean;
  message: string;
  recipients: string[];
  url?: string;
  error?: string;
}

/**
 * Formats a clean, high-density emergency SMS payload.
 * Optimized for standard 160-char SMS / multi-part emergency text.
 */
export const formatSosSms = (data: SmsSosPayload): string => {
  const parts: string[] = [];

  const catTag = (data.category || "EMERGENCY").toUpperCase();
  const prioTag = (data.priority || "HIGH").toUpperCase();
  parts.push(`[ResQNet SOS] ${catTag} - ${prioTag}`);

  if (data.senderName && data.senderName.trim()) {
    parts.push(`Citizen: ${data.senderName.trim()}`);
  }

  const hasGps =
    typeof data.latitude === "number" &&
    typeof data.longitude === "number" &&
    Number.isFinite(data.latitude) &&
    Number.isFinite(data.longitude) &&
    (data.latitude !== 0 || data.longitude !== 0);

  if (hasGps) {
    const lat = data.latitude!.toFixed(5);
    const lng = data.longitude!.toFixed(5);
    parts.push(`GPS: ${lat}, ${lng}`);
    parts.push(`Map: https://maps.google.com/?q=${lat},${lng}`);
  }

  if (data.address && data.address.trim() && data.address !== "Current device location") {
    parts.push(`Loc: ${data.address.trim()}`);
  }

  if (data.title && data.title.trim()) {
    parts.push(`Issue: ${data.title.trim()}`);
  }

  if (data.description && data.description.trim()) {
    parts.push(`Details: ${data.description.trim()}`);
  }

  if (typeof data.batteryLevel === "number" && data.batteryLevel >= 0) {
    parts.push(`Battery: ${data.batteryLevel}%`);
  }

  return parts.join("\n");
};

/**
 * Builds standard cross-platform SMS URI with optional recipients and message body.
 */
export const buildSmsUrl = (recipients: string[], body: string): string => {
  const cleanRecipients = (recipients || [])
    .map((r) => r.replace(/[^\d+]/g, "").trim())
    .filter((r) => r.length >= 3);

  const separator = Platform.OS === "ios" ? "," : ";";
  const recipientStr = cleanRecipients.join(separator);
  const encodedBody = encodeURIComponent(body);

  if (Platform.OS === "ios") {
    return recipientStr
      ? `sms:${recipientStr}&body=${encodedBody}`
      : `sms:&body=${encodedBody}`;
  }

  return recipientStr
    ? `sms:${recipientStr}?body=${encodedBody}`
    : `sms:?body=${encodedBody}`;
};

/**
 * Prepares and launches the device's native SMS application with the emergency message.
 */
export const dispatchSmsSos = async (
  payload: SmsSosPayload
): Promise<SmsDispatchResult> => {
  let battery = payload.batteryLevel;
  if (battery === undefined || battery === null) {
    try {
      const bLevel = await Battery.getBatteryLevelAsync();
      if (bLevel >= 0) {
        battery = Math.round(bLevel * 100);
      }
    } catch {
      battery = null;
    }
  }

  const message = formatSosSms({ ...payload, batteryLevel: battery });
  const recipients = (payload.recipients || [])
    .map((r) => r.replace(/[^\d+]/g, "").trim())
    .filter((r) => r.length >= 3);

  const url = buildSmsUrl(recipients, message);

  try {
    // Attempt direct openURL without canOpenURL gating.
    // On Android 11+ (API 30+), canOpenURL returns false due to package visibility
    // restrictions if queries are not declared, whereas openURL invokes the system
    // default SMS handler directly.
    await Linking.openURL(url);
    return { success: true, message, recipients, url };
  } catch (err: unknown) {
    console.warn("[SMSFallback] Full URL open failed, attempting basic sms: fallback", err);
    try {
      // Fallback: If device SMS app rejects long query params or specific format, try basic sms:
      const fallbackUrl = buildSmsUrl(recipients, "");
      await Linking.openURL(fallbackUrl);
      return { success: true, message, recipients, url: fallbackUrl };
    } catch (fallbackErr: unknown) {
      const errorMsg =
        fallbackErr instanceof Error
          ? fallbackErr.message
          : "SMS application is not available on this device.";
      return { success: false, message, recipients, error: errorMsg };
    }
  }
};
