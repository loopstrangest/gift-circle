import { describe, expect, it, vi } from "vitest";

import {
  collectMemberCommitments,
  renderMemberSummaryPdf,
  type MemberCommitments,
} from "@/server/export-summary";

const createDate = (value: string) => new Date(value);

describe("collectMemberCommitments", () => {
  it("categorises accepted offer claims for authors and claimers", async () => {
    const now = createDate("2025-01-01T12:00:00.000Z");

    const mockClient = {
      claim: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "claim-1",
            roomId: "room-1",
            claimerMembershipId: "member-b",
            offerId: "offer-1",
            desireId: null,
            status: "ACCEPTED",
            note: "Looking forward to it",
            createdAt: now,
            updatedAt: now,
            offer: {
              id: "offer-1",
              roomId: "room-1",
              authorMembershipId: "member-a",
              title: "Offer title",
              details: "Offer details",
              status: "FULFILLED",
              createdAt: now,
              updatedAt: now,
              author: {
                id: "member-a",
                roomId: "room-1",
                userId: "user-a",
                role: "PARTICIPANT",
                nickname: "Giver",
                createdAt: now,
                updatedAt: now,
                user: {
                  id: "user-a",
                  createdAt: now,
                  updatedAt: now,
                  displayName: "Giver Name",
                },
              },
            },
            desire: null,
            claimer: {
              id: "member-b",
              roomId: "room-1",
              userId: "user-b",
              role: "PARTICIPANT",
              nickname: null,
              createdAt: now,
              updatedAt: now,
              user: {
                id: "user-b",
                createdAt: now,
                updatedAt: now,
                displayName: "Receiver Name",
              },
            },
          },
        ]),
      },
    } as unknown;

    const commitments = (await collectMemberCommitments(
      "room-1",
      "member-a",
      mockClient as never
    )) satisfies MemberCommitments;

    expect(commitments.giving).toHaveLength(1);
    expect(commitments.giving[0]).toMatchObject({
      itemType: "offer",
      role: "giving",
      counterpartName: "Receiver Name",
    });
    expect(commitments.receiving).toHaveLength(0);

    const claimerCommitments = await collectMemberCommitments(
      "room-1",
      "member-b",
      mockClient as never
    );

    expect(claimerCommitments.receiving).toHaveLength(1);
    expect(claimerCommitments.receiving[0]).toMatchObject({
      itemType: "offer",
      counterpartName: "Giver",
      role: "receiving",
    });
  });

  it("categorises accepted desire claims for authors and claimers", async () => {
    const now = createDate("2025-01-02T12:00:00.000Z");

    const mockClient = {
      claim: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "claim-2",
            roomId: "room-1",
            claimerMembershipId: "member-c",
            offerId: null,
            desireId: "desire-1",
            status: "ACCEPTED",
            note: null,
            createdAt: now,
            updatedAt: now,
            offer: null,
            desire: {
              id: "desire-1",
              roomId: "room-1",
              authorMembershipId: "member-d",
              title: "Need title",
              details: "Need details",
              status: "FULFILLED",
              createdAt: now,
              updatedAt: now,
              author: {
                id: "member-d",
                roomId: "room-1",
                userId: "user-d",
                role: "PARTICIPANT",
                nickname: "Receiver",
                createdAt: now,
                updatedAt: now,
                user: {
                  id: "user-d",
                  createdAt: now,
                  updatedAt: now,
                  displayName: "Receiver Display",
                },
              },
            },
            claimer: {
              id: "member-c",
              roomId: "room-1",
              userId: "user-c",
              role: "PARTICIPANT",
              nickname: null,
              createdAt: now,
              updatedAt: now,
              user: {
                id: "user-c",
                createdAt: now,
                updatedAt: now,
                displayName: "Helper",
              },
            },
          },
        ]),
      },
    } as unknown;

    const authorCommitments = await collectMemberCommitments(
      "room-1",
      "member-d",
      mockClient as never
    );

    expect(authorCommitments.receiving).toHaveLength(1);
    expect(authorCommitments.receiving[0]).toMatchObject({
      itemType: "desire",
      role: "receiving",
      counterpartName: "Helper",
    });

    const claimerCommitments = await collectMemberCommitments(
      "room-1",
      "member-c",
      mockClient as never
    );

    expect(claimerCommitments.giving).toHaveLength(1);
    expect(claimerCommitments.giving[0]).toMatchObject({
      itemType: "desire",
      role: "giving",
      counterpartName: "Receiver",
    });
  });
});

describe("renderMemberSummaryPdf", () => {
  it("produces a PDF buffer", async () => {
    const now = createDate("2025-01-03T12:00:00.000Z");

    const buffer = await renderMemberSummaryPdf({
      room: {
        id: "room-1",
        code: "gift-generosity",
        createdAt: now,
        updatedAt: now,
        hostId: "user-h",
        currentRound: "DECISIONS",
        host: {
          id: "user-h",
          createdAt: now,
          updatedAt: now,
          displayName: "Host Name",
        },
      } as never,
      member: {
        id: "membership-1",
        roomId: "room-1",
        userId: "user-1",
        role: "PARTICIPANT",
        nickname: "Member",
        createdAt: now,
        updatedAt: now,
        user: {
          id: "user-1",
          createdAt: now,
          updatedAt: now,
          displayName: "Member Name",
        },
      } as never,
      commitments: {
        giving: [],
        receiving: [],
      },
      generatedAt: now,
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});


