import AssistanceAssignment from "../models/AssistanceAssignment.js";
import EmergencyRequest from "../models/EmergencyRequest.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../config/socket.js";

export const acceptAssignment = async (req, res, next) => {
  try {
    const { id } = req.params; // assignmentId or requestId

    const assignment = await AssistanceAssignment.findById(id);
    if (!assignment) {
      return sendError(res, 404, "Assignment not found");
    }

    if (assignment.volunteerId.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "You are not authorized for this assignment");
    }

    assignment.status = "accepted";
    assignment.acceptedAt = new Date();
    await assignment.save();

    await EmergencyRequest.findByIdAndUpdate(assignment.requestId, {
      status: "accepted",
    });

    try {
      const io = getIO();
      io.to(`user:${assignment.volunteerId}`).emit("assignment_updated", assignment);
    } catch {}

    return sendSuccess(res, 200, "Assignment accepted", { assignment });
  } catch (error) {
    next(error);
  }
};

export const getMyAssignments = async (req, res, next) => {
  try {
    const assignments = await AssistanceAssignment.find({
      volunteerId: req.user._id,
    })
      .populate("requestId")
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, "My assignments", { assignments });
  } catch (error) {
    next(error);
  }
};

export const updateAssignmentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const assignment = await AssistanceAssignment.findById(id);
    if (!assignment) {
      return sendError(res, 404, "Assignment not found");
    }

    assignment.status = status;
    if (notes) assignment.notes = notes;
    if (status === "completed") {
      assignment.completedAt = new Date();
      await EmergencyRequest.findByIdAndUpdate(assignment.requestId, {
        status: "resolved",
        resolvedAt: new Date(),
      });
    } else if (status === "in_progress") {
      await EmergencyRequest.findByIdAndUpdate(assignment.requestId, {
        status: "in_progress",
      });
    }

    await assignment.save();
    return sendSuccess(res, 200, "Assignment status updated", { assignment });
  } catch (error) {
    next(error);
  }
};
