import mongoose from "mongoose";

const incidentReportSchema = new mongoose.Schema(
  {
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      maxlength: 2000,
    },

    category: {
      type: String,
      enum: [
        "flood",
        "earthquake",
        "fire",
        "landslide",
        "cyclone",
        "building_collapse",
        "medical_crisis",
        "road_blockage",
        "other",
      ],
      required: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) =>
            Array.isArray(coordinates) &&
            coordinates.length === 2 &&
            coordinates[0] >= -180 &&
            coordinates[0] <= 180 &&
            coordinates[1] >= -90 &&
            coordinates[1] <= 90,
          message: "Invalid GeoJSON coordinates",
        },
      },
    },

    address: {
      type: String,
      default: "",
    },

    images: [
      {
        url: { type: String, required: true },
        publicId: { type: String },
      },
    ],

    status: {
      type: String,
      enum: ["pending", "reviewed", "verified", "rejected", "closed"],
      default: "pending",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

incidentReportSchema.index({ location: "2dsphere" });
incidentReportSchema.index({ status: 1 });
incidentReportSchema.index({ category: 1 });
incidentReportSchema.index({ createdAt: -1 });

export default mongoose.model("IncidentReport", incidentReportSchema);
