import mongoose from "mongoose";
import AssistanceAssignment from "../models/AssistanceAssignment.js";
import EmergencyRequest from "../models/EmergencyRequest.js";
import User from "../models/User.js";
import VolunteerProfile from "../models/VolunteerProfile.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { getIO } from "../config/socket.js";
import { sendNotification } from "../services/notificationService.js";

const ACTIVE_ASSIGNMENT_STATUSES = ["pending", "accepted", "in_progress"];
const OPEN_EMERGENCY_STATUSES = ["pending", "assigned"];
const MANAGEABLE_ASSIGNMENT_STATUSES = ["in_progress", "completed", "cancelled"];

const ALLOWED_TRANSITIONS = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["in_progress", "completed", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
};

class ClaimError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const emitToRooms = (io, rooms, event, payload) => {
  const roomList = [...new Set(rooms.filter(Boolean))];
  if (roomList.length === 0) return;

  let emitter = io.to(roomList[0]);
  roomList.slice(1).forEach((room) => {
    emitter = emitter.to(room);
  });
  emitter.emit(event, payload);
};

const emitAssignmentUpdate = (assignment, emergency) => {
  try {
    const io = getIO();

    if (assignment) {
      emitToRooms(
        io,
        [
          `user:${assignment.volunteerId?.toString?.() || assignment.volunteerId}`,
          "role:admin",
        ],
        "assignment_updated",
        assignment
      );
    }

    if (emergency) {
      emitToRooms(
        io,
        [
          `user:${emergency.userId?.toString?.() || emergency.userId}`,
          "role:volunteer",
          "role:admin",
        ],
        "emergency_updated",
        emergency
      );
    }
  } catch {
    // Socket.IO is optional when controllers run in isolation/tests.
  }
};

/** Build the responder information a citizen is allowed to see after acceptance. */
const buildMissionForCitizen = async (assignment, emergency) => {
  const volunteerId = assignment.volunteerId?.toString?.() || assignment.volunteerId;

  const [volunteerUser, volunteerProfile] = await Promise.all([
    User.findById(volunteerId).select("name phone role profileImage"),
    VolunteerProfile.findOne({ userId: volunteerId }).select(
      "skills availability serviceRadius verified location"
    ),
  ]);

  const volunteer = {
    id: volunteerUser?._id?.toString?.() || volunteerId.toString(),
    name: volunteerUser?.name || "ResQNet volunteer",
    phone: volunteerUser?.phone || null,
    role: volunteerUser?.role || "volunteer",
    profileImage: volunteerUser?.profileImage || null,
    skills: volunteerProfile?.skills || [],
    availability: volunteerProfile?.availability ?? false,
    serviceRadius: volunteerProfile?.serviceRadius ?? null,
    verified: volunteerProfile?.verified ?? false,
    location: volunteerProfile?.location || null,
  };

  return {
    _id: assignment._id.toString(),
    status: assignment.status,
    acceptedAt: assignment.acceptedAt || null,
    completedAt: assignment.completedAt || null,
    notes: assignment.notes || "",
    volunteer,
  };
};

/** Push the accepted mission to the citizen's user room and notification inbox. */
const emitMissionAccepted = async (assignment, emergency) => {
  try {
    const mission = await buildMissionForCitizen(assignment, emergency);
    const citizenId = emergency.userId?.toString?.() || emergency.userId;

    const payload = {
      emergency: {
        _id: emergency._id.toString(),
        title: emergency.title,
        description: emergency.description,
        category: emergency.category,
        priority: emergency.priority,
        status: emergency.status,
        address: emergency.address || "",
        location: emergency.location,
        createdAt: emergency.createdAt,
      },
      mission,
      url: `/emergency/${emergency._id.toString()}`,
    };

    try {
      const io = getIO();
      io.to(`user:${citizenId}`).emit("mission_accepted", payload);
    } catch {
      // Socket.IO is optional in standalone/controller tests.
    }

    await sendNotification({
      userId: citizenId,
      title: "Help is on the way",
      message: `${mission.volunteer.name} accepted your SOS. Open the SOS to see responder details.`,
      type: "assignment",
      relatedId: emergency._id,
      data: {
        event: "mission_accepted",
        url: payload.url,
        emergencyId: emergency._id.toString(),
      },
    });

    return payload;
  } catch (error) {
    // A notification failure must never fail an already accepted mission.
    console.error("[Assignment] Failed to notify citizen:", error);
    return null;
  }
};

/**
 * Atomically claims the SOS for one volunteer.
 *
 * The emergency status is used as the lock: only one conditional update from
 * pending/assigned to accepted can succeed, so simultaneous accepts cannot
 * both claim the same SOS.
 */
const claimEmergency = async ({ emergencyId, userId, assignmentId = null, isAdmin = false }) => {
  const emergency = await EmergencyRequest.findById(emergencyId);
  if (!emergency) {
    throw new ClaimError(404, "SOS request not found");
  }

  const activeAssignment = await AssistanceAssignment.findOne({
    requestId: emergency._id,
    status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
  });

  if (assignmentId) {
    const requestedAssignment = await AssistanceAssignment.findById(assignmentId);
    if (!requestedAssignment) {
      throw new ClaimError(404, "Assignment not found");
    }
    if (requestedAssignment.requestId.toString() !== emergency._id.toString()) {
      throw new ClaimError(400, "Assignment does not belong to this SOS");
    }
    if (!isAdmin && requestedAssignment.volunteerId.toString() !== userId.toString()) {
      throw new ClaimError(403, "You are not authorized for this assignment");
    }
    if (!ACTIVE_ASSIGNMENT_STATUSES.includes(requestedAssignment.status)) {
      throw new ClaimError(409, `This mission is already ${requestedAssignment.status}`);
    }
    if (
      activeAssignment &&
      activeAssignment._id.toString() !== requestedAssignment._id.toString()
    ) {
      throw new ClaimError(409, "Another volunteer has already accepted this SOS");
    }
    if (["accepted", "in_progress"].includes(requestedAssignment.status)) {
      return { assignment: requestedAssignment, emergency, acceptedNow: false };
    }
  } else if (activeAssignment) {
    if (activeAssignment.volunteerId.toString() !== userId.toString()) {
      throw new ClaimError(409, "Another volunteer has already accepted this SOS");
    }
    if (["accepted", "in_progress"].includes(activeAssignment.status)) {
      return { assignment: activeAssignment, emergency, acceptedNow: false };
    }
  }

  if (!OPEN_EMERGENCY_STATUSES.includes(emergency.status)) {
    throw new ClaimError(409, `This SOS is already ${emergency.status}`);
  }

  const claimedEmergency = await EmergencyRequest.findOneAndUpdate(
    { _id: emergency._id, status: { $in: OPEN_EMERGENCY_STATUSES } },
    { $set: { status: "accepted" } },
    { new: true }
  );
  if (!claimedEmergency) {
    throw new ClaimError(409, "Another volunteer has already accepted this SOS");
  }

  let assignment = activeAssignment;
  if (!assignment && assignmentId) {
    assignment = await AssistanceAssignment.findById(assignmentId);
  }

  const rollbackClaim = () =>
    EmergencyRequest.findByIdAndUpdate(
      emergency._id,
      { $set: { status: emergency.status } },
      { new: true }
    );

  try {
    if (assignment) {
      const acceptedAssignment = await AssistanceAssignment.findOneAndUpdate(
        { _id: assignment._id, status: "pending" },
        { $set: { status: "accepted", acceptedAt: new Date() } },
        { new: true }
      );
      if (!acceptedAssignment) {
        await rollbackClaim();
        throw new ClaimError(409, "This mission is no longer available");
      }
      assignment = acceptedAssignment;
    } else {
      assignment = await AssistanceAssignment.create({
        requestId: emergency._id,
        volunteerId: userId,
        assignedBy: isAdmin ? userId : null,
        status: "accepted",
        acceptedAt: new Date(),
      });

      const competingAssignment = await AssistanceAssignment.findOne({
        requestId: emergency._id,
        status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
        _id: { $ne: assignment._id },
      });
      if (competingAssignment) {
        await AssistanceAssignment.deleteOne({ _id: assignment._id });
        await rollbackClaim();
        throw new ClaimError(409, "Another volunteer has already accepted this SOS");
      }
    }
  } catch (error) {
    if (!(error instanceof ClaimError)) {
      await rollbackClaim();
    }
    throw error;
  }

  return { assignment, emergency: claimedEmergency, acceptedNow: true };
};

export const acceptAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid SOS identifier");
    }

    let claimed;

    // Nearby/mobile screens send the emergency request ID. Assignment IDs are
    // still accepted for older clients and admin workflows.
    const emergency = await EmergencyRequest.findById(id);
    if (emergency) {
      claimed = await claimEmergency({
        emergencyId: emergency._id,
        userId,
        isAdmin: req.user.role === "admin",
      });
    } else {
      const assignment = await AssistanceAssignment.findById(id);
      if (!assignment) {
        return sendError(res, 404, "SOS request not found");
      }
      if (
        assignment.volunteerId.toString() !== userId.toString() &&
        req.user.role !== "admin"
      ) {
        return sendError(res, 403, "You are not authorized for this assignment");
      }

      claimed = await claimEmergency({
        emergencyId: assignment.requestId,
        userId,
        assignmentId: assignment._id,
        isAdmin: req.user.role === "admin",
      });
    }

    emitAssignmentUpdate(claimed.assignment, claimed.emergency);

    if (claimed.acceptedNow) {
      await emitMissionAccepted(claimed.assignment, claimed.emergency);
    }

    return sendSuccess(res, 200, "SOS accepted", {
      assignment: claimed.assignment,
      emergency: claimed.emergency,
    });
  } catch (error) {
    if (error instanceof ClaimError) {
      return sendError(res, error.statusCode, error.message);
    }
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 400, "Invalid assignment identifier");
    }

    if (!MANAGEABLE_ASSIGNMENT_STATUSES.includes(status)) {
      return sendError(res, 400, "Invalid mission status");
    }

    const assignment = await AssistanceAssignment.findById(id);
    if (!assignment) {
      return sendError(res, 404, "Assignment not found");
    }

    if (
      assignment.volunteerId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return sendError(res, 403, "You are not authorized for this assignment");
    }

    const allowed = ALLOWED_TRANSITIONS[assignment.status] || [];
    if (!allowed.includes(status)) {
      return sendError(
        res,
        400,
        `Cannot change a ${assignment.status} mission to ${status}`
      );
    }

    assignment.status = status;
    if (typeof notes === "string") assignment.notes = notes;
    if (status === "completed") assignment.completedAt = new Date();
    if (status === "cancelled") assignment.cancelledAt = new Date();
    await assignment.save();

    let emergency = null;

    if (status === "completed") {
      emergency = await EmergencyRequest.findByIdAndUpdate(
        assignment.requestId,
        { status: "resolved", resolvedAt: new Date() },
        { new: true }
      );
    } else if (status === "in_progress") {
      emergency = await EmergencyRequest.findByIdAndUpdate(
        assignment.requestId,
        { status: "in_progress" },
        { new: true }
      );
    } else if (status === "cancelled") {
      emergency = await EmergencyRequest.findByIdAndUpdate(
        assignment.requestId,
        { status: "pending", $unset: { resolvedAt: 1 } },
        { new: true }
      );
    }

    emitAssignmentUpdate(assignment, emergency);

    return sendSuccess(res, 200, "Mission status updated", { assignment, emergency });
  } catch (error) {
    next(error);
  }
};
