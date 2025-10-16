import type { Room, RoomMembership, User } from "@prisma/client";

import { RoomSnapshot } from "@/lib/room-types";

export function buildSnapshot(
  room: Room & {
    host: User;
    memberships: (RoomMembership & { user: User })[];
  }
): RoomSnapshot {
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    hostName: room.host.displayName,
    members: room.memberships
      .map((membership) => ({
        membershipId: membership.id,
        userId: membership.userId,
        displayName: membership.user.displayName,
        nickname: membership.nickname,
        role: membership.role,
        joinedAt: membership.createdAt.toISOString(),
      }))
      .sort((a, b) => {
        if (a.role === b.role) {
          return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        }
        return a.role === "HOST" ? -1 : 1;
      }),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function getRoomSnapshot(
  room: Room & {
    host: User;
    memberships: (RoomMembership & { user: User })[];
  }
) {
  return buildSnapshot(room);
}
