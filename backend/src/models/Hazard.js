import mongoose from "mongoose";

const hazardSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "flooded_road",
        "downed_powerline",
        "fallen_tree",
        "collapsed_structure",
        "gas_leak",
        "landslide",
        "other",
      ],
      required: true,
      default: "flooded_road",
    },
    title: {
      type: String,
      required: [true, "Hazard title is required"],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "high",
    },
    status: {
      type: String,
      enum: ["active", "cleared"],
      default: "active",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, "Location coordinates [longitude, latitude] are required"],
      },
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reporterName: {
      type: String,
      trim: true,
      default: "Anonymous Citizen",
    },
    clearedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    clearedAt: {
      type: Date,
      default: null,
    },
    clearedNotes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

hazardSchema.index({ location: "2dsphere" });
hazardSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("Hazard", hazardSchema);
