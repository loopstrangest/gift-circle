import type { Room, RoomMembership, User } from "@prisma/client";

import { RoomSnapshot } from "@/lib/room-types";
import { listActiveMemberships } from "@/server/realtime";

function sortMembers(members: RoomSnapshot["members"]) {
  return [...members].sort((a, b) => {
    if (a.role === b.role) {
      if (a.isActive === b.isActive) {
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      }
      return a.isActive ? -1 : 1;
    }
    return a.role === "HOST" ? -1 : 1;
  });
}

export function buildSnapshot(
  room: Room & {
    host: User;
    memberships: (RoomMembership & { user: User })[];
  }
): RoomSnapshot {
  const activeMemberships = listActiveMemberships(room.id);

  const members = sortMembers(
    room.memberships
      .filter((membership) => activeMemberships.has(membership.id))
      .map((membership) => ({
        membershipId: membership.id,
        userId: membership.userId,
        displayName: membership.user.displayName,
        nickname: membership.nickname,
        role: membership.role,
        joinedAt: membership.createdAt.toISOString(),
        isActive: true,
      }))
  );

  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    hostName: room.host.displayName,
    members,
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
