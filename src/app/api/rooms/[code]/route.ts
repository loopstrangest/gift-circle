import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getRoomSnapshot } from "@/app/rooms/[code]/room-status-data";

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
      offers: true,
      desires: true,
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const snapshot = await getRoomSnapshot(room);

  return NextResponse.json(snapshot);
}
