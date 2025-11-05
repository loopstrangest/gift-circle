import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  resolveIdentity,
} from "@/lib/identity";
import {
  collectMemberCommitments,
  renderMemberSummaryPdf,
} from "@/server/export-summary";

function withIdentityCookie(
  response: NextResponse,
  identity: Awaited<ReturnType<typeof resolveIdentity>>
) {
  if (identity.shouldSetCookie) {
    response.cookies.set(
      IDENTITY_COOKIE_NAME,
      identity.token,
      identityCookieAttributes(identity.payload.expiresAt)
    );
  }
  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;
  const roomCode = code?.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const cookie = request.cookies.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(cookie);

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: { host: true },
  });

  if (!room) {
    return withIdentityCookie(
      NextResponse.json({ error: "Room not found" }, { status: 404 }),
      identity
    );
  }

  if (room.currentRound !== "DECISIONS") {
    return withIdentityCookie(
      NextResponse.json(
        {
          error: "PDF export is only available during the Decisions round",
          message: `Room is currently in the ${room.currentRound} round`,
        },
        { status: 409 }
      ),
      identity
    );
  }

  const membership = await prisma.roomMembership.findUnique({
    where: {
      roomId_userId: {
        roomId: room.id,
        userId: identity.user.id,
      },
    },
    include: {
      user: true,
    },
  });

  if (!membership) {
    return withIdentityCookie(
      NextResponse.json(
        { error: "Not a member of this room" },
        { status: 403 }
      ),
      identity
    );
  }

  const commitments = await collectMemberCommitments(room.id, membership.id);

  const pdfBuffer = await renderMemberSummaryPdf({
    room,
    member: membership,
    commitments,
    generatedAt: new Date(),
  });

  const filename = `gift-circle-${room.code}-${membership.id}.pdf`;

  const response = new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(pdfBuffer).toString(),
    },
  });

  return withIdentityCookie(response, identity);
}


