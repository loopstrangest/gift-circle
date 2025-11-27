import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRoomSnapshot } from "@/app/rooms/[code]/room-status-data";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  if (!code || !isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
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
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Lazy deletion: if room has expired, delete it and return not found
  if (room.expiresAt && new Date() > room.expiresAt) {
    await prisma.room.delete({
      where: { id: room.id },
    });
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const snapshot = await getRoomSnapshot(room);

  return NextResponse.json(snapshot);
}
