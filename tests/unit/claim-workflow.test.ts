import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  GET as listClaimsRoute,
  POST as createClaimRoute,
  PATCH as updateClaimRoute,
} from "@/app/api/rooms/[code]/claims/route";
import { prisma } from "@/lib/prisma";
import { createClaim, listRoomClaims, updateClaimStatus, toClaimSummary } from "@/lib/room-claims";

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
    },
    desire: {
      findUnique: vi.fn(),
    },
    claim: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/identity", () => ({
  IDENTITY_COOKIE_NAME: "identity",
  identityCookieAttributes: () => ({}),
  resolveIdentity: vi.fn().mockResolvedValue({
    token: "token",
    shouldSetCookie: false,
    user: { id: "user-1" },
    payload: { expiresAt: Date.now() + 1000 },
  }),
}));

vi.mock("@/lib/room-claims", async () => {
  const actual = await vi.importActual<typeof import("@/lib/room-claims")>("@/lib/room-claims");
  return {
    ...actual,
    listRoomClaims: vi.fn(),
    createClaim: vi.fn(),
    updateClaimStatus: vi.fn(),
    toClaimSummary: vi.fn((claim) => actual.toClaimSummary(claim as never)),
  };
});

vi.mock("@/server/realtime", () => ({
  emitRoomEvent: vi.fn(),
}));

function buildRequest(method: string, body?: unknown, query: string = "") {
  return new NextRequest(`http://localhost/api/rooms/ABC123/claims${query}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function setRoom({ round = "CONNECTIONS" }: { round?: string } = {}) {
  (prisma.room.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "room-1",
    code: "ABC123",
    currentRound: round,
  } as never);
}

function setMembership(found = true) {
  (prisma.roomMembership.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
    found
      ? ({
          id: "membership-1",
          roomId: "room-1",
          userId: "user-1",
          role: "PARTICIPANT",
        } as never)
      : null
  );
}

describe("claims API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRoom();
    setMembership();
    (listRoomClaims as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createClaim as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "claim-1",
      roomId: "room-1",
      claimerMembershipId: "membership-1",
      offerId: "offer-1",
      desireId: null,
      status: "PENDING",
      note: null,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    });
    (updateClaimStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "claim-1",
      roomId: "room-1",
      claimerMembershipId: "membership-1",
      offerId: "offer-1",
      desireId: null,
      status: "WITHDRAWN",
      note: null,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:05:00.000Z"),
    });
    (prisma.offer.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "offer-1",
      roomId: "room-1",
      authorMembershipId: "membership-2",
      status: "OPEN",
    } as never);
    (prisma.desire.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma.claim.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "claim-1",
      roomId: "room-1",
      claimerMembershipId: "membership-1",
      offerId: "offer-1",
      desireId: null,
      status: "PENDING",
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  it("lists claims for room members", async () => {
    (listRoomClaims as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "claim-1",
        roomId: "room-1",
        claimerMembershipId: "membership-2",
        offerId: "offer-1",
        desireId: null,
        status: "PENDING",
        note: null,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:01:00.000Z"),
      },
    ]);

    const response = await listClaimsRoute(buildRequest("GET"), {
      params: Promise.resolve({ code: "ABC123" }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { id: string }[];
    expect(payload).toHaveLength(1);
    expect(payload[0].id).toBe("claim-1");
  });

  it("prevents creating claims outside Connections round", async () => {
    setRoom({ round: "DESIRES" });

    const response = await createClaimRoute(
      buildRequest("POST", { offerId: "offer-1" }),
      { params: Promise.resolve({ code: "ABC123" }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Cannot create claims"),
    });
  });

  it("blocks claims on own offers", async () => {
    (prisma.offer.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "offer-1",
      roomId: "room-1",
      authorMembershipId: "membership-1",
      status: "OPEN",
    } as never);

    const response = await createClaimRoute(
      buildRequest("POST", { offerId: "offer-1" }),
      { params: Promise.resolve({ code: "ABC123" }) }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Cannot create a claim on your own"),
    });
  });

  it("creates a claim for open offers", async () => {
    const response = await createClaimRoute(
      buildRequest("POST", { offerId: "offer-1", note: "Excited" }),
      { params: Promise.resolve({ code: "ABC123" }) }
    );

    expect(response.status).toBe(201);
    expect(createClaim).toHaveBeenCalledWith({
      roomId: "room-1",
      claimerMembershipId: "membership-1",
      offerId: "offer-1",
      desireId: null,
      note: "Excited",
    });
    const payload = await response.json();
    expect(payload).toMatchObject({ id: "claim-1", status: "PENDING" });
    expect(toClaimSummary).toHaveBeenCalled();
  });

  it("withdraws pending claims during Connections", async () => {
    const response = await updateClaimRoute(
      buildRequest("PATCH", { status: "WITHDRAWN" }, "?claimId=claim-1"),
      { params: Promise.resolve({ code: "ABC123" }) }
    );

    expect(response.status).toBe(200);
    expect(updateClaimStatus).toHaveBeenCalledWith("claim-1", "WITHDRAWN");
    const payload = await response.json();
    expect(payload).toMatchObject({ status: "WITHDRAWN" });
  });

  it("only allows withdrawing pending claims", async () => {
    (prisma.claim.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "claim-1",
      roomId: "room-1",
      claimerMembershipId: "membership-1",
      offerId: "offer-1",
      desireId: null,
      status: "ACCEPTED",
      note: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const response = await updateClaimRoute(
      buildRequest("PATCH", { status: "WITHDRAWN" }, "?claimId=claim-1"),
      { params: Promise.resolve({ code: "ABC123" }) }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Only pending claims"),
    });
    expect(updateClaimStatus).not.toHaveBeenCalled();
  });
});



