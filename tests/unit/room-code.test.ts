import { describe, expect, it, vi } from "vitest";

import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
} from "../../src/lib/room-code";

describe("generateRoomCode", () => {
  it("produces uppercase alphanumeric strings of expected length", () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    const pattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);
    expect(code).toMatch(pattern);
  });

  it("uses allowed alphabet characters", () => {
    const alphabet = new Set(ROOM_CODE_ALPHABET.split(""));
    for (let i = 0; i < 50; i += 1) {
      const code = generateRoomCode();
      for (const char of code) {
        expect(alphabet.has(char)).toBe(true);
      }
    }
  });

  it("respects Math.random entropy", () => {
    const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.0);
    const code = generateRoomCode();
    expect(code).toBe("A".repeat(ROOM_CODE_LENGTH));
    mockRandom.mockRestore();
  });
});
