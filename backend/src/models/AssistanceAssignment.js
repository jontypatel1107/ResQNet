import mongoose from "mongoose";

const assistanceAssignmentSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmergencyRequest",
      required: true,
      index: true,
    },

    volunteerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "rejected",
        "cancelled",
      ],
      default: "pending",
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

assistanceAssignmentSchema.index({ requestId: 1, status: 1 });
assistanceAssignmentSchema.index({ volunteerId: 1, status: 1 });

export default mongoose.model("AssistanceAssignment", assistanceAssignmentSchema);
