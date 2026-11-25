import mongoose from "mongoose";

const volunteerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    skills: [
      {
        type: String,
        enum: [
          "first_aid",
          "medical",
          "rescue",
          "driving",
          "food_distribution",
          "general_assistance",
        ],
      },
    ],

    availability: {
      type: Boolean,
      default: false,
    },

    serviceRadius: {
      type: Number,
      default: 10,
      min: 1,
      max: 100,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },

    verified: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

volunteerProfileSchema.index({ location: "2dsphere" });
volunteerProfileSchema.index({ availability: 1, verified: 1 });

export default mongoose.model("VolunteerProfile", volunteerProfileSchema);
