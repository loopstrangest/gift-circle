import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  resolveIdentity,
} from "@/lib/identity";
import {
  createDesire,
  deleteDesire,
  listRoomDesires,
  updateDesire,
  toDesireSummary,
} from "@/lib/room-items";
import { emitRoomEvent } from "@/server/realtime";

const CreateDesireSchema = z.object({
  title: z.string().min(1).max(120),
  details: z.string().max(1000).optional().nullable(),
});

const UpdateDesireSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  details: z.string().max(1000).optional().nullable(),
  status: z.enum(["OPEN", "FULFILLED", "WITHDRAWN"]).optional(),
});

async function resolveRoom(code: string) {
  return prisma.room.findUnique({
    where: { code },
  });
}

async function ensureMembership(roomId: string, userId: string) {
  return prisma.roomMembership.findUnique({
    where: {
      roomId_userId: {
        roomId,
        userId,
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  if (!code || !isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await resolveRoom(normalizeRoomCode(code));
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const desires = await listRoomDesires(room.id);
  return NextResponse.json(desires.map(toDesireSummary));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  if (!code || !isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const cookie = request.cookies.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(cookie);

  const room = await resolveRoom(normalizeRoomCode(code));
  if (!room) {
    const response = NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (identity.shouldSetCookie) {
      response.cookies.set(
        IDENTITY_COOKIE_NAME,
        identity.token,
        identityCookieAttributes(identity.payload.expiresAt)
      );
    }
    return response;
  }

  const membership = await ensureMembership(room.id, identity.user.id);
  if (!membership) {
    const response = NextResponse.json(
      { error: "Not a member of this room" },
      { status: 403 }
    );
    if (identity.shouldSetCookie) {
      response.cookies.set(
        IDENTITY_COOKIE_NAME,
        identity.token,
        identityCookieAttributes(identity.payload.expiresAt)
      );
    }
    return response;
  }

  if (room.currentRound !== "DESIRES") {
    return NextResponse.json(
      {
        error: "Cannot create desires outside of the Desires round",
        message: `Room is currently in the ${room.currentRound} round`,
      },
      { status: 409 }
    );
  }

  const parseResult = CreateDesireSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  const desire = await createDesire({
    roomId: room.id,
    authorMembershipId: membership.id,
    title: parseResult.data.title.trim(),
    details: parseResult.data.details?.trim() || null,
  });

  emitRoomEvent(room.id, {
    type: "desire:created",
    roomId: room.id,
    desire: toDesireSummary(desire),
  });

  const response = NextResponse.json(toDesireSummary(desire), { status: 201 });
  if (identity.shouldSetCookie) {
    response.cookies.set(
      IDENTITY_COOKIE_NAME,
      identity.token,
      identityCookieAttributes(identity.payload.expiresAt)
    );
  }
  return response;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const url = new URL(request.url);
  const desireId = url.searchParams.get("desireId");
  if (!desireId) {
    return NextResponse.json({ error: "Missing desireId" }, { status: 400 });
  }

  const { code } = await context.params;
  if (!code || !isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const cookie = request.cookies.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(cookie);

  const room = await resolveRoom(normalizeRoomCode(code));
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const membership = await ensureMembership(room.id, identity.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  if (room.currentRound !== "DESIRES") {
    return NextResponse.json(
      {
        error: "Cannot update desires outside of the Desires round",
        message: `Room is currently in the ${room.currentRound} round`,
      },
      { status: 409 }
    );
  }

  const existing = await prisma.desire.findUnique({ where: { id: desireId } });
  if (!existing || existing.roomId !== room.id) {
    return NextResponse.json({ error: "Desire not found" }, { status: 404 });
  }

  if (existing.authorMembershipId !== membership.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const parseResult = UpdateDesireSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const updated = await updateDesire(desireId, {
    title: data.title?.trim(),
    details:
      data.details === undefined
        ? undefined
        : data.details === null
          ? null
          : data.details.trim(),
    status: data.status,
  });

  emitRoomEvent(room.id, {
    type: "desire:updated",
    roomId: room.id,
    desire: toDesireSummary(updated),
  });

  return NextResponse.json(toDesireSummary(updated));
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const url = new URL(request.url);
  const desireId = url.searchParams.get("desireId");
  if (!desireId) {
    return NextResponse.json({ error: "Missing desireId" }, { status: 400 });
  }

  const { code } = await context.params;
  if (!code || !isValidRoomCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const cookie = request.cookies.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(cookie);

  const room = await resolveRoom(normalizeRoomCode(code));
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const membership = await ensureMembership(room.id, identity.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  if (room.currentRound !== "DESIRES") {
    return NextResponse.json(
      {
        error: "Cannot delete desires outside of the Desires round",
        message: `Room is currently in the ${room.currentRound} round`,
      },
      { status: 409 }
    );
  }

  const existing = await prisma.desire.findUnique({ where: { id: desireId } });
  if (!existing || existing.roomId !== room.id) {
    return NextResponse.json({ error: "Desire not found" }, { status: 404 });
  }

  if (existing.authorMembershipId !== membership.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await deleteDesire(desireId);

  emitRoomEvent(room.id, {
    type: "desire:deleted",
    roomId: room.id,
    desireId,
  });

  return NextResponse.json({ success: true });
}
