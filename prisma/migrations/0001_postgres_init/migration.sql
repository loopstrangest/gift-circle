CREATE TYPE "MembershipRole" AS ENUM ('HOST', 'PARTICIPANT');
CREATE TYPE "OfferStatus" AS ENUM ('OPEN', 'FULFILLED', 'WITHDRAWN');
CREATE TYPE "DesireStatus" AS ENUM ('OPEN', 'FULFILLED', 'WITHDRAWN');
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');
CREATE TYPE "RoomRound" AS ENUM ('WAITING', 'OFFERS', 'DESIRES', 'CONNECTIONS', 'DECISIONS');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "displayName" TEXT
);

CREATE TABLE "Room" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "code" TEXT NOT NULL UNIQUE,
  "hostId" TEXT NOT NULL,
  "currentRound" "RoomRound" NOT NULL DEFAULT 'WAITING',
  CONSTRAINT "Room_hostId_fkey"
    FOREIGN KEY ("hostId") REFERENCES "User"("id")
);

CREATE TABLE "RoomMembership" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'PARTICIPANT',
  "nickname" TEXT,
  CONSTRAINT "RoomMembership_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE,
  CONSTRAINT "RoomMembership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "RoomMembership_roomId_userId_key" UNIQUE ("roomId", "userId")
);

CREATE INDEX "RoomMembership_userId_idx" ON "RoomMembership" ("userId");
CREATE INDEX "RoomMembership_roomId_idx" ON "RoomMembership" ("roomId");

CREATE TABLE "Offer" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roomId" TEXT NOT NULL,
  "authorMembershipId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT,
  "status" "OfferStatus" NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "Offer_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE,
  CONSTRAINT "Offer_authorMembershipId_fkey"
    FOREIGN KEY ("authorMembershipId") REFERENCES "RoomMembership"("id") ON DELETE CASCADE
);

CREATE INDEX "Offer_roomId_idx" ON "Offer" ("roomId");
CREATE INDEX "Offer_authorMembershipId_idx" ON "Offer" ("authorMembershipId");

CREATE TABLE "Desire" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roomId" TEXT NOT NULL,
  "authorMembershipId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "details" TEXT,
  "status" "DesireStatus" NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "Desire_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE,
  CONSTRAINT "Desire_authorMembershipId_fkey"
    FOREIGN KEY ("authorMembershipId") REFERENCES "RoomMembership"("id") ON DELETE CASCADE
);

CREATE INDEX "Desire_roomId_idx" ON "Desire" ("roomId");
CREATE INDEX "Desire_authorMembershipId_idx" ON "Desire" ("authorMembershipId");

CREATE TABLE "Claim" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "roomId" TEXT NOT NULL,
  "claimerMembershipId" TEXT NOT NULL,
  "offerId" TEXT,
  "desireId" TEXT,
  "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  CONSTRAINT "Claim_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE,
  CONSTRAINT "Claim_claimerMembershipId_fkey"
    FOREIGN KEY ("claimerMembershipId") REFERENCES "RoomMembership"("id") ON DELETE CASCADE,
  CONSTRAINT "Claim_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE,
  CONSTRAINT "Claim_desireId_fkey"
    FOREIGN KEY ("desireId") REFERENCES "Desire"("id") ON DELETE CASCADE
);

CREATE INDEX "Claim_roomId_idx" ON "Claim" ("roomId");
CREATE INDEX "Claim_claimerMembershipId_idx" ON "Claim" ("claimerMembershipId");
CREATE INDEX "Claim_offerId_idx" ON "Claim" ("offerId");
CREATE INDEX "Claim_desireId_idx" ON "Claim" ("desireId");

