import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { RoomSnapshot } from "@/lib/room-types";

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

  const snapshot: RoomSnapshot = {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    hostName: room.host.displayName ?? "Host",
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
          return (
            new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
          );
        }
        return a.role === "HOST" ? -1 : 1;
      }),
    updatedAt: room.updatedAt.toISOString(),
  };

  return NextResponse.json(snapshot);
}
