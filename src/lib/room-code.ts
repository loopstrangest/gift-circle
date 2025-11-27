// Word list for generating room codes
const WORDS = [
  "vow",
  "empowerment",
  "gift",
  "generosity",
  "values",
  "belief",
  "encourage",
  "fun",
  "service",
  "benefit",
  "ambitious",
  "project",
  "hero",
  "power",
  "integrity",
  "courage",
  "hype",
  "effort",
  "rest",
  "expression",
  "agency",
  "productivity",
  "strategy",
  "unblock",
  "throughput",
  "playground",
  "community",
  "quest",
  "introspection",
  "journaling",
  "crew",
  "fundraising",
  "collaboration",
  "purpose",
  "golden-age",
  "heavenly-realm",
  "calling",
];

/**
 * Generates a room code in the format "word1-word2" (e.g., "vow-empowerment")
 * The two words will always be different.
 * If collisions occur, caller should retry with suffix by calling generateRoomCodeWithSuffix
 */
export function generateRoomCode(): string {
  const word1Index = Math.floor(Math.random() * WORDS.length);
  let word2Index = Math.floor(Math.random() * (WORDS.length - 1));
  if (word2Index >= word1Index) {
    word2Index += 1;
  }
  return `${WORDS[word1Index]}-${WORDS[word2Index]}`;
}

/**
 * Generates a room code with a numeric suffix for collision handling
 * Format: "word1-word2-N" where N is 1-9, then 0
 */
export function generateRoomCodeWithSuffix(digit: number): string {
  const baseCode = generateRoomCode();
  return `${baseCode}-${digit}`;
}

/**
 * Validates a room code format
 * Accepts: "word-word" or "word-word-digit"
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;

  const normalized = code.toLowerCase().trim();

  // Pattern: word-word or word-word-digit
  // Words can contain letters and hyphens (like "golden-age")
  const pattern = /^[a-z]+(?:-[a-z]+)*-[a-z]+(?:-[a-z]+)*(?:-\d)?$/;

  return pattern.test(normalized);
}

/**
 * Normalizes a room code to lowercase for database lookup
 */
export function normalizeRoomCode(code: string): string {
  return code.toLowerCase().trim();
}
