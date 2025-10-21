import type { Desire, Offer, Room, RoomMembership, User } from "@prisma/client";

import { RoomSnapshot } from "@/lib/room-types";
import { toDesireSummary, toOfferSummary } from "@/lib/room-items";
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

function mapOffers(offers: Offer[]): RoomSnapshot["offers"] {
  return offers
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((offer) => toOfferSummary(offer));
}

function mapDesires(desires: Desire[]): RoomSnapshot["desires"] {
  return desires
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((desire) => toDesireSummary(desire));
}

export function buildSnapshot(
  room: Room & {
    host: User;
    memberships: (RoomMembership & { user: User })[];
    offers: Offer[];
    desires: Desire[];
  }
): RoomSnapshot {
  const activeMemberships = listActiveMemberships(room.id);

  const members = sortMembers(
    room.memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      displayName: membership.user.displayName,
      nickname: membership.nickname,
      role: membership.role,
      joinedAt: membership.createdAt.toISOString(),
      isActive: activeMemberships.has(membership.id),
    }))
  );

  const hostName = room.host.displayName ?? "Host";

  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    hostName,
    members,
    updatedAt: room.updatedAt.toISOString(),
    offers: mapOffers(room.offers),
    desires: mapDesires(room.desires),
  };
}

export async function getRoomSnapshot(
  room: Room & {
    host: User;
    memberships: (RoomMembership & { user: User })[];
    offers: Offer[];
    desires: Desire[];
  }
) {
  return buildSnapshot(room);
}
