import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    room: {
      findUnique: vi.fn(),
    },
    roomMembership: {
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
    user: { id: "user-1", displayName: "User" },
    payload: { expiresAt: Date.now() + 1000 },
  }),
}));

vi.mock("@/server/export-summary", () => ({
  collectMemberCommitments: vi.fn().mockResolvedValue({
    giving: [],
    receiving: [],
  }),
  renderMemberSummaryPdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
}));

const { prisma } = await import("@/lib/prisma");
const { resolveIdentity } = await import("@/lib/identity");
const { collectMemberCommitments, renderMemberSummaryPdf } = await import("@/server/export-summary");

const { GET } = await import("@/app/api/rooms/[code]/export/route");

function buildRequest() {
  return new NextRequest("http://localhost/api/rooms/ROOM01/export", {
    method: "GET",
  });
}

describe("rooms export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when the room is not in the Decisions round", async () => {
    (prisma.room.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "room-1",
      code: "ROOM01",
      currentRound: "CONNECTIONS",
      host: { displayName: "Host" },
    } as never);

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ code: "ROOM01" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("only available during the Decisions round"),
    });
  });

  it("returns 403 when the membership does not exist for the user", async () => {
    (prisma.room.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "room-1",
      code: "ROOM01",
      currentRound: "DECISIONS",
      host: { displayName: "Host" },
    } as never);
    (prisma.roomMembership.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ code: "ROOM01" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("Not a member"),
    });
  });

  it("returns a PDF payload for valid requests", async () => {
    const now = new Date();

    (prisma.room.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "room-1",
      code: "ROOM01",
      currentRound: "DECISIONS",
      hostId: "user-host",
      host: { id: "user-host", displayName: "Host", createdAt: now, updatedAt: now },
    } as never);
    (prisma.roomMembership.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "membership-1",
      roomId: "room-1",
      userId: "user-1",
      role: "PARTICIPANT",
      nickname: null,
      createdAt: now,
      updatedAt: now,
      user: { id: "user-1", displayName: "User", createdAt: now, updatedAt: now },
    } as never);

    const response = await GET(buildRequest(), {
      params: Promise.resolve({ code: "ROOM01" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(await response.arrayBuffer()).toBeInstanceOf(ArrayBuffer);
    expect(collectMemberCommitments).toHaveBeenCalledWith("room-1", "membership-1");
    expect(renderMemberSummaryPdf).toHaveBeenCalled();
    expect(resolveIdentity).toHaveBeenCalled();
  });
});


