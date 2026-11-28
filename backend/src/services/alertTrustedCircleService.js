import mongoose from "mongoose";
import { getIO } from "../config/socket.js";
import Notification from "../models/Notification.js";

/**
 * Format phone to international E.164 (+1234567890) for Twilio delivery
 */
const formatPhoneForTwilio = (phone, defaultSenderPhone = "") => {
  if (!phone) return "";
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    if (cleaned.length === 10) {
      const countryCode = defaultSenderPhone.startsWith("+1")
        ? "+1"
        : defaultSenderPhone.startsWith("+91")
        ? "+91"
        : defaultSenderPhone.startsWith("+")
        ? defaultSenderPhone.slice(0, 3)
        : "+1";
      cleaned = countryCode + cleaned;
    } else {
      cleaned = "+" + cleaned;
    }
  }
  return cleaned;
};

/**
 * Direct HTTPS dispatch to Twilio REST API (zero external npm dependencies required)
 */
const sendTwilioMessage = async ({ sid, token, from, to, body }) => {
  const authHeader = "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams();
  params.append("From", from);
  params.append("To", to);
  params.append("Body", body);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Twilio error ${res.status}: ${data.code || "unknown"}`);
  }
  return data;
};

/**
 * Dispatch emergency alerts to the user's Trusted Circle via SMS, WhatsApp, and push.
 * Respects all user consent controls (autoAlertEnabled, notifyOnCriticalOnly, includeLiveLocation).
 */
export const dispatchTrustedCircleAlert = async ({ user, emergency }) => {
  try {
    if (!user || !emergency) {
      return { success: false, reason: "Missing user or emergency data" };
    }

    const settings = user.trustedCircleSettings || {
      autoAlertEnabled: true,
      includeLiveLocation: true,
      notifyOnCriticalOnly: false,
      customAlertMessage: "EMERGENCY SOS: I need urgent help! My live location and situation are being tracked on ResQNet:",
    };

    // Consent Control Check: Is auto alert enabled?
    if (!settings.autoAlertEnabled) {
      console.log(`[TrustedCircle] Auto-alert disabled by user consent settings for ${user.email}`);
      return { success: false, reason: "Auto-alert disabled by user consent" };
    }

    // Consent Control Check: Is it restricted to critical only?
    if (settings.notifyOnCriticalOnly && emergency.priority !== "critical") {
      console.log(`[TrustedCircle] Skipped: priority is ${emergency.priority}, user opted for critical-only alerts`);
      return { success: false, reason: "Priority below critical threshold" };
    }

    // Filter active contacts who agreed to receive SOS alerts
    const activeContacts = (user.trustedContacts || []).filter(
      (c) => c.notifyOnSOS !== false && c.phone
    );

    if (activeContacts.length === 0) {
      console.log(`[TrustedCircle] No active trusted contacts configured for ${user.email}`);
      return { success: false, reason: "No active trusted contacts" };
    }

    // Prepare live tracking link & Google Maps fallback
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5000";
    const trackingUrl = `${clientUrl}/api/emergencies/track/${emergency._id}`;
    const [longitude, latitude] = emergency.location?.coordinates || [0, 0];
    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;

    const batteryLvl = emergency.deviceTelemetry?.batteryLevel;
    const netStatus = emergency.deviceTelemetry?.networkStatus;

    const telemetryParts = [];
    if (batteryLvl !== null && batteryLvl !== undefined) {
      telemetryParts.push(`🔋 Battery: ${batteryLvl}%`);
    }
    if (netStatus) {
      telemetryParts.push(`📡 Network: ${netStatus.toUpperCase()}`);
    }
    const telemetryInfo = telemetryParts.length > 0 ? telemetryParts.join(" | ") : null;

    // Build the alert payload
    const alertMessage = [
      `🚨 RESQNET EMERGENCY ALERT 🚨`,
      `${user.name} has triggered an urgent SOS request.`,
      `Situation: ${emergency.title}`,
      `Category: ${emergency.category.toUpperCase()} | Priority: ${emergency.priority.toUpperCase()}`,
      emergency.address ? `Address: ${emergency.address}` : null,
      telemetryInfo,
      settings.includeLiveLocation
        ? `Live Tracking: ${trackingUrl}\nGPS Map: ${mapsUrl}`
        : null,
      settings.customAlertMessage ? `Note: "${settings.customAlertMessage}"` : null,
      `ResQNet Disaster Response Platform`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const deliveryResults = [];

    // Check if real Twilio credentials are configured (ensuring placeholders like "your_..." don't trigger real API failures)
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const rawTwilioPhone = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER;
    const twilioPhone = rawTwilioPhone ? rawTwilioPhone.replace("whatsapp:", "").trim() : "";
    const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER
      ? process.env.TWILIO_WHATSAPP_NUMBER.replace("whatsapp:", "").trim()
      : twilioPhone;

    const isRealCredentials = Boolean(
      twilioSid &&
      twilioToken &&
      !twilioSid.toLowerCase().includes("your") &&
      !twilioToken.toLowerCase().includes("your")
    );
    const isTwilioConfigured = Boolean(isRealCredentials && (twilioPhone || twilioWhatsApp));

    for (const contact of activeContacts) {
      // Guarantee both SMS and WhatsApp channels are included for every active contact
      const rawNotifyVia = contact.notifyVia || ["sms", "whatsapp"];
      const channels = Array.from(new Set([...rawNotifyVia, "sms", "whatsapp"]));
      const formattedPhone = formatPhoneForTwilio(contact.phone, twilioPhone || twilioWhatsApp);

      for (const channel of channels) {
        if (channel === "sms") {
          if (isTwilioConfigured && twilioPhone) {
            try {
              await sendTwilioMessage({
                sid: twilioSid,
                token: twilioToken,
                from: twilioPhone,
                to: formattedPhone,
                body: alertMessage,
              });
              deliveryResults.push({
                contact: contact.name,
                phone: formattedPhone,
                channel: "sms",
                status: "sent",
                timestamp: new Date().toISOString(),
              });
            } catch (err) {
              console.error(`[TrustedCircle] Twilio SMS failed to ${formattedPhone}:`, err.message);
              deliveryResults.push({
                contact: contact.name,
                phone: formattedPhone,
                channel: "sms",
                status: "failed",
                error: err.message,
              });
            }
          } else {
            // Simulated / Mock dispatch for development & automated tests
            console.log(`\n======================================================`);
            console.log(`[TrustedCircle] 📱 DISPATCHING SMS TO: ${contact.name} (${contact.phone})`);
            console.log(alertMessage);
            console.log(`======================================================\n`);
            deliveryResults.push({
              contact: contact.name,
              phone: contact.phone,
              channel: "sms",
              status: "simulated_delivered",
              timestamp: new Date().toISOString(),
            });
          }
        }

        if (channel === "whatsapp") {
          if (isTwilioConfigured && twilioWhatsApp) {
            try {
              const fromWhatsApp = `whatsapp:${twilioWhatsApp}`;
              await sendTwilioMessage({
                sid: twilioSid,
                token: twilioToken,
                from: fromWhatsApp,
                to: `whatsapp:${formattedPhone}`,
                body: alertMessage,
              });
              deliveryResults.push({
                contact: contact.name,
                phone: formattedPhone,
                channel: "whatsapp",
                status: "sent",
                timestamp: new Date().toISOString(),
              });
            } catch (err) {
              console.error(`[TrustedCircle] Twilio WhatsApp failed to ${formattedPhone}:`, err.message);
              deliveryResults.push({
                contact: contact.name,
                phone: formattedPhone,
                channel: "whatsapp",
                status: "failed",
                error: err.message,
              });
            }
          } else {
            console.log(`\n======================================================`);
            console.log(`[TrustedCircle] 💬 DISPATCHING WHATSAPP TO: ${contact.name} (${contact.phone})`);
            console.log(alertMessage);
            console.log(`======================================================\n`);
            deliveryResults.push({
              contact: contact.phone,
              phone: contact.phone,
              channel: "whatsapp",
              status: "simulated_delivered",
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    // Create Notification record for audit and user timeline
    const relatedId =
      emergency._id && mongoose.Types.ObjectId.isValid(emergency._id)
        ? emergency._id
        : null;

    let notification = null;
    try {
      notification = await Notification.create({
        userId: user._id,
        title: "Trusted Circle Auto-Alerted",
        message: `Emergency SOS sent to ${activeContacts.length} trusted contact(s) with live tracking link.`,
        type: "alert",
        relatedId,
        data: {
          contactsNotified: activeContacts.map((c) => ({ name: c.name, phone: c.phone, relation: c.relationship })),
          trackingUrl,
          deliveries: deliveryResults,
        },
      });
    } catch (notifErr) {
      console.warn("[TrustedCircle] Notification record skipped:", notifErr.message);
    }

    // Broadcast Socket.IO event to the user's active session
    try {
      const io = getIO();
      io.to(`user:${user._id}`).emit("trusted_circle_dispatched", {
        emergencyId: emergency._id,
        contactsCount: activeContacts.length,
        notification,
      });
    } catch {}

    return {
      success: true,
      dispatched: true,
      contactsNotified: activeContacts.length,
      trackingUrl,
      deliveries: deliveryResults,
    };
  } catch (error) {
    console.error("[TrustedCircle] Dispatch error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Dispatch disaster safety check-in alert ("I Am Safe") to the user's Trusted Circle via SMS and WhatsApp.
 */
export const dispatchSafetyCheckInAlert = async ({ user, status, address, coordinates, note }) => {
  try {
    const activeContacts = (user.trustedContacts || []).filter(
      (c) => c.notifyOnSOS !== false && c.phone
    );

    if (activeContacts.length === 0) {
      return { success: false, reason: "No active trusted contacts configured" };
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const locationStr =
      address ||
      (coordinates && Array.isArray(coordinates) && coordinates.length === 2
        ? `GPS: ${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}`
        : "Location not provided");

    const statusEmoji = status === "safe" ? "🟢" : status === "needs_assistance" ? "🟡" : "🔴";
    const statusText =
      status === "safe" ? "SAFE" : status === "needs_assistance" ? "NEEDS ASSISTANCE" : "IN DANGER";

    const alertMessage = [
      `${statusEmoji} RESQNET DISASTER SAFETY CHECK-IN ${statusEmoji}`,
      `${user.name} has checked in with status: ${statusText}`,
      `Time: ${timeStr}`,
      `Location: ${locationStr}`,
      note ? `Note: "${note}"` : null,
      `ResQNet Community Safety Network`,
    ]
      .filter(Boolean)
      .join("\n");

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const fromSms = process.env.TWILIO_PHONE_NUMBER;
    const rawWa = (process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886").trim();
    const fromWa = rawWa.startsWith("whatsapp:") ? rawWa : `whatsapp:${rawWa}`;

    let smsSuccessCount = 0;
    let waSuccessCount = 0;

    for (const contact of activeContacts) {
      const e164 = formatPhoneForTwilio(contact.phone, fromSms || "");
      if (!e164) continue;

      const rawChannels =
        Array.isArray(contact.notifyVia) && contact.notifyVia.length > 0
          ? contact.notifyVia
          : ["sms", "whatsapp"];
      const channels = Array.from(new Set([...rawChannels, "whatsapp"]));

      // SMS
      if (channels.includes("sms") && sid && token && fromSms) {
        try {
          await sendTwilioMessage({ sid, token, from: fromSms, to: e164, body: alertMessage });
          smsSuccessCount++;
        } catch (err) {
          console.warn(`[SafetyCheckIn] SMS to ${e164} failed:`, err.message);
        }
      }

      // WhatsApp
      if (channels.includes("whatsapp") && sid && token && fromWa) {
        try {
          const toWa = e164.startsWith("whatsapp:") ? e164 : `whatsapp:${e164}`;
          await sendTwilioMessage({
            sid,
            token,
            from: fromWa,
            to: toWa,
            body: alertMessage,
          });
          waSuccessCount++;
          console.log(`[SafetyCheckIn] ✓ WhatsApp delivered to ${toWa}`);
        } catch (err) {
          console.warn(`[SafetyCheckIn] WhatsApp to ${e164} failed:`, err.message);
        }
      }
    }

    try {
      await Notification.create({
        userId: user._id,
        title: `Safety Check-In: ${statusText}`,
        message: `Your check-in as ${statusText} was logged and sent to ${smsSuccessCount + waSuccessCount} contact channels.`,
        type: "system",
      });
    } catch {}

    return {
      success: true,
      contactsNotified: smsSuccessCount + waSuccessCount,
      contactsCount: activeContacts.length,
    };
  } catch (error) {
    console.error("[SafetyCheckIn] Dispatch error:", error);
    return { success: false, error: error.message };
  }
};
