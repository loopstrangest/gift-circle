import { Server } from "socket.io";
import type { Server as HTTPServer } from "node:http";

export type PresencePayload = {
  roomId: string;
  membershipId: string;
  userId: string;
  displayName: string | null;
  nickname: string | null;
  role: "HOST" | "PARTICIPANT";
  connectedAt: number;
};

let ioInstance: Server | null = null;

export function initializeRealtime(server: HTTPServer) {
  if (ioInstance) {
    return ioInstance;
  }

  const io = new Server(server, {
    path: "/api/socket",
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_ORIGIN ?? undefined,
      credentials: true,
    },
  });

  ioInstance = io;

  io.on("connection", (socket) => {
    const { roomId } = socket.handshake.auth ?? {};
    if (!roomId) {
      socket.disconnect(true);
      return;
    }

    socket.join(`room:${roomId}`);

    socket.on("disconnect", () => {
      io.to(`room:${roomId}`).emit("presence", { type: "disconnect" });
    });
  });

  return io;
}

export function getRealtimeServer() {
  return ioInstance;
}

export function emitPresenceUpdate() {
  // Presence events are no longer broadcast from the server; the client polls.
}
