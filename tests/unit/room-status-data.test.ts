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
    offers: [],
    desires: [],
    ...overrides,
  } satisfies RoomInput;
}

describe("buildSnapshot", () => {
  beforeEach(() => {
    mockListActiveMemberships.mockReset();
  });

  it("marks non-active memberships but keeps them in the list", () => {
    const room = buildRoom();

    mockListActiveMemberships.mockReturnValue(
      new Map([
        ["membership-host", { membershipId: "membership-host", connectedAt: 1 }],
      ])
    );

    const snapshot = buildSnapshot(room);

    expect(snapshot.members).toHaveLength(2);
    expect(snapshot.members[0]).toMatchObject({
      membershipId: "membership-host",
      role: "HOST",
      isActive: true,
    });
    expect(snapshot.members[1]).toMatchObject({
      membershipId: "membership-guest",
      role: "PARTICIPANT",
      isActive: false,
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
    expect(snapshot.members[0]).toMatchObject({
      membershipId: "membership-host",
      isActive: true,
    });
    expect(snapshot.members[1]).toMatchObject({
      membershipId: "membership-guest",
      isActive: true,
    });
  });

  it("maps offers and desires into summaries", () => {
    const room = buildRoom({
      offers: [
        {
          id: "offer-2",
          roomId: "room-1",
          authorMembershipId: "membership-guest",
          title: "Second offer",
          details: null,
          status: "OPEN",
          createdAt: new Date("2025-01-01T00:10:00.000Z"),
          updatedAt: new Date("2025-01-01T00:15:00.000Z"),
        },
        {
          id: "offer-1",
          roomId: "room-1",
          authorMembershipId: "membership-host",
          title: "First offer",
          details: "Details",
          status: "FULFILLED",
          createdAt: new Date("2025-01-01T00:03:00.000Z"),
          updatedAt: new Date("2025-01-01T00:04:00.000Z"),
        },
      ],
      desires: [
        {
          id: "desire-1",
          roomId: "room-1",
          authorMembershipId: "membership-host",
          title: "Need help",
          details: null,
          status: "OPEN",
          createdAt: new Date("2025-01-01T00:06:00.000Z"),
          updatedAt: new Date("2025-01-01T00:07:00.000Z"),
        },
      ],
    });

    mockListActiveMemberships.mockReturnValue(
      new Map([
        ["membership-host", { membershipId: "membership-host", connectedAt: 1 }],
        ["membership-guest", { membershipId: "membership-guest", connectedAt: 2 }],
      ])
    );

    const snapshot = buildSnapshot(room);

    expect(snapshot.offers).toHaveLength(2);
    expect(snapshot.offers[0]).toMatchObject({ id: "offer-1", title: "First offer" });
    expect(snapshot.offers[1]).toMatchObject({ id: "offer-2", title: "Second offer" });

    expect(snapshot.desires).toHaveLength(1);
    expect(snapshot.desires[0]).toMatchObject({ id: "desire-1", title: "Need help" });
  });
});
