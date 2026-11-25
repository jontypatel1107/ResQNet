import Notification from "../models/Notification.js";
import { getIO } from "../config/socket.js";

export const sendNotification = async ({ userId, title, message, type = "system", relatedId = null, data = {} }) => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      relatedId,
      data,
    });

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit("notification", notification);
    } catch {
      // Socket may not be initialized or connected
    }

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return null;
  }
};
