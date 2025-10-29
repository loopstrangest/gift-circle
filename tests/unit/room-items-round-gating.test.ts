import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { POST as createOfferRoute } from "@/app/api/rooms/[code]/offers/route";
import { POST as createDesireRoute } from "@/app/api/rooms/[code]/desires/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    room: {
      findUnique: vi.fn(),
    },
    roomMembership: {
      findUnique: vi.fn(),
    },
    offer: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    desire: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/identity", () => {
  return {
    IDENTITY_COOKIE_NAME: "identity",
    identityCookieAttributes: () => ({}),
    resolveIdentity: vi.fn().mockResolvedValue({
      token: "token",
      shouldSetCookie: false,
      user: { id: "user-1", displayName: "User" },
      payload: { expiresAt: Date.now() + 1000 },
    }),
  };
});

vi.mock("@/lib/room-items", () => ({
  createOffer: vi.fn(),
  createDesire: vi.fn(),
}));

vi.mock("@/server/realtime", () => ({
  emitRoomEvent: vi.fn(),
}));

function buildNextRequest(body: unknown) {
  return new NextRequest("http://localhost", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("round gating for room item mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects creating offers when room is not in OFFERS round", async () => {
    (prisma.room.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "room-1",
      code: "ROOM01",
      currentRound: "WAITING",
    } as never);

    (
      prisma.roomMembership.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "membership-1",
    } as never);

    const response = await createOfferRoute(
      buildNextRequest({ title: "A", details: "" }),
      {
        params: Promise.resolve({ code: "ROOM01" }),
      }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Cannot create offers"),
    });
  });

  it("rejects creating desires when room is not in DESIRES round", async () => {
    (prisma.room.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "room-1",
      code: "ROOM01",
      currentRound: "OFFERS",
    } as never);

    (
      prisma.roomMembership.findUnique as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "membership-1",
    } as never);

    const response = await createDesireRoute(
      buildNextRequest({ title: "A", details: "" }),
      {
        params: Promise.resolve({ code: "ROOM01" }),
      }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Cannot create desires"),
    });
  });
});
