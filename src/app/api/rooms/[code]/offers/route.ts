import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  resolveIdentity,
} from "@/lib/identity";
import {
  createOffer,
  deleteOffer,
  listRoomOffers,
  updateOffer,
  toOfferSummary,
} from "@/lib/room-items";
import { emitRoomEvent } from "@/server/realtime";

const CreateOfferSchema = z.object({
  title: z.string().min(1).max(120),
  details: z.string().max(1000).optional().nullable(),
});

const UpdateOfferSchema = z.object({
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
  const roomCode = code?.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  const room = await resolveRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const offers = await listRoomOffers(room.id);
  return NextResponse.json(offers.map(toOfferSummary));
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

  const parseResult = CreateOfferSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  const offer = await createOffer({
    roomId: room.id,
    authorMembershipId: membership.id,
    title: parseResult.data.title.trim(),
    details: parseResult.data.details?.trim() || null,
  });

  emitRoomEvent(room.id, {
    type: "offer:created",
    roomId: room.id,
    offer: toOfferSummary(offer),
  });

  const response = NextResponse.json(toOfferSummary(offer), { status: 201 });
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
  const offerId = url.searchParams.get("offerId");
  if (!offerId) {
    return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
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

  const existing = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!existing || existing.roomId !== room.id) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (existing.authorMembershipId !== membership.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const parseResult = UpdateOfferSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parseResult.error.issues },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const updated = await updateOffer(offerId, {
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
    type: "offer:updated",
    roomId: room.id,
    offer: toOfferSummary(updated),
  });

  return NextResponse.json(toOfferSummary(updated));
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const url = new URL(request.url);
  const offerId = url.searchParams.get("offerId");
  if (!offerId) {
    return NextResponse.json({ error: "Missing offerId" }, { status: 400 });
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

  const existing = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!existing || existing.roomId !== room.id) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  if (existing.authorMembershipId !== membership.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  await deleteOffer(offerId);

  emitRoomEvent(room.id, {
    type: "offer:deleted",
    roomId: room.id,
    offerId,
  });

  return NextResponse.json({ success: true });
}
