import PDFDocument from "pdfkit";
import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
import path from "node:path";

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
      if (!process.env.PDFKIT_DATA_DIR) {
        process.env.PDFKIT_DATA_DIR = PDFKIT_DATA_DIR;
      }

      if (process.env.VERCEL === "1") {
        console.log(LOG_PREFIX, "skipping font mirroring in serverless runtime", {
          pdfkitDataDir: process.env.PDFKIT_DATA_DIR,
        });
        return;
      }

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

// Greyscale color palette
const COLORS = {
  black: "#000000",
  gray900: "#1a1a1a",
  gray700: "#404040",
  gray600: "#525252",
  gray500: "#6b6b6b",
  gray400: "#a3a3a3",
  gray300: "#d4d4d4",
  gray200: "#e5e5e5",
  gray100: "#f5f5f5",
  white: "#ffffff",
};

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

  const doc = new PDFDocument({ margin: 54, size: "LETTER" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => {
    chunks.push(chunk as Buffer);
  });

  const completed = new Promise<void>((resolve) => {
    doc.on("end", () => resolve());
  });

  const memberName = formatMemberDisplayName(member);
  const pageWidth = doc.page.width;
  const contentWidth = pageWidth - 108;

  // === HEADER SECTION ===
  doc
    .rect(0, 0, pageWidth, 110)
    .fill(COLORS.gray100);

  doc
    .font("Helvetica-Bold")
    .fontSize(24)
    .fillColor(COLORS.black)
    .text("Gift Circle", 54, 36, { align: "center", width: contentWidth });

  doc
    .font("Helvetica")
    .fontSize(12)
    .fillColor(COLORS.gray600)
    .text("Commitment Summary", 54, 66, { align: "center", width: contentWidth });

  doc.y = 124;

  // === PARTICIPANT INFO CARD ===
  const infoCardY = doc.y;
  const infoCardHeight = 50;

  doc
    .roundedRect(54, infoCardY, contentWidth, infoCardHeight, 6)
    .fill(COLORS.gray200);

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(COLORS.black)
    .text(memberName, 54, infoCardY + 12, { align: "center", width: contentWidth });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.gray600)
    .text(formatDate(generatedAt), 54, infoCardY + 30, { align: "center", width: contentWidth });

  doc.y = infoCardY + infoCardHeight + 20;

  // === COMMITMENTS SECTIONS ===
  if (commitments.giving.length === 0 && commitments.receiving.length === 0) {
    const emptyY = doc.y;
    doc
      .roundedRect(54, emptyY, contentWidth, 60, 8)
      .fill(COLORS.gray100);

    doc
      .font("Helvetica")
      .fontSize(12)
      .fillColor(COLORS.gray600)
      .text(
        "No accepted commitments are recorded for this participant.",
        54,
        emptyY + 22,
        { align: "center", width: contentWidth }
      );
  } else {
    const cardIndent = 24; // Indent for cards under section headers

    const writeSection = (
      title: string,
      items: MemberCommitmentEntry[],
      counterpartPrefix: "To" | "From",
      cardBgColor: string
    ) => {
      // Section header (no accent bar)
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(COLORS.black)
        .text(title, 54);

      doc.moveDown(0.4);

      if (items.length === 0) {
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor(COLORS.gray500)
          .text("None", 54 + cardIndent);
        doc.moveDown(1);
        return;
      }

      items.forEach((entry) => {
        // Calculate card height
        let estimatedHeight = 44;
        if (entry.itemDetails) estimatedHeight += 16;
        if (entry.note) estimatedHeight += 16;

        // Page break check
        if (doc.y + estimatedHeight > doc.page.height - 80) {
          doc.addPage();
          doc.y = 54;
        }

        const cardY = doc.y;
        const cardX = 54 + cardIndent;
        const cardWidth = contentWidth - cardIndent;

        // Card background
        doc
          .roundedRect(cardX, cardY, cardWidth, estimatedHeight, 6)
          .fill(cardBgColor);

        let textY = cardY + 10;
        const textX = cardX + 12;

        // Counterpart
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(COLORS.gray600)
          .text(`${counterpartPrefix}:`, textX, textY, { continued: true })
          .font("Helvetica-Bold")
          .fillColor(COLORS.gray700)
          .text(` ${entry.counterpartName}`);

        textY += 14;

        // Item title
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(COLORS.black)
          .text(entry.itemTitle, textX, textY, { width: cardWidth - 24 });

        textY += 14;

        // Details
        if (entry.itemDetails) {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(COLORS.gray600)
            .text(entry.itemDetails, textX, textY, { width: cardWidth - 24 });
          textY += 14;
        }

        // Note
        if (entry.note) {
          doc
            .font("Helvetica-Oblique")
            .fontSize(9)
            .fillColor(COLORS.gray500)
            .text(`"${entry.note}"`, textX, textY, { width: cardWidth - 24 });
        }

        doc.y = cardY + estimatedHeight + 8;
      });

      doc.moveDown(0.3);
    };

    // Giving: light background
    writeSection("Giving", commitments.giving, "To", COLORS.gray100);

    doc.moveDown(0.3);

    // Receiving: slightly darker background
    writeSection("Receiving", commitments.receiving, "From", COLORS.gray200);
  }

  doc.end();

  await completed;

  return Buffer.concat(chunks);
}
