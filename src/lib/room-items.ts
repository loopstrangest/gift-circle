import {
  PrismaClient,
  type Desire,
  type DesireStatus,
  type Offer,
  type OfferStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { OfferSummary, DesireSummary } from "@/lib/room-types";

export type OfferInput = {
  roomId: string;
  authorMembershipId: string;
  title: string;
  details?: string | null;
  status?: OfferStatus;
};

export type DesireInput = {
  roomId: string;
  authorMembershipId: string;
  title: string;
  details?: string | null;
  status?: DesireStatus;
};

function getClient(client?: PrismaClient) {
  return client ?? prisma;
}

export async function listRoomOffers(roomId: string, client?: PrismaClient) {
  const db = getClient(client);
  return db.offer.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
  });
}

export async function listRoomDesires(roomId: string, client?: PrismaClient) {
  const db = getClient(client);
  return db.desire.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createOffer(data: OfferInput, client?: PrismaClient) {
  const db = getClient(client);
  return db.offer.create({
    data: {
      roomId: data.roomId,
      authorMembershipId: data.authorMembershipId,
      title: data.title,
      details: data.details ?? null,
      status: data.status ?? "OPEN",
    },
  });
}

export async function createDesire(data: DesireInput, client?: PrismaClient) {
  const db = getClient(client);
  return db.desire.create({
    data: {
      roomId: data.roomId,
      authorMembershipId: data.authorMembershipId,
      title: data.title,
      details: data.details ?? null,
      status: data.status ?? "OPEN",
    },
  });
}

export async function updateOffer(
  offerId: string,
  data: Partial<Omit<OfferInput, "roomId" | "authorMembershipId">> & {
    status?: OfferStatus;
  },
  client?: PrismaClient
) {
  const db = getClient(client);
  return db.offer.update({
    where: { id: offerId },
    data: {
      title: data.title,
      details: data.details,
      status: data.status,
    },
  });
}

export async function updateDesire(
  desireId: string,
  data: Partial<Omit<DesireInput, "roomId" | "authorMembershipId">> & {
    status?: DesireStatus;
  },
  client?: PrismaClient
) {
  const db = getClient(client);
  return db.desire.update({
    where: { id: desireId },
    data: {
      title: data.title,
      details: data.details,
      status: data.status,
    },
  });
}

export async function deleteOffer(offerId: string, client?: PrismaClient) {
  const db = getClient(client);
  await db.offer.delete({
    where: { id: offerId },
  });
}

export async function deleteDesire(desireId: string, client?: PrismaClient) {
  const db = getClient(client);
  await db.desire.delete({
    where: { id: desireId },
  });
}

export function toOfferSummary(offer: Offer): OfferSummary {
  return {
    id: offer.id,
    roomId: offer.roomId,
    authorMembershipId: offer.authorMembershipId,
    title: offer.title,
    details: offer.details,
    status: offer.status,
    updatedAt: offer.updatedAt.toISOString(),
  } satisfies OfferSummary;
}

export function toDesireSummary(desire: Desire): DesireSummary {
  return {
    id: desire.id,
    roomId: desire.roomId,
    authorMembershipId: desire.authorMembershipId,
    title: desire.title,
    details: desire.details,
    status: desire.status,
    updatedAt: desire.updatedAt.toISOString(),
  } satisfies DesireSummary;
}
