import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import VolunteerProfile from "../models/VolunteerProfile.js";
import { sendSuccess, sendError } from "../utils/response.js";

const generateTokens = (user) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || "default_access_secret";
  const refreshSecret = process.env.JWT_REFRESH_SECRET || "default_refresh_secret";

  const accessToken = jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    accessSecret,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    refreshSecret,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

export const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role,
      skills,
      serviceRadius,
      latitude,
      longitude,
    } = req.body;

    // Disallow registering as admin via public API
    if (role === "admin") {
      return sendError(res, 403, "Admin registration is not allowed through this route");
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 409, "An account with this email already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: role || "citizen",
    });

    // If registered as volunteer, create corresponding VolunteerProfile
    let volunteerProfile = null;
    if (user.role === "volunteer") {
      const profileData = {
        userId: user._id,
        skills: skills && skills.length > 0 ? skills : ["general_assistance"],
        serviceRadius: serviceRadius || 10,
        availability: true,
      };

      if (typeof latitude === "number" && typeof longitude === "number") {
        profileData.location = {
          type: "Point",
          coordinates: [longitude, latitude],
        };
      }

      volunteerProfile = await VolunteerProfile.create(profileData);
    }

    const tokens = generateTokens(user);

    return sendSuccess(res, 201, "Account registered successfully", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        volunteerProfile,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) {
      return sendError(res, 401, "Invalid email or password");
    }

    if (!user.isActive) {
      return sendError(res, 403, "Account is deactivated. Please contact support.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 401, "Invalid email or password");
    }

    let volunteerProfile = null;
    if (user.role === "volunteer") {
      volunteerProfile = await VolunteerProfile.findOne({ userId: user._id });
    }

    const tokens = generateTokens(user);

    return sendSuccess(res, 200, "Login successful", {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        volunteerProfile,
      },
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return sendError(res, 400, "Refresh token is required");
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || "default_refresh_secret";
    const decoded = jwt.verify(token, refreshSecret);

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return sendError(res, 401, "Invalid refresh token or inactive account");
    }

    const tokens = generateTokens(user);
    return sendSuccess(res, 200, "Token refreshed successfully", tokens);
  } catch (error) {
    return sendError(res, 401, "Invalid or expired refresh token");
  }
};

export const getMe = async (req, res, next) => {
  try {
    let volunteerProfile = null;
    if (req.user.role === "volunteer") {
      volunteerProfile = await VolunteerProfile.findOne({ userId: req.user._id });
    }

    return sendSuccess(res, 200, "User profile retrieved", {
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        role: req.user.role,
        profileImage: req.user.profileImage,
        createdAt: req.user.createdAt,
        volunteerProfile,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+passwordHash");
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return sendError(res, 400, "Incorrect current password");
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    return sendSuccess(res, 200, "Password updated successfully");
  } catch (error) {
    next(error);
  }
};
