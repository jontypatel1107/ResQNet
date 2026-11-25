import { io, Socket } from "socket.io-client";
import { ensureServerBaseUrl, getSocketUrl } from "./serverConfig";

export { getSocketUrl } from "./serverConfig";

let socket: Socket | null = null;
let socketUrl: string | null = null;

export const getSocket = (): Socket => {
  const url = getSocketUrl();

  // Recreate the client if discovery selected a different backend port.
  if (!socket || socketUrl !== url) {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    socket = io(url, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketUrl = url;
  }

  return socket;
};

export const connectSocket = async (userId?: string, role?: string): Promise<Socket> => {
  await ensureServerBaseUrl();

  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.once("connect", () => {
      console.log("[Socket.IO] Connected to ResQNet real-time server");
      if (userId || role) {
        s.emit("join", { userId, role });
      }
    });
  }

  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
    console.log("[Socket.IO] Disconnected from ResQNet server");
  }
};
