import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { generateRoomCode } from "@/lib/room-code";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  refreshIdentityToken,
  resolveIdentity,
  shouldRefreshIdentity,
  updateIdentityDisplayName,
} from "@/lib/identity";
import { emitPresenceUpdate } from "@/server/realtime";

const BodySchema = z.object({
  hostDisplayName: z.string().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
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

  const { hostDisplayName } = parseResult.data;
  const trimmedDisplayName = hostDisplayName?.trim() ?? null;

  if (trimmedDisplayName && trimmedDisplayName !== identity.user.displayName) {
    identity.user = await updateIdentityDisplayName(
      identity.user.id,
      trimmedDisplayName
    );
    refreshIdentityToken(identity);
  } else if (shouldRefreshIdentity(identity.payload)) {
    refreshIdentityToken(identity);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateCode = generateRoomCode();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const room = await tx.room.create({
          data: {
            code: candidateCode,
            hostId: identity.user.id,
          },
        });

        const membership = await tx.roomMembership.create({
          data: {
            roomId: room.id,
            userId: identity.user.id,
            role: "HOST",
            nickname: trimmedDisplayName ?? identity.user.displayName,
          },
        });

        return { room, membership };
      });

      emitPresenceUpdate({
        roomId: result.room.id,
        membershipId: result.membership.id,
        reason: "created",
      });

      const response = NextResponse.json(
        {
          room: {
            id: result.room.id,
            code: result.room.code,
            hostId: result.room.hostId,
          },
          host: {
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
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "string" &&
        error.code === "P2002"
      ) {
        continue;
      }

      console.error("rooms POST failed", error);
      const response = NextResponse.json(
        { error: "Failed to create room" },
        { status: 500 }
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
  }

  const response = NextResponse.json(
    { error: "Could not generate unique room code" },
    { status: 500 }
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
