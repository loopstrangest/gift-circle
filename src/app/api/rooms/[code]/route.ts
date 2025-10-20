import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { RoomSnapshot } from "@/lib/room-types";
import { listActiveMemberships } from "@/server/realtime";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const roomCode = code?.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: {
      host: true,
      memberships: {
        include: { user: true },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const activeMemberships = listActiveMemberships(room.id);

  const snapshotMembers = room.memberships
    .filter((membership) => activeMemberships.has(membership.id))
    .map((membership) => {
      const activePresence = activeMemberships.get(membership.id);
      const presenceOrder =
        activePresence?.connectedAt ?? membership.createdAt.getTime();
      return {
        membershipId: membership.id,
        userId: membership.userId,
        displayName: membership.user.displayName,
        nickname: membership.nickname,
        role: membership.role,
        joinedAt: membership.createdAt.toISOString(),
        isActive: true,
        presenceOrder,
      } satisfies RoomSnapshot["members"][number] & { presenceOrder: number };
    })
    .sort((a, b) => {
      if (a.role === b.role) {
        if (a.isActive === b.isActive) {
          return a.presenceOrder - b.presenceOrder;
        }
        return a.isActive ? -1 : 1;
      }
      return a.role === "HOST" ? -1 : 1;
    })
    .map((member) => ({
      membershipId: member.membershipId,
      userId: member.userId,
      displayName: member.displayName,
      nickname: member.nickname,
      role: member.role,
      joinedAt: member.joinedAt,
      isActive: member.isActive,
    }));

  const snapshot: RoomSnapshot = {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    hostName: room.host.displayName ?? "Host",
    members: snapshotMembers,
    updatedAt: room.updatedAt.toISOString(),
  };

  return NextResponse.json(snapshot);
}
