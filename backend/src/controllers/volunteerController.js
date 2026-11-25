import VolunteerProfile from "../models/VolunteerProfile.js";
import EmergencyRequest from "../models/EmergencyRequest.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getVolunteerProfile = async (req, res, next) => {
  try {
    const profile = await VolunteerProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return sendError(res, 404, "Volunteer profile not found");
    }
    return sendSuccess(res, 200, "Volunteer profile", { profile });
  } catch (error) {
    next(error);
  }
};

export const updateVolunteerStatus = async (req, res, next) => {
  try {
    const { availability, serviceRadius, skills, coordinates } = req.body;
    const updateData = {};

    if (typeof availability === "boolean") updateData.availability = availability;
    if (serviceRadius) updateData.serviceRadius = serviceRadius;
    if (skills) updateData.skills = skills;
    if (coordinates && coordinates.length === 2) {
      updateData.location = {
        type: "Point",
        coordinates,
      };
    }

    const profile = await VolunteerProfile.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return sendSuccess(res, 200, "Volunteer profile updated", { profile });
  } catch (error) {
    next(error);
  }
};

export const getNearbyRequests = async (req, res, next) => {
  try {
    const { lng, lat, maxDistance = 20 } = req.query;

    if (!lng || !lat) {
      // If coordinates not supplied in query, return open pending requests
      const emergencies = await EmergencyRequest.find({
        status: { $in: ["pending", "assigned"] },
      }).sort({ priority: -1, createdAt: -1 });

      return sendSuccess(res, 200, "Nearby emergency requests", { emergencies });
    }

    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    const maxMeters = parseFloat(maxDistance) * 1000;

    const emergencies = await EmergencyRequest.find({
      status: { $in: ["pending", "assigned"] },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxMeters,
        },
      },
    }).limit(50);

    return sendSuccess(res, 200, "Nearby emergency requests", { emergencies });
  } catch (error) {
    next(error);
  }
};
