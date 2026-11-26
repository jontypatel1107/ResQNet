import User from "../models/User.js";
import EmergencyRequest from "../models/EmergencyRequest.js";
import IncidentReport from "../models/IncidentReport.js";
import VolunteerProfile from "../models/VolunteerProfile.js";
import AssistanceAssignment from "../models/AssistanceAssignment.js";
import { sendSuccess, sendError } from "../utils/response.js";
import {
  scoreVolunteersForEmergency,
  autoDispatchEmergency,
  cancelAutoDispatch,
  hasPendingAutoDispatch,
} from "../services/emergencyService.js";

export const getAdminStats = async (req, res, next) => {
  try {
    const [totalUsers, totalEmergencies, activeEmergencies, activeVolunteers, totalIncidents] =
      await Promise.all([
        User.countDocuments(),
        EmergencyRequest.countDocuments(),
        EmergencyRequest.countDocuments({ status: { $in: ["pending", "assigned", "in_progress"] } }),
        VolunteerProfile.countDocuments({ availability: true }),
        IncidentReport.countDocuments(),
      ]);

    return sendSuccess(res, 200, "Admin system statistics", {
      stats: {
        totalUsers,
        totalEmergencies,
        activeEmergencies,
        activeVolunteers,
        totalIncidents,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 50 } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    return sendSuccess(res, 200, "All users", { users, total, page: parseInt(page) });
  } catch (error) {
    next(error);
  }
};

export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    // Prevent deactivating oneself
    if (user._id.toString() === req.user._id.toString()) {
      return sendError(res, 400, "You cannot deactivate your own admin account");
    }

    user.isActive = !user.isActive;
    await user.save();

    return sendSuccess(res, 200, `User ${user.isActive ? "activated" : "deactivated"} successfully`, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyVolunteer = async (req, res, next) => {
  try {
    const { id } = req.params; // volunteerProfileId or userId
    let profile = await VolunteerProfile.findOne({
      $or: [{ _id: id }, { userId: id }],
    }).populate("userId", "name email phone");

    if (!profile) {
      return sendError(res, 404, "Volunteer profile not found");
    }

    profile.verified = !profile.verified;
    await profile.save();

    return sendSuccess(res, 200, `Volunteer ${profile.verified ? "verified" : "unverified"} successfully`, {
      profile,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllEmergencies = async (req, res, next) => {
  try {
    const emergencies = await EmergencyRequest.find()
      .populate("userId", "name phone email")
      .sort({ createdAt: -1 });
    return sendSuccess(res, 200, "All emergencies", { emergencies });
  } catch (error) {
    next(error);
  }
};

export const getAllIncidents = async (req, res, next) => {
  try {
    const incidents = await IncidentReport.find()
      .populate("reportedBy", "name phone email")
      .sort({ createdAt: -1 });
    return sendSuccess(res, 200, "All incidents", { incidents });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/emergencies/triage-queue
 * Get active/pending emergencies prioritized for smart triage
 */
export const getTriageQueue = async (req, res, next) => {
  try {
    const priorityWeight = { critical: 4, high: 3, medium: 2, normal: 1 };

    const emergencies = await EmergencyRequest.find({
      status: { $in: ["pending", "assigned"] },
    })
      .populate("userId", "name phone email")
      .sort({ createdAt: -1 });

    // Sort by priority weight then creation time
    emergencies.sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      if (pDiff !== 0) return pDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const queue = emergencies.map((emg) => ({
      _id: emg._id,
      title: emg.title,
      description: emg.description,
      category: emg.category,
      priority: emg.priority,
      status: emg.status,
      address: emg.address,
      coordinates: emg.location?.coordinates || [0, 0],
      createdAt: emg.createdAt,
      user: emg.userId,
      hasPendingTimer: hasPendingAutoDispatch(emg._id),
    }));

    return sendSuccess(res, 200, "Triage queue retrieved", { queue, count: queue.length });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/emergencies/:id/triage
 * Get ranked volunteer candidate list and score breakdown for an emergency
 */
export const getEmergencyTriage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const triage = await scoreVolunteersForEmergency(id);
    const hasPendingTimer = hasPendingAutoDispatch(id);

    return sendSuccess(res, 200, "Emergency triage breakdown", {
      triage,
      hasPendingTimer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/emergencies/:id/dispatch
 * Auto-dispatch the optimal responder or manually assign a specific candidate
 */
export const dispatchEmergency = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { volunteerId, notes } = req.body;

    const result = await autoDispatchEmergency({
      emergencyId: id,
      assignedBy: req.user._id,
      preferredVolunteerId: volunteerId || null,
      notes,
    });

    if (!result.success) {
      return sendError(res, 400, result.reason || "Dispatch failed", result);
    }

    return sendSuccess(res, 200, "Responder successfully dispatched", result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/emergencies/:id/cancel-timer
 * Cancel automated timeout dispatch timer
 */
export const cancelTriageTimer = async (req, res, next) => {
  try {
    const { id } = req.params;
    cancelAutoDispatch(id);
    return sendSuccess(res, 200, "Auto-dispatch timer cancelled");
  } catch (error) {
    next(error);
  }
};
