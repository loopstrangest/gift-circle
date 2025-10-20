import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  emitPresenceUpdate,
  initializeRealtime,
  listActiveMemberships,
  setRealtimeServerForTests,
} from "@/server/realtime";

const toSpy = vi.fn(() => ({ emit: vi.fn() }));
const onSpy = vi.fn();
const sockets = new Map<string, { data: Record<string, unknown> }>();
const rooms = new Map<string, Set<string>>();

vi.mock("socket.io", () => {
  class MockServer {
    sockets = {
      sockets,
      adapter: {
        rooms,
      },
    };

    to = toSpy;
    on = onSpy;
  }

  return { Server: MockServer };
});

describe("realtime active membership tracking", () => {
  beforeEach(() => {
    setRealtimeServerForTests(null);
    sockets.clear();
    rooms.clear();
    toSpy.mockClear();
    onSpy.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("records socket-based memberships", () => {
    const httpServer = {} as unknown as import("node:http").Server;
    const server = initializeRealtime(httpServer);
    setRealtimeServerForTests(server);

    const socketId = "socket-1";
    const roomChannel = "room:room-123";

    rooms.set(roomChannel, new Set([socketId]));
    sockets.set(socketId, {
      data: {
        membershipId: "membership-1",
        connectedAt: 1_700_000,
      },
    } as never);

    const active = listActiveMemberships("room-123");
    expect(active.get("membership-1")).toMatchObject({ membershipId: "membership-1" });
  });

  it("tracks memberships via emitPresenceUpdate and clears on delete", () => {
    const httpServer = {} as unknown as import("node:http").Server;
    const server = initializeRealtime(httpServer);
    setRealtimeServerForTests(server);

    emitPresenceUpdate({
      roomId: "room-xyz",
      membershipId: "membership-9",
      reason: "created",
    });
    let active = listActiveMemberships("room-xyz");
    expect(active.has("membership-9")).toBe(true);

    emitPresenceUpdate({
      roomId: "room-xyz",
      membershipId: "membership-9",
      reason: "deleted",
    });
    active = listActiveMemberships("room-xyz");
    expect(active.has("membership-9")).toBe(false);
  });
});
