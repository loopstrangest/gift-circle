import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  refreshIdentityToken,
  resolveIdentity,
  shouldRefreshIdentity,
  updateIdentityDisplayName,
} from "@/lib/identity";
import { emitPresenceUpdate, listActiveMemberships } from "@/server/realtime";

const BodySchema = z.object({
  displayName: z.string().min(1).max(64),
});

export async function POST(
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

  const parseResult = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parseResult.success) {
    const response = NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
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

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: {
      memberships: {
        include: { user: true },
      },
    },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const trimmedDisplayName = parseResult.data.displayName.trim();

  const existingMembership = room.memberships.find(
    (membership: (typeof room.memberships)[number]) =>
      membership.userId === identity.user.id
  );

  if (existingMembership) {
    const activeMemberships = listActiveMemberships(room.id);
    const isActive = activeMemberships.has(existingMembership.id);

    if (!isActive) {
      await prisma.roomMembership.update({
        where: { id: existingMembership.id },
        data: {
          updatedAt: new Date(),
        },
      });

      emitPresenceUpdate({
        roomId: room.id,
        membershipId: existingMembership.id,
        reason: "updated",
      });
    }

    const response = NextResponse.json(
      {
        room: {
          id: room.id,
          code: room.code,
          hostId: room.hostId,
          currentRound: room.currentRound,
        },
        user: {
          id: identity.user.id,
          displayName: identity.user.displayName,
        },
        membership: {
          id: existingMembership.id,
          role: existingMembership.role,
          nickname: existingMembership.nickname,
        },
      },
      { status: 200 }
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

  if (!identity.user.displayName && trimmedDisplayName) {
    identity.user = await updateIdentityDisplayName(
      identity.user.id,
      trimmedDisplayName
    );
    refreshIdentityToken(identity);
  } else if (
    identity.user.displayName &&
    identity.user.displayName !== trimmedDisplayName &&
    trimmedDisplayName
  ) {
    if (shouldRefreshIdentity(identity.payload)) {
      refreshIdentityToken(identity);
    }
  } else if (shouldRefreshIdentity(identity.payload)) {
    refreshIdentityToken(identity);
  }

  const matchingHostMembership = room.memberships.find((membership: (typeof room.memberships)[number]) => {
    if (membership.role !== "HOST") {
      return false;
    }
    const membershipName = membership.nickname ?? membership.user.displayName;
    return membershipName?.trim().toLowerCase() === trimmedDisplayName.toLowerCase();
  });

  if (matchingHostMembership && matchingHostMembership.userId !== identity.user.id) {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedMembership = await tx.roomMembership.update({
        where: { id: matchingHostMembership.id },
        data: {
          userId: identity.user.id,
          nickname: trimmedDisplayName,
        },
      });

      await tx.room.update({
        where: { id: room.id },
        data: { hostId: identity.user.id },
      });

      return { membership: updatedMembership };
    });

    await emitPresenceUpdate({
      roomId: room.id,
      membershipId: result.membership.id,
      reason: "reassigned",
    });

    const response = NextResponse.json(
      {
        room: {
          id: room.id,
          code: room.code,
          hostId: identity.user.id,
          currentRound: room.currentRound,
        },
        user: {
          id: identity.user.id,
          displayName: identity.user.displayName,
        },
        membership: {
          id: result.membership.id,
          role: result.membership.role,
          nickname: result.membership.nickname,
        },
      },
      { status: 200 }
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

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const membership = await tx.roomMembership.create({
      data: {
        roomId: room.id,
        userId: identity.user.id,
        nickname: trimmedDisplayName,
      },
    });

    return { membership };
  });

  await emitPresenceUpdate({
    roomId: room.id,
    membershipId: result.membership.id,
    reason: "created",
  });

  const response = NextResponse.json(
    {
      room: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
        currentRound: room.currentRound,
      },
      user: {
        id: identity.user.id,
        displayName: identity.user.displayName,
      },
      membership: {
        id: result.membership.id,
        role: result.membership.role,
        nickname: result.membership.nickname,
      },
    },
    { status: 201 }
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
