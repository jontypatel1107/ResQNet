import mongoose from "mongoose";
import EmergencyRequest from "../models/EmergencyRequest.js";
import VolunteerProfile from "../models/VolunteerProfile.js";
import AssistanceAssignment from "../models/AssistanceAssignment.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../config/socket.js";

// In-memory store for pending auto-dispatch timers: emergencyId -> timer
const autoDispatchTimers = new Map();

/**
 * Category-to-skill weights matrix for triage matching
 */
const CATEGORY_SKILL_WEIGHTS = {
  medical: { medical: 25, first_aid: 20, general_assistance: 5 },
  rescue: { rescue: 25, first_aid: 15, driving: 10, general_assistance: 5 },
  food: { food_distribution: 25, driving: 15, general_assistance: 10 },
  water: { food_distribution: 20, driving: 15, rescue: 10, general_assistance: 10 },
  transportation: { driving: 25, first_aid: 10, general_assistance: 5 },
  other: { general_assistance: 15, first_aid: 10, driving: 5 },
};

/**
 * Calculate Great-Circle distance between two coordinates in kilometers (Haversine formula)
 */
export const calculateDistanceKm = (lon1, lat1, lon2, lat2) => {
  if (
    typeof lon1 !== "number" ||
    typeof lat1 !== "number" ||
    typeof lon2 !== "number" ||
    typeof lat2 !== "number"
  ) {
    return 99999;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

/**
 * Score and rank all available volunteers for a specific emergency incident.
 * Evaluates:
 * 1. Distance & serviceRadius (Max 40 pts)
 * 2. Category-to-skill alignment (Max 30 pts)
 * 3. Platform verification bonus (Max 15 pts)
 * 4. Active workload & fatigue penalty (Max 15 pts)
 */
export const scoreVolunteersForEmergency = async (emergencyIdOrDoc) => {
  let emergency = emergencyIdOrDoc;
  if (typeof emergency === "string" || emergency instanceof mongoose.Types.ObjectId) {
    emergency = await EmergencyRequest.findById(emergency).populate("userId", "name phone email");
  }

  if (!emergency) {
    throw new Error("Emergency incident not found");
  }

  const [eLon, eLat] = emergency.location?.coordinates || [0, 0];
  const category = emergency.category || "other";

  // 1. Fetch all currently available volunteer profiles with active users
  const profiles = await VolunteerProfile.find({
    availability: true,
  }).populate("userId", "name phone email role isActive profileImage");

  // 2. Query active workloads for all volunteers in parallel
  const activeAssignments = await AssistanceAssignment.find({
    status: { $in: ["accepted", "in_progress"] },
  }).select("volunteerId");

  const workloadMap = new Map();
  for (const asgn of activeAssignments) {
    const vId = asgn.volunteerId?.toString();
    if (vId) {
      workloadMap.set(vId, (workloadMap.get(vId) || 0) + 1);
    }
  }

  // 3. Filter and score each eligible volunteer
  const scoredCandidates = [];

  for (const profile of profiles) {
    const user = profile.userId;
    if (!user || user.isActive === false || user.role !== "volunteer") {
      continue;
    }

    // Requester cannot respond to their own emergency
    const requesterId = emergency.userId?._id?.toString?.() || emergency.userId?.toString?.();
    if (user._id?.toString() === requesterId) {
      continue;
    }

    const [vLon, vLat] = profile.location?.coordinates || [0, 0];
    const hasCoordinates = !(vLon === 0 && vLat === 0);
    const distanceKm = hasCoordinates ? calculateDistanceKm(eLon, eLat, vLon, vLat) : 99999;
    const serviceRadius = profile.serviceRadius || 10;
    const isWithinRadius = distanceKm <= serviceRadius;

    // A. Distance Score (0 to 40 pts)
    let distanceScore = 0;
    if (hasCoordinates && isWithinRadius) {
      distanceScore = Math.max(0, (1 - distanceKm / serviceRadius) * 40);
    } else if (hasCoordinates && distanceKm <= serviceRadius * 1.5) {
      // Small partial credit if slightly beyond radius but still near
      distanceScore = Math.max(0, (1 - distanceKm / (serviceRadius * 1.5)) * 15);
    }
    distanceScore = Number(distanceScore.toFixed(1));

    // B. Skill Alignment Score (0 to 30 pts)
    const weights = CATEGORY_SKILL_WEIGHTS[category] || CATEGORY_SKILL_WEIGHTS.other;
    let skillScore = 0;
    const matchedSkills = [];

    for (const skill of profile.skills || []) {
      if (weights[skill]) {
        skillScore += weights[skill];
        matchedSkills.push(skill);
      }
    }
    skillScore = Math.min(30, skillScore);
    skillScore = Number(skillScore.toFixed(1));

    // C. Verification Bonus (0 or 15 pts)
    const verificationScore = profile.verified ? 15.0 : 0.0;

    // D. Workload & Fatigue Score (0 to 15 pts)
    const activeCount = workloadMap.get(user._id.toString()) || 0;
    let workloadScore = 15.0;
    if (activeCount === 1) workloadScore = 8.0;
    else if (activeCount === 2) workloadScore = 3.0;
    else if (activeCount >= 3) workloadScore = 0.0;

    // E. Total Composite Score (0 to 100 pts)
    const totalScore = Number(
      (distanceScore + skillScore + verificationScore + workloadScore).toFixed(1)
    );

    // Reasons / Insights for Admin & Transparency
    const reasons = [];
    if (hasCoordinates) {
      if (isWithinRadius) {
        reasons.push(`${distanceKm} km away (within ${serviceRadius} km radius)`);
      } else {
        reasons.push(`${distanceKm} km away (outside ${serviceRadius} km service radius)`);
      }
    } else {
      reasons.push("Location coordinates not updated recently");
    }

    if (matchedSkills.length > 0) {
      reasons.push(`Skills matched for ${category.toUpperCase()}: ${matchedSkills.join(", ")}`);
    } else {
      reasons.push("No direct category skill match");
    }

    if (profile.verified) {
      reasons.push("Verified platform responder (+15 pts)");
    } else {
      reasons.push("Unverified volunteer");
    }

    if (activeCount === 0) {
      reasons.push("Zero active assignments (100% available)");
    } else {
      reasons.push(`Currently handling ${activeCount} active mission(s)`);
    }

    scoredCandidates.push({
      volunteerId: user._id.toString(),
      name: user.name,
      phone: user.phone,
      email: user.email,
      profileImage: user.profileImage || null,
      distanceKm: hasCoordinates ? distanceKm : null,
      serviceRadius,
      isWithinRadius,
      verified: Boolean(profile.verified),
      skills: profile.skills || [],
      activeWorkload: activeCount,
      totalScore,
      breakdown: {
        distanceScore,
        skillScore,
        verificationScore,
        workloadScore,
        matchedSkills,
        reasons,
      },
    });
  }

  // Sort candidates by totalScore descending, then by distance ascending
  scoredCandidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    return (a.distanceKm || 99999) - (b.distanceKm || 99999);
  });

  return {
    emergency: {
      _id: emergency._id,
      title: emergency.title,
      category: emergency.category,
      priority: emergency.priority,
      status: emergency.status,
      address: emergency.address,
      coordinates: emergency.location?.coordinates || [0, 0],
      createdAt: emergency.createdAt,
    },
    candidatesCount: scoredCandidates.length,
    candidates: scoredCandidates,
  };
};

/**
 * Execute auto-dispatch: Assign the optimal volunteer to an emergency incident.
 */
export const autoDispatchEmergency = async ({
  emergencyId,
  assignedBy = null,
  preferredVolunteerId = null,
  notes = "",
}) => {
  const emergency = await EmergencyRequest.findById(emergencyId);
  if (!emergency) {
    return { success: false, reason: "Emergency request not found" };
  }

  // Only assign if emergency is currently pending
  if (emergency.status !== "pending") {
    return {
      success: false,
      reason: `Emergency is already ${emergency.status}`,
      currentStatus: emergency.status,
    };
  }

  // Check if an active assignment already exists
  const existingActive = await AssistanceAssignment.findOne({
    requestId: emergency._id,
    status: { $in: ["pending", "accepted", "in_progress"] },
  });

  if (existingActive) {
    return {
      success: false,
      reason: "An active responder assignment already exists",
      assignment: existingActive,
    };
  }

  // Score available volunteers
  const triage = await scoreVolunteersForEmergency(emergency);
  let selectedCandidate = null;

  if (preferredVolunteerId) {
    selectedCandidate = triage.candidates.find(
      (c) => c.volunteerId === preferredVolunteerId.toString()
    );
  }

  // Fallback to top-ranked candidate
  if (!selectedCandidate && triage.candidates.length > 0) {
    selectedCandidate = triage.candidates[0];
  }

  if (!selectedCandidate) {
    return {
      success: false,
      reason: "No available volunteers found within response range",
      candidatesCount: 0,
    };
  }

  // Create Assignment
  const assignment = await AssistanceAssignment.create({
    requestId: emergency._id,
    volunteerId: selectedCandidate.volunteerId,
    assignedBy,
    status: "pending", // Waiting for volunteer to confirm / accept
    notes:
      notes ||
      `Auto-dispatched by Triage Engine (Triage Score: ${selectedCandidate.totalScore}/100)`,
  });

  // Update emergency status to 'assigned'
  emergency.status = "assigned";
  await emergency.save();

  // Cancel any scheduled timer for this emergency
  cancelAutoDispatch(emergency._id);

  // Send in-app notification to volunteer
  try {
    await Notification.create({
      userId: selectedCandidate.volunteerId,
      title: "🚨 Urgent Mission Auto-Dispatched",
      message: `You were selected as top responder for: ${emergency.title} (${emergency.priority.toUpperCase()})`,
      type: "assignment",
      relatedId: emergency._id,
      data: {
        emergencyId: emergency._id,
        assignmentId: assignment._id,
        score: selectedCandidate.totalScore,
      },
    });
  } catch (err) {
    console.warn("[AutoDispatch] Volunteer notification error:", err.message);
  }

  // Broadcast Socket.IO events in real-time
  try {
    const io = getIO();
    // 1. Notify the assigned volunteer directly
    io.to(`user:${selectedCandidate.volunteerId}`).emit("new_assignment", {
      assignment,
      emergency,
      score: selectedCandidate.totalScore,
      breakdown: selectedCandidate.breakdown,
    });

    // 2. Notify citizen and admin rooms that status updated to assigned
    io.emit("emergency_updated", emergency);
    io.to("role:admin").emit("triage_dispatched", {
      emergencyId: emergency._id,
      volunteerId: selectedCandidate.volunteerId,
      score: selectedCandidate.totalScore,
    });
  } catch (socketErr) {
    console.warn("[AutoDispatch] Socket emission skipped:", socketErr.message);
  }

  return {
    success: true,
    emergency,
    assignment,
    selectedVolunteer: selectedCandidate,
    totalCandidates: triage.candidatesCount,
  };
};

/**
 * Schedule automated dispatch for critical SOS if nobody manually claims it after timeout.
 */
export const scheduleAutoDispatch = (emergencyId, timeoutMs = 60000) => {
  const eIdStr = emergencyId.toString();

  // Cancel existing timer if one is already ticking
  if (autoDispatchTimers.has(eIdStr)) {
    clearTimeout(autoDispatchTimers.get(eIdStr));
    autoDispatchTimers.delete(eIdStr);
  }

  console.log(`[AutoDispatch] ⏱️ Scheduled auto-dispatch timer for SOS ${eIdStr} in ${timeoutMs / 1000}s`);

  const timer = setTimeout(async () => {
    autoDispatchTimers.delete(eIdStr);
    try {
      console.log(`[AutoDispatch] 🚨 Timeout reached for SOS ${eIdStr}. Evaluating triage candidates...`);
      const result = await autoDispatchEmergency({
        emergencyId: eIdStr,
        notes: "Automated timeout dispatch: No volunteer claimed critical SOS in time.",
      });

      if (result.success) {
        console.log(
          `[AutoDispatch] ✅ Successfully auto-assigned SOS ${eIdStr} to ${result.selectedVolunteer?.name} (Score: ${result.selectedVolunteer?.totalScore})`
        );
      } else {
        console.log(`[AutoDispatch] ℹ️ Auto-dispatch skipped for ${eIdStr}: ${result.reason}`);
      }
    } catch (err) {
      console.error(`[AutoDispatch] Error during scheduled auto-dispatch for ${eIdStr}:`, err);
    }
  }, timeoutMs);

  autoDispatchTimers.set(eIdStr, timer);
};

/**
 * Cancel a pending auto-dispatch timer (e.g. when a volunteer claims or emergency is cancelled)
 */
export const cancelAutoDispatch = (emergencyId) => {
  if (!emergencyId) return;
  const eIdStr = emergencyId.toString();
  if (autoDispatchTimers.has(eIdStr)) {
    clearTimeout(autoDispatchTimers.get(eIdStr));
    autoDispatchTimers.delete(eIdStr);
    console.log(`[AutoDispatch] ⏹️ Cancelled auto-dispatch timer for ${eIdStr}`);
  }
};

/**
 * Check if an emergency currently has a pending auto-dispatch timer
 */
export const hasPendingAutoDispatch = (emergencyId) => {
  if (!emergencyId) return false;
  return autoDispatchTimers.has(emergencyId.toString());
};

/**
 * Geospatial lookup: Get nearby emergencies for a location using 2dsphere indexing
 */
export const getNearbyEmergencies = async (longitude, latitude, maxDistanceKm = 10) => {
  const maxDistanceMeters = maxDistanceKm * 1000;
  return EmergencyRequest.find({
    status: { $in: ["pending", "assigned"] },
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistanceMeters,
      },
    },
  }).populate("userId", "name phone");
};
