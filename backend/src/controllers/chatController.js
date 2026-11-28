import ChatMessage from "../models/ChatMessage.js";
import EmergencyRequest from "../models/EmergencyRequest.js";
import AssistanceAssignment from "../models/AssistanceAssignment.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../config/socket.js";

/**
 * Helper to verify that the requesting user is authorized to participate in this emergency chat:
 * - The citizen who created the emergency
 * - The volunteer assigned to the emergency
 * - An admin
 */
const verifyChatAccess = async (emergencyId, user) => {
  const emergency = await EmergencyRequest.findById(emergencyId).populate(
    "userId",
    "name phone"
  );
  if (!emergency) {
    return { error: { status: 404, message: "Emergency request not found" } };
  }

  const assignment = await AssistanceAssignment.findOne({
    requestId: emergency._id,
    status: { $in: ["accepted", "in_progress", "pending", "completed"] },
  }).populate("volunteerId", "name phone verified");

  const citizenId = emergency.userId?._id?.toString?.() || emergency.userId?.toString?.();
  const isCitizen = citizenId === user._id.toString();
  const isAssignedVolunteer =
    assignment && assignment.volunteerId?._id?.toString?.() === user._id.toString();
  const isAdmin = user.role === "admin";

  if (isCitizen || isAssignedVolunteer || isAdmin) {
    return { emergency, assignment, isAuthorized: true };
  }

  return { error: { status: 403, message: "You are not authorized to access this mission chat" } };
};

/**
 * GET /api/emergencies/:id/messages
 * Retrieve chat history for an emergency, along with citizen and volunteer participant info
 */
export const getEmergencyMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const access = await verifyChatAccess(id, req.user);
    if (access.error) {
      return sendError(res, access.error.status, access.error.message);
    }

    const messages = await ChatMessage.find({ emergencyId: id })
      .sort({ createdAt: 1 })
      .limit(200);

    const citizenUser = access.emergency.userId;
    const volunteerUser = access.assignment?.volunteerId;

    return sendSuccess(res, 200, "Emergency chat messages", {
      messages,
      citizen: citizenUser
        ? {
            id: citizenUser._id || citizenUser,
            name: citizenUser.name || "Citizen Requester",
            phone: citizenUser.phone || null,
          }
        : null,
      volunteer: volunteerUser
        ? {
            id: volunteerUser._id || volunteerUser,
            name: volunteerUser.name || "Assigned Responder",
            phone: volunteerUser.phone || null,
            verified: Boolean(volunteerUser.verified),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/emergencies/:id/messages
 * Send a chat message or 1-tap quick reply in an emergency room
 */
export const sendEmergencyMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, isQuickReply = false } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return sendError(res, 400, "Message content is required");
    }

    const access = await verifyChatAccess(id, req.user);
    if (access.error) {
      return sendError(res, access.error.status, access.error.message);
    }

    const chatMessage = await ChatMessage.create({
      emergencyId: id,
      senderId: req.user._id,
      senderName: req.user.name || "User",
      senderRole: req.user.role || "citizen",
      message: message.trim(),
      isQuickReply: Boolean(isQuickReply),
    });

    // Real-time broadcast to room emergency:<id>
    try {
      const io = getIO();
      io.to(`emergency:${id}`).emit("new_message", chatMessage);

      // Notify the citizen's personal room when a responder sends a message.
      // verifyChatAccess() populates userId, so resolve the raw ObjectId first.
      const citizenId =
        access.emergency.userId?._id?.toString?.() || access.emergency.userId?.toString?.();
      if (citizenId && citizenId !== req.user._id.toString()) {
        io.to(`user:${citizenId}`).emit("chat_notification", {
          emergencyId: id,
          senderName: req.user.name,
          message: chatMessage.message,
        });
      }
    } catch (socketErr) {
      console.warn("[Chat] Socket broadcast notice:", socketErr.message);
    }

    return sendSuccess(res, 201, "Message sent successfully", { message: chatMessage });
  } catch (error) {
    next(error);
  }
};
