import User from "../models/User.js";
import EmergencyRequest from "../models/EmergencyRequest.js";
import IncidentReport from "../models/IncidentReport.js";
import VolunteerProfile from "../models/VolunteerProfile.js";
import AssistanceAssignment from "../models/AssistanceAssignment.js";
import { sendSuccess, sendError } from "../utils/response.js";

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
