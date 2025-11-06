import PDFDocument from "pdfkit";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type MembershipWithUser = Prisma.RoomMembershipGetPayload<{
  include: { user: true };
}>;

type ClaimWithRelations = Prisma.ClaimGetPayload<{
  include: {
    offer: {
      include: {
        author: {
          include: { user: true };
        };
      };
    };
    desire: {
      include: {
        author: {
          include: { user: true };
        };
      };
    };
    claimer: {
      include: { user: true };
    };
  };
}>;

export type MemberCommitmentEntry = {
  claimId: string;
  itemType: "offer" | "desire";
  itemTitle: string;
  itemDetails: string | null;
  role: "giving" | "receiving";
  counterpartName: string;
  note: string | null;
  updatedAt: string;
};

export type MemberCommitments = {
  giving: MemberCommitmentEntry[];
  receiving: MemberCommitmentEntry[];
};

const require = createRequire(import.meta.url);
const PDFKIT_PACKAGE_PATH = require.resolve("pdfkit/package.json");
const PDFKIT_DIR = path.dirname(PDFKIT_PACKAGE_PATH);
const PDFKIT_DATA_DIR = path.join(PDFKIT_DIR, "js", "data");
const TARGET_FONT_DIR = path.join(process.cwd(), ".next/server/vendor-chunks/data");

let fontsReady: Promise<void> | null = null;

async function ensureStandardFontsAvailable() {
  if (!fontsReady) {
    fontsReady = (async () => {
      try {
        await fs.mkdir(TARGET_FONT_DIR, { recursive: true });
        const entries = await fs.readdir(PDFKIT_DATA_DIR);
        await Promise.all(
          entries
            .filter((entry) => entry.endsWith(".afm"))
            .map(async (entry) => {
              const destination = path.join(TARGET_FONT_DIR, entry);
              try {
                await fs.access(destination);
              } catch {
                await fs.copyFile(path.join(PDFKIT_DATA_DIR, entry), destination);
              }
            })
        );
      } catch (error) {
        console.warn("Unable to mirror PDFKit standard fonts", error);
      }
    })();
  }
  return fontsReady;
}

function getClient(client?: PrismaClient) {
  return client ?? prisma;
}

function formatMemberDisplayName(member: MembershipWithUser) {
  const nickname = member.nickname?.trim();
  if (nickname) {
    return nickname;
  }
  const name = member.user.displayName?.trim();
  if (name) {
    return name;
  }
  return member.role === "HOST" ? "Host" : "Participant";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(value);
}

function pushGivingEntry(
  target: MemberCommitments["giving"],
  claim: ClaimWithRelations,
  itemType: "offer" | "desire",
  itemTitle: string,
  itemDetails: string | null,
  counterpartName: string
) {
  target.push({
    claimId: claim.id,
    itemType,
    itemTitle,
    itemDetails,
    role: "giving",
    counterpartName,
    note: claim.note,
    updatedAt: claim.updatedAt.toISOString(),
  });
}

function pushReceivingEntry(
  target: MemberCommitments["receiving"],
  claim: ClaimWithRelations,
  itemType: "offer" | "desire",
  itemTitle: string,
  itemDetails: string | null,
  counterpartName: string
) {
  target.push({
    claimId: claim.id,
    itemType,
    itemTitle,
    itemDetails,
    role: "receiving",
    counterpartName,
    note: claim.note,
    updatedAt: claim.updatedAt.toISOString(),
  });
}

export async function collectMemberCommitments(
  roomId: string,
  membershipId: string,
  client?: PrismaClient
): Promise<MemberCommitments> {
  const db = getClient(client);

  const claims = await db.claim.findMany({
    where: {
      roomId,
      status: "ACCEPTED",
      OR: [
        { claimerMembershipId: membershipId },
        { offer: { authorMembershipId: membershipId } },
        { desire: { authorMembershipId: membershipId } },
      ],
    },
    include: {
      offer: {
        include: {
          author: {
            include: { user: true },
          },
        },
      },
      desire: {
        include: {
          author: {
            include: { user: true },
          },
        },
      },
      claimer: {
        include: { user: true },
      },
    },
    orderBy: { updatedAt: "asc" },
  });

  const commitments: MemberCommitments = { giving: [], receiving: [] };

  for (const claim of claims as ClaimWithRelations[]) {
    if (claim.offer) {
      const author = claim.offer.author;
      const claimer = claim.claimer;

      if (author.id === membershipId) {
        pushGivingEntry(
          commitments.giving,
          claim,
          "offer",
          claim.offer.title,
          claim.offer.details ?? null,
          formatMemberDisplayName(claimer)
        );
      }

      if (claimer.id === membershipId) {
        pushReceivingEntry(
          commitments.receiving,
          claim,
          "offer",
          claim.offer.title,
          claim.offer.details ?? null,
          formatMemberDisplayName(author)
        );
      }
    }

    if (claim.desire) {
      const author = claim.desire.author;
      const claimer = claim.claimer;

      if (author.id === membershipId) {
        pushReceivingEntry(
          commitments.receiving,
          claim,
          "desire",
          claim.desire.title,
          claim.desire.details ?? null,
          formatMemberDisplayName(claimer)
        );
      }

      if (claimer.id === membershipId) {
        pushGivingEntry(
          commitments.giving,
          claim,
          "desire",
          claim.desire.title,
          claim.desire.details ?? null,
          formatMemberDisplayName(author)
        );
      }
    }
  }

  return commitments;
}

export async function renderMemberSummaryPdf({
  member,
  commitments,
  generatedAt,
}: {
  member: MembershipWithUser;
  commitments: MemberCommitments;
  generatedAt: Date;
}): Promise<Buffer> {
  await ensureStandardFontsAvailable();

  const doc = new PDFDocument({ margin: 48, size: "LETTER" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => {
    chunks.push(chunk as Buffer);
  });

  const completed = new Promise<void>((resolve) => {
    doc.on("end", () => resolve());
  });

  const memberName = formatMemberDisplayName(member);

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("Gift Circle Commitments", { align: "center" })
    .moveDown(0.5);

  doc
    .font("Helvetica")
    .fontSize(12)
    .text(formatDate(generatedAt), { align: "center" })
    .text(`Participant: ${memberName}`, { align: "center" })
    .moveDown(1.25);

  if (commitments.giving.length === 0 && commitments.receiving.length === 0) {
    doc
      .font("Helvetica")
      .fontSize(12)
      .text(
        "No accepted commitments are recorded for this participant during the Decisions round.",
        { align: "left" }
      );
  } else {
    const writeSection = (
      title: string,
      items: MemberCommitmentEntry[],
      counterpartPrefix: "To" | "From"
    ) => {
      doc.font("Helvetica-Bold").fontSize(16).text(title);
      doc.moveDown(0.5);

      if (items.length === 0) {
        doc.font("Helvetica").fontSize(11).text("No accepted commitments recorded.");
        doc.moveDown(0.75);
        return;
      }

      items.forEach((entry) => {
        doc.font("Helvetica-Bold").fontSize(12).text(entry.itemTitle);

        if (entry.itemDetails) {
          doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text(entry.itemDetails);
          doc.fillColor("black");
        }

        doc.font("Helvetica").fontSize(11).text(`${counterpartPrefix}: ${entry.counterpartName}`);

        if (entry.note) {
          doc.font("Helvetica").fontSize(11).fillColor("#4b5563").text(`Note: ${entry.note}`);
          doc.fillColor("black");
        }

        doc.moveDown(0.75);
      });
    };

    writeSection("Giving Commitments", commitments.giving, "To");

    doc.moveDown(0.5);

    writeSection("Receiving Commitments", commitments.receiving, "From");
  }

  doc.end();

  await completed;

  return Buffer.concat(chunks);
}


