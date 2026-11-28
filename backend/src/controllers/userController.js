import User from "../models/User.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { dispatchSafetyCheckInAlert } from "../services/alertTrustedCircleService.js";

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, 200, "Profile retrieved", { user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name, phone } },
      { new: true, runValidators: true }
    );
    return sendSuccess(res, 200, "Profile updated successfully", { user });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/users/safety-checkin
 * Record 1-tap disaster safety status ("I Am Safe") and notify trusted circle
 */
export const recordSafetyCheckIn = async (req, res, next) => {
  try {
    const { status = "safe", address = "", coordinates, note = "", notifyCircle = true } = req.body;

    const validStatuses = ["safe", "in_danger", "needs_assistance"];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, "Invalid safety status");
    }

    let parsedCoords = null;
    if (Array.isArray(coordinates) && coordinates.length === 2) {
      const [lng, lat] = coordinates.map(Number);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        parsedCoords = [lng, lat];
      }
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    user.safetyStatus = {
      status,
      lastCheckIn: new Date(),
      address: typeof address === "string" ? address.trim() : "",
      coordinates: parsedCoords,
      note: typeof note === "string" ? note.trim().slice(0, 300) : "",
    };

    await user.save();

    let circleResult = null;
    if (notifyCircle && user.trustedContacts?.length > 0) {
      try {
        circleResult = await dispatchSafetyCheckInAlert({
          user,
          status,
          address: user.safetyStatus.address,
          coordinates: parsedCoords,
          note: user.safetyStatus.note,
        });
      } catch (err) {
        console.warn("[SafetyCheckIn] Failed to notify trusted circle:", err);
      }
    }

    return sendSuccess(res, 200, "Safety check-in recorded successfully", {
      safetyStatus: user.safetyStatus,
      circleResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/safety-status
 * Retrieve user's current safety status
 */
export const getMySafetyStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("safetyStatus");
    return sendSuccess(res, 200, "Current safety status", {
      safetyStatus: user?.safetyStatus || { status: "unknown", lastCheckIn: null },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/public-safety-status?phone=...
 * Public lookup: family members can search for a loved one's safe status without logging in
 */
export const getPublicSafetyStatus = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone || typeof phone !== "string") {
      return sendError(res, 400, "Phone number query parameter is required");
    }

    const rawDigits = phone.replace(/\D/g, "");
    if (!rawDigits || rawDigits.length < 5) {
      return sendError(res, 400, "Invalid phone number format");
    }

    // Match digits allowing any spaces, hyphens, parentheses, or dots between digits
    const coreDigits = rawDigits.length > 10 ? rawDigits.slice(-10) : rawDigits;
    const regexPattern = coreDigits.split("").join("[\\s\\-\\(\\)\\.]*");
    const flexibleRegex = new RegExp(regexPattern + "\\s*$");

    const user = await User.findOne({
      $or: [
        { phone: phone.trim() },
        { phone: flexibleRegex },
      ],
    }).select("name safetyStatus phone");

    if (!user || !user.safetyStatus?.lastCheckIn) {
      return sendSuccess(res, 200, "No check-in record found for this number", {
        found: false,
      });
    }

    return sendSuccess(res, 200, "Safety status retrieved", {
      found: true,
      name: user.name,
      status: user.safetyStatus.status,
      lastCheckIn: user.safetyStatus.lastCheckIn,
      address: user.safetyStatus.address,
      coordinates: user.safetyStatus.coordinates || null,
      note: user.safetyStatus.note,
    });
  } catch (error) {
    next(error);
  }
};
