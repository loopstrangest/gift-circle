import type { RoomSnapshot } from "@/lib/room-types";

export type CommitmentPreviewEntry = {
  claimId: string;
  itemType: "offer" | "desire";
  itemTitle: string;
  itemDetails: string | null;
  counterpartMembershipId: string;
};

export type MemberCommitmentPreview = {
  giving: CommitmentPreviewEntry[];
  receiving: CommitmentPreviewEntry[];
};

function ensurePreview(
  map: Map<string, MemberCommitmentPreview>,
  membershipId: string
) {
  let existing = map.get(membershipId);
  if (!existing) {
    existing = { giving: [], receiving: [] } satisfies MemberCommitmentPreview;
    map.set(membershipId, existing);
  }
  return existing;
}

export function buildCommitmentPreview(room: RoomSnapshot) {
  const offerById = new Map(room.offers.map((offer) => [offer.id, offer] as const));
  const desireById = new Map(room.desires.map((desire) => [desire.id, desire] as const));

  const preview = new Map<string, MemberCommitmentPreview>();

  for (const claim of room.claims) {
    if (claim.status !== "ACCEPTED") {
      continue;
    }

    if (claim.offerId) {
      const offer = offerById.get(claim.offerId);
      if (offer) {
        const author = ensurePreview(preview, offer.authorMembershipId);
        author.giving.push({
          claimId: claim.id,
          itemType: "offer",
          itemTitle: offer.title,
          itemDetails: offer.details ?? null,
          counterpartMembershipId: claim.claimerMembershipId,
        });

        const claimer = ensurePreview(preview, claim.claimerMembershipId);
        claimer.receiving.push({
          claimId: claim.id,
          itemType: "offer",
          itemTitle: offer.title,
          itemDetails: offer.details ?? null,
          counterpartMembershipId: offer.authorMembershipId,
        });
      }
    }

    if (claim.desireId) {
      const desire = desireById.get(claim.desireId);
      if (desire) {
        const author = ensurePreview(preview, desire.authorMembershipId);
        author.receiving.push({
          claimId: claim.id,
          itemType: "desire",
          itemTitle: desire.title,
          itemDetails: desire.details ?? null,
          counterpartMembershipId: claim.claimerMembershipId,
        });

        const claimer = ensurePreview(preview, claim.claimerMembershipId);
        claimer.giving.push({
          claimId: claim.id,
          itemType: "desire",
          itemTitle: desire.title,
          itemDetails: desire.details ?? null,
          counterpartMembershipId: desire.authorMembershipId,
        });
      }
    }
  }

  return preview;
}


