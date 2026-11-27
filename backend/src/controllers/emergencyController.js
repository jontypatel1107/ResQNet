import EmergencyRequest from "../models/EmergencyRequest.js";
import AssistanceAssignment from "../models/AssistanceAssignment.js";
import VolunteerProfile from "../models/VolunteerProfile.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../config/socket.js";
import { dispatchTrustedCircleAlert } from "../services/alertTrustedCircleService.js";
import {
  scheduleAutoDispatch,
  cancelAutoDispatch,
  calculateDistanceKm,
} from "../services/emergencyService.js";
import { renderPublicTrackingHtml } from "../utils/trackingTemplate.js";

export const createEmergency = async (req, res, next) => {
  try {
    const { title, description, category, priority, latitude, longitude, address, images, deviceTelemetry } = req.body;

    const emergency = await EmergencyRequest.create({
      userId: req.user._id,
      title,
      description,
      category,
      priority: priority || "medium",
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      address: address || "",
      images: images ? images.map((img) => (typeof img === "string" ? { url: img } : img)) : [],
      deviceTelemetry: deviceTelemetry || {},
    });

    // 1. Notify volunteers and admins in real-time
    try {
      const io = getIO();
      io.to("role:volunteer").to("role:admin").emit("new_emergency", emergency);
    } catch {
      // Socket not active or standalone test
    }

    // 2. Auto-Alert Citizen's Trusted Circle (SMS / WhatsApp with live tracking link)
    let trustedCircleResult = null;
    try {
      trustedCircleResult = await dispatchTrustedCircleAlert({
        user: req.user,
        emergency,
      });
    } catch (alertErr) {
      console.error("[Emergency] Trusted Circle auto-alert error:", alertErr);
    }

    // 3. For critical emergencies, schedule Smart Auto-Dispatch timeout (60s default)
    if (emergency.priority === "critical") {
      const timeoutMs = Number(process.env.AUTO_DISPATCH_TIMEOUT_MS) || 60000;
      scheduleAutoDispatch(emergency._id, timeoutMs);
    }

    return sendSuccess(res, 201, "Emergency request created successfully", {
      emergency,
      trustedCircleResult,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyEmergencies = async (req, res, next) => {
  try {
    const emergencies = await EmergencyRequest.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return sendSuccess(res, 200, "My emergency requests", { emergencies });
  } catch (error) {
    next(error);
  }
};

export const getEmergencyById = async (req, res, next) => {
  try {
    const emergency = await EmergencyRequest.findById(req.params.id).populate("userId", "name phone email");
    if (!emergency) {
      return sendError(res, 404, "Emergency request not found");
    }

    let mission = null;
    const assignment = await AssistanceAssignment.findOne({
      requestId: emergency._id,
      status: { $in: ["accepted", "in_progress", "completed"] },
    })
      .populate("volunteerId", "name phone role profileImage")
      .sort({ acceptedAt: -1 });

    if (assignment?.volunteerId) {
      const requesterId = req.user._id.toString();
      const isOwner = emergency.userId?._id?.toString?.() === requesterId;
      const isAdmin = req.user.role === "admin";
      const isAssignedVolunteer = assignment.volunteerId._id?.toString?.() === requesterId;

      if (isOwner || isAdmin || isAssignedVolunteer) {
        const profile = await VolunteerProfile.findOne({ userId: assignment.volunteerId._id }).select(
          "skills availability serviceRadius verified location"
        );

        mission = {
          _id: assignment._id.toString(),
          status: assignment.status,
          acceptedAt: assignment.acceptedAt || null,
          completedAt: assignment.completedAt || null,
          notes: assignment.notes || "",
          volunteer: {
            id: assignment.volunteerId._id.toString(),
            name: assignment.volunteerId.name || "ResQNet volunteer",
            phone: assignment.volunteerId.phone || null,
            role: assignment.volunteerId.role || "volunteer",
            profileImage: assignment.volunteerId.profileImage || null,
            skills: profile?.skills || [],
            availability: profile?.availability ?? false,
            serviceRadius: profile?.serviceRadius ?? null,
            verified: profile?.verified ?? false,
            location: profile?.location || null,
          },
        };
      }
    }

    return sendSuccess(res, 200, "Emergency details", { emergency, mission });
  } catch (error) {
    next(error);
  }
};

export const getPublicEmergencyTrack = async (req, res, next) => {
  try {
    const { id } = req.params;
    const emergency = await EmergencyRequest.findById(id).populate("userId", "name phone");
    if (!emergency) {
      return sendError(res, 404, "Emergency tracking record not found or expired");
    }

    const assignment = await AssistanceAssignment.findOne({
      requestId: emergency._id,
      status: { $in: ["accepted", "in_progress", "completed"] },
    }).populate("volunteerId", "name phone");

    const [lng, lat] = emergency.location?.coordinates || [0, 0];

    let respLoc = null;
    if (
      emergency.responderLocation?.coordinates &&
      emergency.responderLocation.coordinates.length === 2 &&
      (emergency.responderLocation.coordinates[0] !== 0 ||
        emergency.responderLocation.coordinates[1] !== 0)
    ) {
      respLoc = {
        latitude: emergency.responderLocation.coordinates[1],
        longitude: emergency.responderLocation.coordinates[0],
        heading: emergency.responderLocation.heading || 0,
        speed: emergency.responderLocation.speed || 0,
        updatedAt: emergency.responderLocation.updatedAt,
      };
    }

    const trail = (emergency.responderTrail || []).map((pt) => ({
      coordinates: pt.coordinates,
      heading: pt.heading || 0,
      speed: pt.speed || 0,
      timestamp: pt.timestamp,
    }));

    const trackingData = {
      id: emergency._id,
      title: emergency.title,
      description: emergency.description,
      category: emergency.category,
      priority: emergency.priority,
      status: emergency.status,
      address: emergency.address,
      coordinates: { latitude: lat, longitude: lng },
      googleMapsUrl: `https://maps.google.com/?q=${lat},${lng}`,
      createdAt: emergency.createdAt,
      resolvedAt: emergency.resolvedAt,
      requester: {
        name: emergency.userId?.name || "Citizen Requester",
        phone: emergency.userId?.phone || null,
      },
      responder: assignment?.volunteerId
        ? {
            name: assignment.volunteerId.name,
            phone: assignment.volunteerId.phone,
            status: assignment.status,
          }
        : null,
      responderLocation: respLoc,
      responderTrail: trail,
      eta: emergency.eta || null,
    };

    // If accessed via a web browser (e.g. clicked via SMS/WhatsApp on a mobile device)
    if (req.headers.accept?.includes("text/html") && req.query.format !== "json") {
      return res.status(200).send(renderPublicTrackingHtml(trackingData));
    }

    return sendSuccess(res, 200, "Live emergency tracking data", { tracking: trackingData });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/emergencies/:id/location-ping
 * Record live GPS location ping from assigned responder, update breadcrumb trail, and emit socket
 */
export const pingEmergencyLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { heading = 0, speed = 0 } = req.body;
    let { latitude, longitude } = req.body;

    // Accept both { latitude, longitude } and GeoJSON-style { coordinates: [lng, lat] }
    // (the mobile GPS streamer sends the latter).
    if (
      (latitude === undefined || longitude === undefined) &&
      Array.isArray(req.body.coordinates) &&
      req.body.coordinates.length === 2
    ) {
      [longitude, latitude] = req.body.coordinates;
    }

    latitude = Number(latitude);
    longitude = Number(longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      return sendError(res, 400, "Invalid coordinates: latitude and longitude are required numbers");
    }

    const emergency = await EmergencyRequest.findById(id);
    if (!emergency) {
      return sendError(res, 404, "Emergency request not found");
    }

    // Verify authorized: either admin or the assigned volunteer
    const assignment = await AssistanceAssignment.findOne({
      requestId: emergency._id,
      ...(req.user.role === "volunteer" ? { volunteerId: req.user._id } : {}),
      status: { $in: ["accepted", "in_progress", "pending"] },
    });

    const isAssignedVolunteer =
      assignment && assignment.volunteerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isAssignedVolunteer && !isAdmin) {
      return sendError(res, 403, "Only the assigned volunteer or an admin can transmit live location pings");
    }

    const [eLon, eLat] = emergency.location?.coordinates || [0, 0];
    const distanceKm = calculateDistanceKm(eLon, eLat, longitude, latitude);

    // Compute live ETA
    let durationMinutes = 1;
    if (distanceKm > 0.05) {
      if (speed > 2) {
        durationMinutes = Math.max(1, Math.round((distanceKm / speed) * 60));
      } else {
        // Average urban emergency transit speed: 30 km/h
        durationMinutes = Math.max(1, Math.round((distanceKm / 30) * 60));
      }
    } else {
      durationMinutes = 0; // Arrived
    }

    emergency.responderLocation = {
      type: "Point",
      coordinates: [longitude, latitude],
      heading: Number(heading) || 0,
      speed: Number(speed) || 0,
      updatedAt: new Date(),
    };

    emergency.eta = {
      distanceKm: Number(distanceKm.toFixed(2)),
      durationMinutes,
      updatedAt: new Date(),
    };

    if (!emergency.responderTrail) {
      emergency.responderTrail = [];
    }
    emergency.responderTrail.push({
      coordinates: [longitude, latitude],
      heading: Number(heading) || 0,
      speed: Number(speed) || 0,
      timestamp: new Date(),
    });

    // Cap breadcrumb trail at last 100 points
    if (emergency.responderTrail.length > 100) {
      emergency.responderTrail = emergency.responderTrail.slice(-100);
    }

    await emergency.save();

    // Broadcast real-time location update to sockets
    const locationPayload = {
      emergencyId: emergency._id,
      responderLocation: {
        latitude,
        longitude,
        heading: emergency.responderLocation.heading,
        speed: emergency.responderLocation.speed,
        updatedAt: emergency.responderLocation.updatedAt,
      },
      eta: emergency.eta,
      trailPoint: {
        coordinates: [longitude, latitude],
        timestamp: new Date(),
      },
    };

    try {
      const io = getIO();
      io.emit("location_update", locationPayload);
      io.to(`emergency:${emergency._id}`).emit("location_update", locationPayload);
      io.to(`user:${emergency.userId}`).emit("location_update", locationPayload);
    } catch {}

    return sendSuccess(res, 200, "Location ping recorded", {
      responderLocation: emergency.responderLocation,
      eta: emergency.eta,
      trailCount: emergency.responderTrail.length,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelEmergency = async (req, res, next) => {
  try {
    const emergency = await EmergencyRequest.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!emergency) {
      return sendError(res, 404, "Emergency not found or unauthorized");
    }

    emergency.status = "cancelled";
    await emergency.save();
    cancelAutoDispatch(emergency._id);

    return sendSuccess(res, 200, "Emergency cancelled", { emergency });
  } catch (error) {
    next(error);
  }
};
