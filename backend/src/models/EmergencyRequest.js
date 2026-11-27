import mongoose from "mongoose";

const emergencyRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    category: {
      type: String,
      enum: [
        "medical",
        "rescue",
        "food",
        "water",
        "transportation",
        "other",
      ],
      required: true,
    },

    priority: {
      type: String,
      enum: ["critical", "high", "medium", "normal"],
      default: "medium",
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
          message: "Invalid GeoJSON coordinates [longitude, latitude]",
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
      enum: [
        "pending",
        "assigned",
        "accepted",
        "in_progress",
        "resolved",
        "cancelled",
      ],
      default: "pending",
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    responderLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: null,
      },
      heading: { type: Number, default: 0 },
      speed: { type: Number, default: 0 }, // km/h
      updatedAt: { type: Date, default: null },
    },

    responderTrail: [
      {
        coordinates: { type: [Number], required: true },
        heading: { type: Number, default: 0 },
        speed: { type: Number, default: 0 },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    eta: {
      distanceKm: { type: Number, default: null },
      durationMinutes: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },

    deviceTelemetry: {
      batteryLevel: { type: Number, default: null },
      networkStatus: { type: String, default: null },
    },
  },
  { timestamps: true }
);

emergencyRequestSchema.index({ location: "2dsphere" });
emergencyRequestSchema.index({ status: 1, priority: -1 });
emergencyRequestSchema.index({ createdAt: -1 });

export default mongoose.model("EmergencyRequest", emergencyRequestSchema);
