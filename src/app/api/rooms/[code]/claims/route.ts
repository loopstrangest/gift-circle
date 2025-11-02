import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  resolveIdentity,
} from "@/lib/identity";
import {
  createClaim,
  listRoomClaims,
  toClaimSummary,
  updateClaimStatus,
} from "@/lib/room-claims";
import { emitRoomEvent } from "@/server/realtime";

const CreateClaimSchema = z
  .object({
    offerId: z.string().min(1).optional(),
    desireId: z.string().min(1).optional(),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((data) => data.offerId || data.desireId, {
    message: "Must provide offerId or desireId",
    path: ["offerId"],
  })
  .refine((data) => !(data.offerId && data.desireId), {
    message: "Cannot provide both offerId and desireId",
    path: ["offerId"],
  });

const WithdrawClaimSchema = z.object({
  status: z.literal("WITHDRAWN"),
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

async function findOffer(offerId: string) {
  return prisma.offer.findUnique({
    where: { id: offerId },
  });
}

async function findDesire(desireId: string) {
  return prisma.desire.findUnique({
    where: { id: desireId },
  });
}

function withIdentityCookie(response: NextResponse, identity: Awaited<ReturnType<typeof resolveIdentity>>) {
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

  const room = await resolveRoom(roomCode);
  if (!room) {
    return withIdentityCookie(
      NextResponse.json({ error: "Room not found" }, { status: 404 }),
      identity
    );
  }

  const membership = await ensureMembership(room.id, identity.user.id);
  if (!membership) {
    return withIdentityCookie(
      NextResponse.json({ error: "Not a member of this room" }, { status: 403 }),
      identity
    );
  }

  const claims = await listRoomClaims(room.id);
  return withIdentityCookie(
    NextResponse.json(claims.map(toClaimSummary)),
    identity
  );
}

export async function POST(
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

  const room = await resolveRoom(roomCode);
  if (!room) {
    return withIdentityCookie(
      NextResponse.json({ error: "Room not found" }, { status: 404 }),
      identity
    );
  }

  const membership = await ensureMembership(room.id, identity.user.id);
  if (!membership) {
    return withIdentityCookie(
      NextResponse.json({ error: "Not a member of this room" }, { status: 403 }),
      identity
    );
  }

  if (room.currentRound !== "CONNECTIONS") {
    return NextResponse.json(
      {
        error: "Cannot create claims outside of the Connections round",
        message: `Room is currently in the ${room.currentRound} round`,
      },
      { status: 409 }
    );
  }

  const parseResult = CreateClaimSchema.safeParse(
    await request.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  const payload = parseResult.data;

  const offerId = payload.offerId?.trim() ?? null;
  const desireId = payload.desireId?.trim() ?? null;

  if ((offerId ? 1 : 0) + (desireId ? 1 : 0) !== 1) {
    return NextResponse.json(
      { error: "Must provide exactly one of offerId or desireId" },
      { status: 400 }
    );
  }

  let targetRoomId: string | null = null;
  let targetAuthorMembershipId: string | null = null;
  let targetStatus: "OPEN" | "FULFILLED" | "WITHDRAWN" | null = null;

  if (offerId) {
    const offer = await findOffer(offerId);
    if (!offer || offer.roomId !== room.id) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }
    targetRoomId = offer.roomId;
    targetAuthorMembershipId = offer.authorMembershipId;
    targetStatus = offer.status;
  } else if (desireId) {
    const desire = await findDesire(desireId);
    if (!desire || desire.roomId !== room.id) {
      return NextResponse.json({ error: "Desire not found" }, { status: 404 });
    }
    targetRoomId = desire.roomId;
    targetAuthorMembershipId = desire.authorMembershipId;
    targetStatus = desire.status;
  }

  if (targetRoomId !== room.id) {
    return NextResponse.json({ error: "Target does not belong to this room" }, {
      status: 403,
    });
  }

  if (targetAuthorMembershipId === membership.id) {
    return NextResponse.json(
      { error: "Cannot create a claim on your own offer or desire" },
      { status: 403 }
    );
  }

  if (targetStatus !== "OPEN") {
    return NextResponse.json(
      { error: "Target is not currently open for new claims" },
      { status: 409 }
    );
  }

  const claim = await createClaim({
    roomId: room.id,
    claimerMembershipId: membership.id,
    offerId,
    desireId,
    note: payload.note?.trim() || null,
  });

  const summary = toClaimSummary(claim);

  emitRoomEvent(room.id, {
    type: "claim:created",
    roomId: room.id,
    claim: summary,
  });

  return withIdentityCookie(NextResponse.json(summary, { status: 201 }), identity);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const url = new URL(request.url);
  const claimId = url.searchParams.get("claimId");
  if (!claimId) {
    return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
  }

  const { code } = await context.params;
  const roomCode = code?.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const cookie = request.cookies.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(cookie);

  const room = await resolveRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const membership = await ensureMembership(room.id, identity.user.id);
  if (!membership) {
    return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
  }

  if (room.currentRound !== "CONNECTIONS") {
    return NextResponse.json(
      {
        error: "Cannot withdraw claims outside of the Connections round",
        message: `Room is currently in the ${room.currentRound} round`,
      },
      { status: 409 }
    );
  }

  const parseResult = WithdrawClaimSchema.safeParse(
    await request.json().catch(() => ({}))
  );

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!existing || existing.roomId !== room.id) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }

  if (existing.claimerMembershipId !== membership.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (existing.status !== "PENDING") {
    return NextResponse.json(
      { error: "Only pending claims can be withdrawn" },
      { status: 409 }
    );
  }

  const updated = await updateClaimStatus(claimId, "WITHDRAWN");
  const summary = toClaimSummary(updated);

  emitRoomEvent(room.id, {
    type: "claim:updated",
    roomId: room.id,
    claim: summary,
  });

  return NextResponse.json(summary);
}



