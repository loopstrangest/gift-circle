import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { generateRoomCode } from "@/lib/room-code";

const BodySchema = z.object({
  hostDisplayName: z.string().min(1).max(64).optional(),
});

export async function POST(request: NextRequest) {
  const parseResult = BodySchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  const { hostDisplayName } = parseResult.data;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateCode = generateRoomCode();
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            displayName: hostDisplayName,
          },
        });

        const room = await tx.room.create({
          data: {
            code: candidateCode,
            hostId: user.id,
          },
        });

        const membership = await tx.roomMembership.create({
          data: {
            roomId: room.id,
            userId: user.id,
            role: "HOST",
            nickname: hostDisplayName,
          },
        });

        return { room, user, membership };
      });

      return NextResponse.json(
        {
          room: {
            id: result.room.id,
            code: result.room.code,
            hostId: result.room.hostId,
          },
          host: {
            id: result.user.id,
            displayName: result.user.displayName,
          },
          membership: {
            id: result.membership.id,
            role: result.membership.role,
            nickname: result.membership.nickname,
          },
        },
        { status: 201 }
      );
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
      return NextResponse.json(
        { error: "Failed to create room" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Could not generate unique room code" },
    { status: 500 }
  );
}
