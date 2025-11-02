import {
  PrismaClient,
  type Claim,
  type ClaimStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { ClaimSummary } from "@/lib/room-types";

export type ClaimCreateInput = {
  roomId: string;
  claimerMembershipId: string;
  offerId?: string | null;
  desireId?: string | null;
  note?: string | null;
};

function getClient(client?: PrismaClient) {
  return client ?? prisma;
}

export async function listRoomClaims(roomId: string, client?: PrismaClient) {
  const db = getClient(client);
  return db.claim.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createClaim(data: ClaimCreateInput, client?: PrismaClient) {
  const db = getClient(client);
  return db.claim.create({
    data: {
      roomId: data.roomId,
      claimerMembershipId: data.claimerMembershipId,
      offerId: data.offerId ?? null,
      desireId: data.desireId ?? null,
      note: data.note ?? null,
      status: "PENDING",
    },
  });
}

export async function updateClaimStatus(
  claimId: string,
  status: ClaimStatus,
  client?: PrismaClient
) {
  const db = getClient(client);
  return db.claim.update({
    where: { id: claimId },
    data: { status },
  });
}

export function toClaimSummary(claim: Claim): ClaimSummary {
  return {
    id: claim.id,
    roomId: claim.roomId,
    claimerMembershipId: claim.claimerMembershipId,
    offerId: claim.offerId,
    desireId: claim.desireId,
    status: claim.status,
    note: claim.note,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  } satisfies ClaimSummary;
}



