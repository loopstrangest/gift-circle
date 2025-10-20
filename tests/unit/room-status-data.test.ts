import { describe, expect, it, beforeEach, vi } from "vitest";

const mockListActiveMemberships = vi.fn();

vi.mock("@/server/realtime", () => ({
  listActiveMemberships: mockListActiveMemberships,
}));

const { buildSnapshot } = await import("@/app/rooms/[code]/room-status-data");

type RoomInput = Parameters<typeof buildSnapshot>[0];

function buildRoom(overrides: Partial<RoomInput> = {}): RoomInput {
  const now = new Date("2025-01-01T00:00:00.000Z");
  return {
    id: "room-1",
    code: "ABC123",
    hostId: "user-host",
    createdAt: now,
    updatedAt: now,
    host: {
      id: "user-host",
      createdAt: now,
      updatedAt: now,
      displayName: "Host User",
    },
    memberships: [
      {
        id: "membership-host",
        roomId: "room-1",
        userId: "user-host",
        role: "HOST",
        nickname: "Host",
        createdAt: now,
        updatedAt: now,
        user: {
          id: "user-host",
          createdAt: now,
          updatedAt: now,
          displayName: "Host User",
        },
      },
      {
        id: "membership-guest",
        roomId: "room-1",
        userId: "user-guest",
        role: "PARTICIPANT",
        nickname: "Guest",
        createdAt: new Date("2025-01-01T00:05:00.000Z"),
        updatedAt: now,
        user: {
          id: "user-guest",
          createdAt: now,
          updatedAt: now,
          displayName: "Guest User",
        },
      },
    ],
    ...overrides,
  } satisfies RoomInput;
}

describe("buildSnapshot", () => {
  beforeEach(() => {
    mockListActiveMemberships.mockReset();
  });

  it("only includes memberships that are currently active", () => {
    const room = buildRoom();

    mockListActiveMemberships.mockReturnValue(
      new Map([
        ["membership-host", { membershipId: "membership-host", connectedAt: 1 }],
      ])
    );

    const snapshot = buildSnapshot(room);

    expect(snapshot.members).toHaveLength(1);
    expect(snapshot.members[0]).toMatchObject({
      membershipId: "membership-host",
      role: "HOST",
    });
  });

  it("includes all active memberships with stable ordering", () => {
    const room = buildRoom();

    mockListActiveMemberships.mockReturnValue(
      new Map([
        ["membership-host", { membershipId: "membership-host", connectedAt: 1 }],
        ["membership-guest", { membershipId: "membership-guest", connectedAt: 2 }],
      ])
    );

    const snapshot = buildSnapshot(room);

    expect(snapshot.members).toHaveLength(2);
    expect(snapshot.members[0].membershipId).toBe("membership-host");
    expect(snapshot.members[1].membershipId).toBe("membership-guest");
  });
});
