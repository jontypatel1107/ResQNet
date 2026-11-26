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

    // Build the alert payload
    const alertMessage = [
      `🚨 RESQNET EMERGENCY ALERT 🚨`,
      `${user.name} has triggered an urgent SOS request.`,
      `Situation: ${emergency.title}`,
      `Category: ${emergency.category.toUpperCase()} | Priority: ${emergency.priority.toUpperCase()}`,
      emergency.address ? `Address: ${emergency.address}` : null,
      settings.includeLiveLocation
        ? `Live Tracking: ${trackingUrl}\nGPS Map: ${mapsUrl}`
        : null,
      settings.customAlertMessage ? `Note: "${settings.customAlertMessage}"` : null,
      `ResQNet Disaster Response Platform`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const deliveryResults = [];

    // Check if real Twilio credentials are configured
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const twilioWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
    const isTwilioConfigured = Boolean(twilioSid && twilioToken && twilioPhone);

    for (const contact of activeContacts) {
      const channels = contact.notifyVia || ["sms", "whatsapp"];
      const formattedPhone = formatPhoneForTwilio(contact.phone, twilioPhone);

      for (const channel of channels) {
        if (channel === "sms") {
          if (isTwilioConfigured) {
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
              const fromWhatsApp = twilioWhatsApp.startsWith("whatsapp:")
                ? twilioWhatsApp
                : `whatsapp:${twilioWhatsApp}`;
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
              contact: contact.name,
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
