import Hazard from "../models/Hazard.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../config/socket.js";

/**
 * POST /api/hazards
 * Report a new road blockage or disaster hazard
 */
export const reportHazard = async (req, res, next) => {
  try {
    const {
      type = "flooded_road",
      title,
      description = "",
      severity = "high",
      coordinates,
      latitude,
      longitude,
      address = "",
    } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return sendError(res, 400, "Hazard title or description is required");
    }

    let coords = null;
    if (Array.isArray(coordinates) && coordinates.length === 2) {
      coords = [Number(coordinates[0]), Number(coordinates[1])];
    } else if (latitude !== undefined && longitude !== undefined) {
      coords = [Number(longitude), Number(latitude)];
    }

    if (!coords || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
      return sendError(res, 400, "Valid GPS coordinates [longitude, latitude] are required");
    }

    const validTypes = [
      "flooded_road",
      "downed_powerline",
      "fallen_tree",
      "collapsed_structure",
      "gas_leak",
      "landslide",
      "other",
    ];
    const hazardType = validTypes.includes(type) ? type : "other";

    const validSeverities = ["low", "medium", "high", "critical"];
    const hazardSeverity = validSeverities.includes(severity) ? severity : "high";

    const hazard = await Hazard.create({
      type: hazardType,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      severity: hazardSeverity,
      status: "active",
      location: {
        type: "Point",
        coordinates: coords,
      },
      address: typeof address === "string" ? address.trim() : "",
      reportedBy: req.user._id,
      reporterName: req.user.name || "Citizen Responder",
    });

    // Real-time broadcast to all connected responders and citizens
    try {
      const io = getIO();
      io.emit("hazard_reported", hazard);
    } catch (socketErr) {
      console.warn("[HazardController] Socket broadcast skipped:", socketErr.message);
    }

    return sendSuccess(res, 201, "Hazard reported successfully", { hazard });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/hazards
 * Query active or nearby hazards
 */
export const getHazards = async (req, res, next) => {
  try {
    const { lat, lng, radius = 25, status = "active" } = req.query;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusMeters = parseFloat(radius) * 1000;

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        query.location = {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusMeters,
          },
        };
      }
    }

    const hazards = await Hazard.find(query)
      .populate("reportedBy", "name role")
      .populate("clearedBy", "name role")
      .sort(query.location ? undefined : { createdAt: -1 })
      .limit(60);

    return sendSuccess(res, 200, "Hazards retrieved", { hazards });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/hazards/:id/clear
 * Mark hazard as resolved/cleared (Volunteers, Admins, or Reporter)
 */
export const clearHazard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes = "" } = req.body;

    const hazard = await Hazard.findById(id);
    if (!hazard) {
      return sendError(res, 404, "Hazard report not found");
    }

    const isReporter = hazard.reportedBy?.toString() === req.user._id.toString();
    const isVolunteerOrAdmin = ["volunteer", "admin"].includes(req.user.role);

    if (!isReporter && !isVolunteerOrAdmin) {
      return sendError(res, 403, "You are not authorized to clear this hazard report");
    }

    hazard.status = "cleared";
    hazard.clearedBy = req.user._id;
    hazard.clearedAt = new Date();
    hazard.clearedNotes = typeof notes === "string" ? notes.trim() : "";
    await hazard.save();

    // Broadcast clear event to all clients
    try {
      const io = getIO();
      io.emit("hazard_cleared", {
        hazardId: hazard._id,
        status: "cleared",
        clearedAt: hazard.clearedAt,
        clearedByName: req.user.name,
      });
    } catch (socketErr) {
      console.warn("[HazardController] Socket broadcast skipped:", socketErr.message);
    }

    return sendSuccess(res, 200, "Hazard marked as cleared", { hazard });
  } catch (error) {
    next(error);
  }
};
