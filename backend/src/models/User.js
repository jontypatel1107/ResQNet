import mongoose from "mongoose";

const trustedContactSubSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 60,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  relationship: {
    type: String,
    enum: ["Family", "Parent", "Spouse", "Sibling", "Child", "Friend", "Doctor", "Colleague", "Other"],
    default: "Family",
  },
  notifyOnSOS: {
    type: Boolean,
    default: true,
  },
  notifyVia: {
    type: [String],
    enum: ["sms", "whatsapp", "call"],
    default: ["sms", "whatsapp"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const trustedCircleSettingsSubSchema = new mongoose.Schema({
  autoAlertEnabled: {
    type: Boolean,
    default: true,
  },
  includeLiveLocation: {
    type: Boolean,
    default: true,
  },
  notifyOnCriticalOnly: {
    type: Boolean,
    default: false,
  },
  customAlertMessage: {
    type: String,
    default: "EMERGENCY SOS: I need urgent help! My live location and situation are being tracked on ResQNet:",
    maxlength: 300,
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["citizen", "volunteer", "admin"],
      default: "citizen",
    },

    profileImage: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    trustedContacts: {
      type: [trustedContactSubSchema],
      default: [],
    },

    trustedCircleSettings: {
      type: trustedCircleSettingsSubSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

userSchema.index({ phone: 1 });

export default mongoose.model("User", userSchema);
