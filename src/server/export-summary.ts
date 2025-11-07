import PDFDocument from "pdfkit";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
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
const PDFKIT_DATA_DIR = path.join(
  process.cwd(),
  "node_modules",
  "pdfkit",
  "js",
  "data"
);
const LOG_PREFIX = "[pdf-export]";
const STANDARD_FONT_FILENAMES = [
  "Courier.afm",
  "Courier-Bold.afm",
  "Courier-Oblique.afm",
  "Courier-BoldOblique.afm",
  "Helvetica.afm",
  "Helvetica-Bold.afm",
  "Helvetica-Oblique.afm",
  "Helvetica-BoldOblique.afm",
  "Times-Roman.afm",
  "Times-Bold.afm",
  "Times-Italic.afm",
  "Times-BoldItalic.afm",
  "Symbol.afm",
  "ZapfDingbats.afm",
];

async function resolveFontSource(filename: string) {
  const source = path.join(PDFKIT_DATA_DIR, filename);
  try {
    await fs.access(source);
    return source;
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} missing standard font file`,
      filename,
      "at",
      source,
      error
    );
    return null;
  }
}

let fontsReady: Promise<void> | null = null;
let cachedFontTargets: Promise<string[]> | null = null;

async function directoryExists(target: string) {
  try {
    const result = await fs.stat(target);
    return result.isDirectory();
  } catch {
    return false;
  }
}

async function discoverPdfkitFontTargets() {
  if (!cachedFontTargets) {
    cachedFontTargets = (async () => {
      const targets = new Set<string>();

      const serverRoot = path.join(process.cwd(), ".next", "server");

      async function enqueueIfPdfkitChunk(dir: string) {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && /^pdfkit(\..+)?\.js$/i.test(entry.name)) {
              const dataDir = path.join(dir, "data");
              targets.add(dataDir);
              console.log(
                LOG_PREFIX,
                "discovered pdfkit chunk",
                path.join(dir, entry.name),
                "->",
                dataDir
              );
            }
          }
        } catch {
          /** ignore */
        }
      }

      async function walk(current: string) {
        let entries: Dirent[];
        try {
          entries = await fs.readdir(current, { withFileTypes: true });
        } catch {
          return;
        }

        await enqueueIfPdfkitChunk(current);

        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue;
          }
          if (entry.name === "data" || entry.name.startsWith(".")) {
            continue;
          }
          await walk(path.join(current, entry.name));
        }
      }

      if (await directoryExists(serverRoot)) {
        await walk(serverRoot);
      }

      // Ensure we include the common vendor chunk location even if not discovered yet.
      const vendorChunkDir = path.join(serverRoot, "vendor-chunks");
      if (await directoryExists(vendorChunkDir)) {
        const vendorDataDir = path.join(vendorChunkDir, "data");
        targets.add(vendorDataDir);
        console.log(LOG_PREFIX, "including vendor chunk data directory", vendorDataDir);
      }

      if (targets.size === 0) {
        // Fallback so downstream logic still executes without throwing.
        const fallback = path.join(serverRoot, "vendor-chunks", "data");
        targets.add(fallback);
        console.warn(
          LOG_PREFIX,
          "no pdfkit chunks discovered; using fallback",
          fallback
        );
      }

      return Array.from(targets);
    })();
  }

  return cachedFontTargets;
}

async function mirrorFontsInto(
  targetDir: string,
  fonts: { filename: string; source: string }[]
) {
  try {
    await fs.mkdir(targetDir, { recursive: true });
    await Promise.all(
      fonts.map(async ({ filename, source }) => {
        const destination = path.join(targetDir, filename);
        try {
          await fs.access(destination);
        } catch {
          console.log(LOG_PREFIX, "copying font", source, "to", destination);
          await fs.copyFile(source, destination);
        }
      })
    );
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} unable to mirror PDFKit font assets into ${targetDir}`,
      error
    );
  }
}

async function ensureStandardFontsAvailable() {
  if (!fontsReady) {
    fontsReady = (async () => {
      console.log(LOG_PREFIX, "ensuring standard fonts are present", {
        pdfkitDataDir: PDFKIT_DATA_DIR,
      });

      const availableFontSources = (
        await Promise.all(
          STANDARD_FONT_FILENAMES.map(async (filename) => ({
            filename,
            source: await resolveFontSource(filename),
          }))
        )
      ).filter((entry): entry is { filename: string; source: string } => {
        return Boolean(entry.source);
      });

      if (availableFontSources.length === 0) {
        console.error(
          LOG_PREFIX,
          "No PDFKit AFM font files available; PDF export cannot proceed"
        );
        return;
      }

      if (availableFontSources.length !== STANDARD_FONT_FILENAMES.length) {
        console.warn(
          LOG_PREFIX,
          `Only ${availableFontSources.length} of ${STANDARD_FONT_FILENAMES.length} standard fonts available`
        );
      }

      const targets = await discoverPdfkitFontTargets();
      console.log(
        LOG_PREFIX,
        "mirroring",
        availableFontSources.length,
        "AFM fonts to",
        targets
      );
      await Promise.all(
        targets.map((target) => mirrorFontsInto(target, availableFontSources))
      );
      console.log(LOG_PREFIX, "font mirroring complete");
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
          doc
            .font("Helvetica")
            .fontSize(11)
            .fillColor("#4b5563")
            .text(entry.itemDetails);
          doc.fillColor("black");
        }

        doc
          .font("Helvetica")
          .fontSize(11)
          .text(`${counterpartPrefix}: ${entry.counterpartName}`);

        if (entry.note) {
          doc
            .font("Helvetica")
            .fontSize(11)
            .fillColor("#4b5563")
            .text(`Note: ${entry.note}`);
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
