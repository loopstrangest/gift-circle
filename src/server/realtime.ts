import { Server } from "socket.io";
import type { Server as HTTPServer } from "node:http";

import type { PresenceMessage, PresenceRefreshReason } from "@/lib/presence-types";
import type { RoomEvent } from "@/server/room-events";

const ROOM_CHANNEL_PREFIX = "room:";

let ioInstance: Server | null = null;
const activeMemberships = new Map<string, Set<string>>();

function buildRoomChannel(roomId: string) {
  return `${ROOM_CHANNEL_PREFIX}${roomId}`;
}

function getOrCreateActiveSet(roomId: string) {
  let set = activeMemberships.get(roomId);
  if (!set) {
    set = new Set<string>();
    activeMemberships.set(roomId, set);
  }
  return set;
}

function trackActiveMembership(roomId: string, membershipId: string) {
  const set = getOrCreateActiveSet(roomId);
  set.add(membershipId);
}

function clearActiveMembership(roomId: string, membershipId: string) {
  const set = activeMemberships.get(roomId);
  if (!set) {
    return;
  }
  set.delete(membershipId);
  if (set.size === 0) {
    activeMemberships.delete(roomId);
  }
}

function emitPresenceMessage(message: PresenceMessage) {
  const server = ioInstance;
  if (!server) {
    return;
  }

  server.to(buildRoomChannel(message.roomId)).emit("presence", message);
}

export type RoomMembershipPresence = {
  membershipId: string;
  connectedAt: number;
};

export function listActiveMemberships(roomId: string) {
  const set = activeMemberships.get(roomId);
  const server = ioInstance;
  const results = new Map<string, RoomMembershipPresence>();

  if (set) {
    for (const membershipId of set) {
      results.set(membershipId, {
        membershipId,
        connectedAt: Date.now(),
      });
    }
  }

  if (!server) {
    return results;
  }

  const channel = buildRoomChannel(roomId);
  const room = server.sockets.adapter.rooms.get(channel);
  if (!room) {
    return results;
  }

  for (const socketId of room) {
    const socket = server.sockets.sockets.get(socketId);
    const { membershipId, connectedAt } = socket?.data ?? {};
    if (typeof membershipId === "string" && membershipId.length > 0) {
      trackActiveMembership(roomId, membershipId);
      results.set(membershipId, {
        membershipId,
        connectedAt:
          typeof connectedAt === "number" && Number.isFinite(connectedAt)
            ? connectedAt
            : Date.now(),
      });
    }
  }

  return results;
}

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
    const { roomId, membershipId } = socket.handshake.auth ?? {};
    if (typeof roomId !== "string" || roomId.length === 0) {
      socket.disconnect(true);
      return;
    }

    socket.join(buildRoomChannel(roomId));

    if (typeof membershipId === "string" && membershipId.length > 0) {
      socket.data = {
        ...socket.data,
        roomId,
        membershipId,
        connectedAt: Date.now(),
      } satisfies typeof socket.data;

      trackActiveMembership(roomId, membershipId);

      socket.to(buildRoomChannel(roomId)).emit("presence", {
        type: "member:connected",
        roomId,
        membershipId,
        timestamp: Date.now(),
      } satisfies PresenceMessage);
    }

    socket.on("disconnect", () => {
      const membershipIdentifier =
        (typeof membershipId === "string" && membershipId.length > 0 && membershipId) ||
        (typeof socket.data?.membershipId === "string" &&
        socket.data.membershipId.length > 0
          ? (socket.data.membershipId as string)
          : null);

      if (membershipIdentifier) {
        clearActiveMembership(roomId, membershipIdentifier);
        socket.to(buildRoomChannel(roomId)).emit("presence", {
          type: "member:disconnected",
          roomId,
          membershipId: membershipIdentifier,
          timestamp: Date.now(),
        } satisfies PresenceMessage);
        emitPresenceUpdate({
          roomId,
          membershipId: membershipIdentifier,
          reason: "deleted",
        });
      }
    });
  });

  return io;
}

export function getRealtimeServer() {
  return ioInstance;
}

export function emitPresenceUpdate({
  roomId,
  membershipId,
  reason = "updated",
}: {
  roomId: string;
  membershipId?: string | null;
  reason?: PresenceRefreshReason;
}) {
  if (membershipId) {
    if (reason === "deleted") {
      clearActiveMembership(roomId, membershipId);
    } else {
      trackActiveMembership(roomId, membershipId);
    }
  }

  emitPresenceMessage({
    type: "refresh",
    roomId,
    membershipId: membershipId ?? undefined,
    reason,
    timestamp: Date.now(),
  });
}

export function emitRoomEvent(roomId: string, event: RoomEvent) {
  const server = ioInstance;
  if (!server) {
    return;
  }

  server.to(buildRoomChannel(roomId)).emit("room:event", event);
}

export function setRealtimeServerForTests(instance: Server | null) {
  ioInstance = instance;
}
