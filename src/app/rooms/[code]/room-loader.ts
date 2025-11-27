import { redirect, notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getRoomSnapshot } from "@/app/rooms/[code]/room-status-data";
import type { RoomSnapshot } from "@/lib/room-types";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

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

  if (!code || !isValidRoomCode(code)) {
    notFound();
  }

  const roomCode = normalizeRoomCode(code);

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
      (membership: (typeof room.memberships)[number]) =>
        membership.id === membershipIdFromQuery
    );
    if (!membershipExists) {
      redirect(`/rooms/${room.code}`);
    }
  }

  if (!resolvedMembershipId && userId) {
    const matchingMembership = room.memberships.find(
      (membership: (typeof room.memberships)[number]) => membership.userId === userId
    );
    if (matchingMembership) {
      resolvedMembershipId = matchingMembership.id;
    }
  }

  const snapshot = await getRoomSnapshot(room);

  return { snapshot, membershipId: resolvedMembershipId };
}
