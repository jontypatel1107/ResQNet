import mongoose from "mongoose";
import User from "../models/User.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { dispatchTrustedCircleAlert } from "../services/alertTrustedCircleService.js";

// GET /api/users/trusted-circle
export const getTrustedCircle = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("trustedContacts trustedCircleSettings");
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, "Trusted Circle retrieved", {
      contacts: user.trustedContacts || [],
      settings: user.trustedCircleSettings || {
        autoAlertEnabled: true,
        includeLiveLocation: true,
        notifyOnCriticalOnly: false,
        customAlertMessage: "EMERGENCY SOS: I need urgent help! My live location and situation are being tracked on ResQNet:",
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/users/trusted-contacts
export const addTrustedContact = async (req, res, next) => {
  try {
    const { name, phone, relationship, notifyOnSOS, notifyVia } = req.body;

    if (!name || !phone) {
      return sendError(res, 400, "Name and phone number are required.");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    // Limit to max 10 trusted contacts per user for abuse prevention
    if (user.trustedContacts.length >= 10) {
      return sendError(res, 400, "Maximum of 10 trusted contacts allowed per account.");
    }

    // Check for duplicate phone in user's contacts
    const cleanPhone = phone.trim().replace(/\s+/g, "");
    const duplicate = user.trustedContacts.some(
      (c) => c.phone.trim().replace(/\s+/g, "") === cleanPhone
    );
    if (duplicate) {
      return sendError(res, 409, "A trusted contact with this phone number already exists.");
    }

    user.trustedContacts.push({
      name: name.trim(),
      phone: cleanPhone,
      relationship: relationship || "Family",
      notifyOnSOS: typeof notifyOnSOS === "boolean" ? notifyOnSOS : true,
      notifyVia: Array.isArray(notifyVia) && notifyVia.length > 0 ? notifyVia : ["sms", "whatsapp"],
    });

    await user.save();

    return sendSuccess(res, 201, "Trusted contact added successfully", {
      contacts: user.trustedContacts,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/trusted-contacts/:contactId
export const updateTrustedContact = async (req, res, next) => {
  try {
    const { contactId } = req.params;
    const { name, phone, relationship, notifyOnSOS, notifyVia } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const contact = user.trustedContacts.id(contactId);
    if (!contact) {
      return sendError(res, 404, "Contact not found in your Trusted Circle");
    }

    if (name) contact.name = name.trim();
    if (phone) contact.phone = phone.trim().replace(/\s+/g, "");
    if (relationship) contact.relationship = relationship;
    if (typeof notifyOnSOS === "boolean") contact.notifyOnSOS = notifyOnSOS;
    if (Array.isArray(notifyVia)) contact.notifyVia = notifyVia;

    await user.save();

    return sendSuccess(res, 200, "Contact updated successfully", {
      contacts: user.trustedContacts,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/users/trusted-contacts/:contactId
export const deleteTrustedContact = async (req, res, next) => {
  try {
    const { contactId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    user.trustedContacts.pull({ _id: contactId });
    await user.save();

    return sendSuccess(res, 200, "Contact removed from Trusted Circle", {
      contacts: user.trustedContacts,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/users/trusted-circle/settings
export const updateTrustedCircleSettings = async (req, res, next) => {
  try {
    const { autoAlertEnabled, includeLiveLocation, notifyOnCriticalOnly, customAlertMessage } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    if (!user.trustedCircleSettings) {
      user.trustedCircleSettings = {};
    }

    if (typeof autoAlertEnabled === "boolean") {
      user.trustedCircleSettings.autoAlertEnabled = autoAlertEnabled;
    }
    if (typeof includeLiveLocation === "boolean") {
      user.trustedCircleSettings.includeLiveLocation = includeLiveLocation;
    }
    if (typeof notifyOnCriticalOnly === "boolean") {
      user.trustedCircleSettings.notifyOnCriticalOnly = notifyOnCriticalOnly;
    }
    if (typeof customAlertMessage === "string") {
      user.trustedCircleSettings.customAlertMessage = customAlertMessage.trim();
    }

    await user.save();

    return sendSuccess(res, 200, "Trusted Circle settings updated successfully", {
      settings: user.trustedCircleSettings,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/users/trusted-circle/test-alert
export const sendTestAlert = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const testEmergency = {
      _id: new mongoose.Types.ObjectId(),
      title: "ResQNet Safety Check / Test Alert",
      category: "other",
      priority: "normal",
      address: "Current Registered Base",
      location: { coordinates: [72.8777, 19.0760] }, // Default preview coordinates
      createdAt: new Date(),
    };

    const dispatchResult = await dispatchTrustedCircleAlert({
      user,
      emergency: testEmergency,
    });

    return sendSuccess(res, 200, "Test alert sent to Trusted Circle contacts", {
      dispatchResult,
    });
  } catch (error) {
    next(error);
  }
};
