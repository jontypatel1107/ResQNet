import AssistanceAssignment from "../models/AssistanceAssignment.js";

export const assignVolunteer = async ({ requestId, volunteerId, assignedBy = null }) => {
  // Check if active assignment already exists for this emergency
  const existingActive = await AssistanceAssignment.findOne({
    requestId,
    status: { $in: ["pending", "accepted", "in_progress"] },
  });

  if (existingActive) {
    throw new Error("Emergency request already has an active volunteer assigned");
  }

  const assignment = await AssistanceAssignment.create({
    requestId,
    volunteerId,
    assignedBy,
    status: "pending",
  });

  return assignment;
};
