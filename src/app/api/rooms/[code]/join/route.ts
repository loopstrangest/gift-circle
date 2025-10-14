import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

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

  const parseResult = BodySchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
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

  const existingMembership = room.memberships.find(
    (membership) => membership.user.displayName === parseResult.data.displayName
  );

  if (existingMembership) {
    return NextResponse.json(
      {
        room: {
          id: room.id,
          code: room.code,
          hostId: room.hostId,
        },
        user: {
          id: existingMembership.userId,
          displayName: existingMembership.user.displayName,
        },
        membership: {
          id: existingMembership.id,
          role: existingMembership.role,
          nickname: existingMembership.nickname,
        },
      },
      { status: 200 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        displayName: parseResult.data.displayName,
      },
    });

    const membership = await tx.roomMembership.create({
      data: {
        roomId: room.id,
        userId: user.id,
        nickname: parseResult.data.displayName,
      },
    });

    return { user, membership };
  });

  return NextResponse.json(
    {
      room: {
        id: room.id,
        code: room.code,
        hostId: room.hostId,
      },
      user: {
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
}
