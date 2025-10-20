import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { PresenceMessage } from "@/lib/presence-types";
import {
  emitPresenceUpdate,
  initializeRealtime,
  setRealtimeServerForTests,
} from "@/server/realtime";

const emitSpy = vi.fn();
const toSpy = vi.fn(() => ({ emit: emitSpy }));
const onSpy = vi.fn();

vi.mock("socket.io", () => {
  class MockServer {
    to = toSpy;
    on = onSpy;
  }
  return { Server: MockServer };
});

describe("realtime presence helpers", () => {
  beforeEach(() => {
    setRealtimeServerForTests(null);
    emitSpy.mockClear();
    toSpy.mockClear();
    onSpy.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("initializes a singleton Socket.IO server", () => {
    const httpServer = {} as unknown as import("node:http").Server;
    const first = initializeRealtime(httpServer);
    const second = initializeRealtime(httpServer);
    expect(first).toBe(second);
    expect(onSpy).toHaveBeenCalledWith("connection", expect.any(Function));
  });

  it("emits refresh messages via the server", () => {
    const mockServer = initializeRealtime({} as unknown as import("node:http").Server);
    setRealtimeServerForTests(mockServer);

    emitPresenceUpdate({
      roomId: "room-1",
      membershipId: "member-1",
      reason: "created",
    });

    expect(toSpy).toHaveBeenCalledWith("room:room-1");
    expect(emitSpy).toHaveBeenCalledTimes(1);
    const [, message] = emitSpy.mock.calls[0];
    expect(message).toMatchObject({
      type: "refresh",
      roomId: "room-1",
      membershipId: "member-1",
      reason: "created",
    });
    expect(typeof (message as PresenceMessage).timestamp).toBe("number");
  });
});
