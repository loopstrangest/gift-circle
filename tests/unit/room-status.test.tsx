import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import RoomStatus from "@/app/rooms/[code]/room-status";
import type { RoomSnapshot } from "@/lib/rooms-client";

vi.mock("@/app/rooms/[code]/room-context", () => ({
  useRoom: vi.fn(),
}));

const { useRoom } = await import("@/app/rooms/[code]/room-context");

function buildRoomSnapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  const now = new Date().toISOString();
  return {
    id: "room-1",
    code: "ROOM01",
    hostId: "host",
    hostName: "Host",
    currentRound: "DECISIONS",
    nextRound: null,
    canAdvance: false,
    updatedAt: now,
    rounds: [],
    members: [
      {
        membershipId: "membership-host",
        userId: "user-host",
        displayName: "Host User",
        nickname: "Host",
        role: "HOST",
        joinedAt: now,
        isActive: true,
      },
      {
        membershipId: "membership-guest",
        userId: "user-guest",
        displayName: "Guest User",
        nickname: "Guest",
        role: "PARTICIPANT",
        joinedAt: now,
        isActive: true,
      },
    ],
    offers: [],
    desires: [],
    claims: [],
    ...overrides,
  } satisfies RoomSnapshot;
}

describe("RoomStatus commitments overview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("highlights giving and receiving commitments during the Decisions round", () => {
    const now = new Date().toISOString();

    useRoom.mockReturnValue({
      room: buildRoomSnapshot({
        offers: [
          {
            id: "offer-1",
            roomId: "room-1",
            authorMembershipId: "membership-host",
            title: "Fresh Bread",
            details: "Two loaves",
            status: "FULFILLED",
            updatedAt: now,
          },
        ],
        desires: [],
        claims: [
          {
            id: "claim-1",
            roomId: "room-1",
            claimerMembershipId: "membership-guest",
            offerId: "offer-1",
            desireId: null,
            status: "ACCEPTED",
            note: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
      membershipId: "membership-host",
      isHost: true,
      refresh: vi.fn(),
    });

    render(<RoomStatus />);

    const hostRow = screen.getAllByText(/^Host$/i, { selector: "p" })[0]?.closest("li");
    const guestRow = screen.getAllByText(/^Guest$/i, { selector: "p" })[0]?.closest("li");

    expect(hostRow).not.toBeNull();
    expect(guestRow).not.toBeNull();

    if (!hostRow || !guestRow) {
      throw new Error("Expected participant rows to be present");
    }

    expect(within(hostRow).getByText(/Giving: 1/i)).toBeInTheDocument();
    expect(within(hostRow).getByText(/Fresh Bread/i)).toBeInTheDocument();
    expect(within(hostRow).getByText(/to Guest/i)).toBeInTheDocument();

    expect(within(guestRow).getByText(/Receiving: 1/i)).toBeInTheDocument();
    expect(within(guestRow).getByText(/from Host/i)).toBeInTheDocument();
  });

  it("does not show commitment badges outside the Decisions round", () => {
    useRoom.mockReturnValue({
      room: buildRoomSnapshot({ currentRound: "CONNECTIONS" }),
      membershipId: "membership-host",
      isHost: true,
      refresh: vi.fn(),
    });

    render(<RoomStatus />);

    expect(screen.queryByText(/Giving:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Receiving:/i)).not.toBeInTheDocument();
  });
});


