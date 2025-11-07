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

const LOG_PREFIX = "[pdf-export]";

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
  console.log(LOG_PREFIX, "export route request", { roomCode });
  if (!roomCode || roomCode.length !== 6) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const cookie = request.cookies.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(cookie);
  console.log(LOG_PREFIX, "resolved identity", {
    userId: identity.user.id,
    shouldSetCookie: identity.shouldSetCookie,
  });

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: { host: true },
  });

  if (!room) {
    console.warn(LOG_PREFIX, "room not found", { roomCode });
    return withIdentityCookie(
      NextResponse.json({ error: "Room not found" }, { status: 404 }),
      identity
    );
  }

  if (room.currentRound !== "DECISIONS") {
    console.warn(LOG_PREFIX, "room not in decisions round", {
      roomId: room.id,
      currentRound: room.currentRound,
    });
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
    console.warn(LOG_PREFIX, "membership not found", {
      roomId: room.id,
      userId: identity.user.id,
    });
    return withIdentityCookie(
      NextResponse.json({ error: "Not a member of this room" }, { status: 403 }),
      identity
    );
  }

  console.log(LOG_PREFIX, "collecting commitments", {
    roomId: room.id,
    membershipId: membership.id,
  });
  const commitments = await collectMemberCommitments(room.id, membership.id);
  console.log(LOG_PREFIX, "commitments collected", {
    giving: commitments.giving.length,
    receiving: commitments.receiving.length,
  });

  let pdfBuffer: Buffer;
  try {
    console.log(LOG_PREFIX, "rendering PDF", {
      roomId: room.id,
      membershipId: membership.id,
    });
    pdfBuffer = await renderMemberSummaryPdf({
      member: membership,
      commitments,
      generatedAt: new Date(),
    });
    console.log(LOG_PREFIX, "PDF rendered", {
      byteLength: pdfBuffer.byteLength,
    });
  } catch (error) {
    console.error(
      "Failed to render member summary PDF",
      {
        roomId: room.id,
        roomCode: room.code,
        membershipId: membership.id,
      },
      error
    );

    return withIdentityCookie(
      NextResponse.json(
        {
          error: "Failed to generate PDF",
          message: "An unexpected error occurred while rendering the report.",
        },
        { status: 500 }
      ),
      identity
    );
  }

  const filename = `gift-circle-${room.code}-${membership.id}.pdf`;

  const response = new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "Content-Length": Buffer.byteLength(pdfBuffer).toString(),
    },
  });

  console.log(LOG_PREFIX, "sending PDF response", {
    filename,
    byteLength: pdfBuffer.byteLength,
  });

  return withIdentityCookie(response, identity);
}
