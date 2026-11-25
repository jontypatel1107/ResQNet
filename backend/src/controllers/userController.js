import User from "../models/User.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, 200, "Profile retrieved", { user });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { name, phone } },
      { new: true, runValidators: true }
    );
    return sendSuccess(res, 200, "Profile updated successfully", { user });
  } catch (error) {
    next(error);
  }
};
