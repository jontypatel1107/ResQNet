import { Server } from "socket.io";

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room based on user role or user ID
    socket.on("join", ({ userId, role }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined user room: user:${userId}`);
      }
      if (role) {
        socket.join(`role:${role}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined role room: role:${role}`);
      }
    });

    // Join/leave emergency mission chat room
    socket.on("join_emergency", ({ emergencyId }) => {
      if (emergencyId) {
        socket.join(`emergency:${emergencyId}`);
        console.log(`[Socket.IO] Socket ${socket.id} joined emergency room: emergency:${emergencyId}`);
      }
    });

    socket.on("leave_emergency", ({ emergencyId }) => {
      if (emergencyId) {
        socket.leave(`emergency:${emergencyId}`);
        console.log(`[Socket.IO] Socket ${socket.id} left emergency room: emergency:${emergencyId}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized yet!");
  }
  return io;
};
