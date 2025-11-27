import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  refreshIdentityToken,
  resolveIdentity,
  shouldRefreshIdentity,
} from "@/lib/identity";
import { getRoomSnapshot } from "@/app/rooms/[code]/room-status-data";
import { emitPresenceUpdate, emitRoomEvent } from "@/server/realtime";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  if (!code || !isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const roomCode = normalizeRoomCode(code);

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
      claims: true,
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const callerMembership = room.memberships.find(
    (membership: (typeof room.memberships)[number]) =>
      membership.userId === identity.user.id
  );

  if (!callerMembership || callerMembership.role !== "HOST") {
    return NextResponse.json(
      { error: "Only the host can update the room title" },
      { status: 403 }
    );
  }

  if (room.currentRound !== "WAITING") {
    return NextResponse.json(
      { error: "Room title can only be changed during the WAITING round" },
      { status: 400 }
    );
  }

  let body: { title?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const title = body.title === undefined ? room.title : body.title;
  const trimmedTitle = typeof title === "string" ? title.trim() || null : null;

  if (shouldRefreshIdentity(identity.payload)) {
    refreshIdentityToken(identity);
  }

  const updatedRoom = await prisma.room.update({
    where: { id: room.id },
    data: { title: trimmedTitle },
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

  emitRoomEvent(updatedRoom.id, {
    type: "room:updated",
    roomId: updatedRoom.id,
    title: updatedRoom.title,
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
