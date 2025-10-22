import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  refreshIdentityToken,
  resolveIdentity,
  shouldRefreshIdentity,
} from "@/lib/identity";
import { getNextRound } from "@/lib/room-round";
import { getRoomSnapshot } from "@/app/rooms/[code]/room-status-data";
import { emitPresenceUpdate, emitRoomEvent } from "@/server/realtime";

const ParamsSchema = z.object({
  code: z.string().min(6).max(6),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const rawParams = await context.params;
  const parseParams = ParamsSchema.safeParse(rawParams);

  if (!parseParams.success) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const roomCode = parseParams.data.code.toUpperCase();

  const identity = await resolveIdentity(
    request.cookies.get(IDENTITY_COOKIE_NAME)?.value
  );

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

  const callerMembership = room.memberships.find(
    (membership) => membership.userId === identity.user.id
  );

  if (!callerMembership || callerMembership.role !== "HOST") {
    return NextResponse.json(
      { error: "Only the host can advance the room" },
      { status: 403 }
    );
  }

  const nextRound = getNextRound(room.currentRound);
  if (!nextRound) {
    return NextResponse.json(
      { error: "Room is already in the final round" },
      { status: 400 }
    );
  }

  if (shouldRefreshIdentity(identity.payload)) {
    refreshIdentityToken(identity);
  }

  const updatedRoom = await prisma.room.update({
    where: { id: room.id },
    data: { currentRound: nextRound },
    include: {
      host: true,
      memberships: {
        include: { user: true },
      },
      offers: true,
      desires: true,
    },
  });

  emitRoomEvent(updatedRoom.id, {
    type: "round:changed",
    roomId: updatedRoom.id,
    round: nextRound,
  });

  emitPresenceUpdate({ roomId: updatedRoom.id, reason: "updated" });

  const snapshot = await getRoomSnapshot(updatedRoom);

  const response = NextResponse.json(snapshot, { status: 200 });
  if (identity.shouldSetCookie) {
    response.cookies.set(
      IDENTITY_COOKIE_NAME,
      identity.token,
      identityCookieAttributes(identity.payload.expiresAt)
    );
  }
  return response;
}
