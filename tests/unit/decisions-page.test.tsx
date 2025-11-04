import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomSnapshot } from "@/lib/rooms-client";
import DecisionsPage from "@/app/rooms/[code]/decisions/page";

vi.mock("@/app/rooms/[code]/room-context", () => ({
  useRoom: vi.fn(),
}));

vi.mock("@/lib/rooms-client", () => ({
  decideClaimApi: vi.fn(),
}));

const { useRoom } = await import("@/app/rooms/[code]/room-context");
const { decideClaimApi } = await import("@/lib/rooms-client");

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
    rounds: [],
    members: [
      {
        membershipId: "membership-1",
        userId: "user-1",
        displayName: "Owner",
        nickname: null,
        role: "PARTICIPANT",
        joinedAt: now,
        isActive: true,
      },
      {
        membershipId: "membership-2",
        userId: "user-2",
        displayName: "Guest",
        nickname: null,
        role: "PARTICIPANT",
        joinedAt: now,
        isActive: true,
      },
    ],
    updatedAt: now,
    offers: [
      {
        id: "offer-1",
        roomId: "room-1",
        authorMembershipId: "membership-1",
        title: "Offer",
        details: "Details",
        status: "OPEN",
        updatedAt: now,
      },
    ],
    desires: [
      {
        id: "desire-1",
        roomId: "room-1",
        authorMembershipId: "membership-1",
        title: "Need",
        details: "Please help",
        status: "OPEN",
        updatedAt: now,
      },
    ],
    claims: [
      {
        id: "claim-1",
        roomId: "room-1",
        claimerMembershipId: "membership-2",
        offerId: "offer-1",
        desireId: null,
        status: "PENDING",
        note: "I'd love this",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "claim-2",
        roomId: "room-1",
        claimerMembershipId: "membership-2",
        offerId: null,
        desireId: "desire-1",
        status: "PENDING",
        note: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    ...overrides,
  } satisfies RoomSnapshot;
}

describe("DecisionsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows gating message when not in Decisions round", () => {
    useRoom.mockReturnValue({
      room: buildRoomSnapshot({ currentRound: "CONNECTIONS" }),
      membershipId: "membership-1",
      refresh: vi.fn(),
      isLoading: false,
      error: undefined,
    });

    render(<DecisionsPage />);

    expect(
      screen.getByText(/decisions will be available once the host advances/i)
    ).toBeInTheDocument();
  });

  it("accepts claims and refreshes the snapshot", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    useRoom.mockReturnValue({
      room: buildRoomSnapshot(),
      membershipId: "membership-1",
      refresh,
      isLoading: false,
      error: undefined,
    });
    decideClaimApi.mockResolvedValue({});

    render(<DecisionsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /accept/i })[0]);

    await waitFor(() => {
      expect(decideClaimApi).toHaveBeenCalledWith("ROOM01", "claim-1", "ACCEPTED");
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("declines claims and refreshes the snapshot", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    useRoom.mockReturnValue({
      room: buildRoomSnapshot(),
      membershipId: "membership-1",
      refresh,
      isLoading: false,
      error: undefined,
    });
    decideClaimApi.mockResolvedValue({});

    render(<DecisionsPage />);

    fireEvent.click(screen.getAllByRole("button", { name: /decline/i })[0]);

    await waitFor(() => {
      expect(decideClaimApi).toHaveBeenCalledWith("ROOM01", "claim-1", "DECLINED");
    });
    expect(refresh).toHaveBeenCalled();
  });
});

