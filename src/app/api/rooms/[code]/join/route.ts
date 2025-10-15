import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  refreshIdentityToken,
  resolveIdentity,
  shouldRefreshIdentity,
  updateIdentityDisplayName,
} from "@/lib/identity";

const BodySchema = z.object({
  displayName: z.string().min(1).max(64),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const roomCode = code?.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const identity = await resolveIdentity(
    request.cookies.get(IDENTITY_COOKIE_NAME)?.value
  );

  const parseResult = BodySchema.safeParse(
    await request.json().catch(() => ({}))
  );
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
    (membership) => membership.userId === identity.user.id
  );

  if (existingMembership) {
    const response = NextResponse.json(
      {
        room: {
          id: room.id,
          code: room.code,
          hostId: room.hostId,
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
    // Keep the existing identity display name; just refresh if needed so the cookie stays valid.
    if (shouldRefreshIdentity(identity.payload)) {
      refreshIdentityToken(identity);
    }
  } else if (shouldRefreshIdentity(identity.payload)) {
    refreshIdentityToken(identity);
  }

  const matchingHostMembership = room.memberships.find((membership) => {
    if (membership.role !== "HOST") {
      return false;
    }
    const membershipName = membership.nickname ?? membership.user.displayName;
    return (
      membershipName?.trim().toLowerCase() === trimmedDisplayName.toLowerCase()
    );
  });

  if (
    matchingHostMembership &&
    matchingHostMembership.userId !== identity.user.id
  ) {
    const result = await prisma.$transaction(async (tx) => {
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

    const response = NextResponse.json(
      {
        room: {
          id: room.id,
          code: room.code,
          hostId: identity.user.id,
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

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.roomMembership.create({
      data: {
        roomId: room.id,
        userId: identity.user.id,
        nickname: trimmedDisplayName,
      },
    });

    return { membership };
  });

  const response = NextResponse.json(
    {
      room: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
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
