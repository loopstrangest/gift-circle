import { redirect, notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getRoomSnapshot } from "@/app/rooms/[code]/room-status-data";
import type { RoomSnapshot } from "@/lib/room-types";

type ParamsInput = { code: string };
type SearchParamsInput = Record<string, string | string[] | undefined>;

export type LoadedRoomData = {
  snapshot: RoomSnapshot;
  membershipId: string | null;
};

export async function loadRoomRouteData({
  params,
  searchParams,
  userId,
}: {
  params: ParamsInput;
  searchParams?: SearchParamsInput;
  userId?: string | null;
}): Promise<LoadedRoomData> {
  const { code } = params;
  const query = searchParams ?? {};

  const membershipIdFromQuery = Array.isArray(query.membershipId)
    ? (query.membershipId[0] ?? null)
    : ((query.membershipId as string | undefined) ?? null);

  const roomCode = code?.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    notFound();
  }

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: {
      host: true,
      memberships: {
        include: { user: true },
      },
      offers: true,
      desires: true,
      claims: true,
    },
  });

  if (!room) {
    notFound();
  }

  let resolvedMembershipId: string | null = membershipIdFromQuery;

  if (membershipIdFromQuery) {
    const membershipExists = room.memberships.some(
      (membership) => membership.id === membershipIdFromQuery
    );
    if (!membershipExists) {
      redirect(`/rooms/${room.code}`);
    }
  }

  if (!resolvedMembershipId && userId) {
    const matchingMembership = room.memberships.find(
      (membership) => membership.userId === userId
    );
    if (matchingMembership) {
      resolvedMembershipId = matchingMembership.id;
    }
  }

  const snapshot = await getRoomSnapshot(room);

  return { snapshot, membershipId: resolvedMembershipId };
}
