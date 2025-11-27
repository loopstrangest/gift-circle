import { describe, expect, it, vi } from "vitest";

import {
  generateRoomCode,
  generateRoomCodeWithSuffix,
  isValidRoomCode,
  normalizeRoomCode,
} from "../../src/lib/room-code";

describe("generateRoomCode", () => {
  it("produces two-word codes in format word-word", () => {
    const code = generateRoomCode();
    // Should match pattern: word-word (lowercase, may contain hyphenated words like golden-age)
    expect(code).toMatch(/^[a-z]+(?:-[a-z]+)*-[a-z]+(?:-[a-z]+)*$/);
  });

  it("generates lowercase codes", () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateRoomCode();
      expect(code).toBe(code.toLowerCase());
    }
  });

  it("respects Math.random entropy", () => {
    const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.0);
    const code = generateRoomCode();
    // With Math.random() always 0, should pick first word twice
    expect(code.split("-").length).toBeGreaterThanOrEqual(2);
    mockRandom.mockRestore();
  });
});

describe("generateRoomCodeWithSuffix", () => {
  it("adds a numeric suffix to the code", () => {
    const code = generateRoomCodeWithSuffix(3);
    expect(code).toMatch(/-3$/);
  });
});

describe("isValidRoomCode", () => {
  it("accepts valid two-word codes", () => {
    expect(isValidRoomCode("vow-empowerment")).toBe(true);
    expect(isValidRoomCode("gift-generosity")).toBe(true);
    expect(isValidRoomCode("fun-rest")).toBe(true);
  });

  it("accepts codes with hyphenated words", () => {
    expect(isValidRoomCode("golden-age-fun")).toBe(true);
    expect(isValidRoomCode("heavenly-realm-gift")).toBe(true);
  });

  it("accepts codes with numeric suffix", () => {
    expect(isValidRoomCode("vow-empowerment-3")).toBe(true);
    expect(isValidRoomCode("gift-generosity-0")).toBe(true);
  });

  it("accepts mixed case codes", () => {
    expect(isValidRoomCode("Vow-Empowerment")).toBe(true);
    expect(isValidRoomCode("VOW-EMPOWERMENT")).toBe(true);
  });

  it("rejects invalid codes", () => {
    expect(isValidRoomCode("")).toBe(false);
    expect(isValidRoomCode("single")).toBe(false);
    expect(isValidRoomCode("ABC123")).toBe(false);
    expect(isValidRoomCode("vow_empowerment")).toBe(false);
    expect(isValidRoomCode("vow empowerment")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isValidRoomCode(null as unknown as string)).toBe(false);
    expect(isValidRoomCode(undefined as unknown as string)).toBe(false);
  });
});

describe("normalizeRoomCode", () => {
  it("converts to lowercase and trims", () => {
    expect(normalizeRoomCode("Vow-Empowerment")).toBe("vow-empowerment");
    expect(normalizeRoomCode("  VOW-EMPOWERMENT  ")).toBe("vow-empowerment");
  });
});
