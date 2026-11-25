import EmergencyRequest from "../models/EmergencyRequest.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../config/socket.js";

export const createEmergency = async (req, res, next) => {
  try {
    const { title, description, category, priority, latitude, longitude, address, images } = req.body;

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
    });

    // Notify volunteers in real-time
    try {
      const io = getIO();
      io.to("role:volunteer").to("role:admin").emit("new_emergency", emergency);
    } catch {
      // Socket not active or standalone test
    }

    return sendSuccess(res, 201, "Emergency request created successfully", { emergency });
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
    return sendSuccess(res, 200, "Emergency details", { emergency });
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

    return sendSuccess(res, 200, "Emergency cancelled", { emergency });
  } catch (error) {
    next(error);
  }
};
