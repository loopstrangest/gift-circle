import type { RoomRound } from "@prisma/client";

export const ROOM_ROUND_SEQUENCE: readonly RoomRound[] = [
  "WAITING",
  "OFFERS",
  "DESIRES",
  "CONNECTIONS",
  "DECISIONS",
] as const;

export type RoomRoundInfo = {
  key: RoomRound;
  title: string;
  description: string;
  guidance: string;
};

const ROUND_INFO: Record<RoomRound, RoomRoundInfo> = {
  WAITING: {
    key: "WAITING",
    title: "Waiting Room",
    description: "The host is getting everyone settled before the session begins.",
    guidance: "Sit tight while the host starts the Offers round.",
  },
  OFFERS: {
    key: "OFFERS",
    title: "Offers",
    description: "Participants share what they would like to offer to the circle.",
    guidance: "Add your offers so others can see how you can help.",
  },
  DESIRES: {
    key: "DESIRES",
    title: "Desires",
    description: "Participants share what support or items they would like to receive.",
    guidance: "Post your desires so others know how they can contribute.",
  },
  CONNECTIONS: {
    key: "CONNECTIONS",
    title: "Connections",
    description:
      "Participants make requests to receive offers or to fulfill desires from others.",
    guidance:
      "Review the offers and desires and send requests to connect with other participants.",
  },
  DECISIONS: {
    key: "DECISIONS",
    title: "Decisions",
    description:
      "Participants review incoming requests and decide which to accept or decline.",
    guidance: "Review your pending requests and make decisions.",
  },
};

export function getNextRound(current: RoomRound): RoomRound | null {
  const index = ROOM_ROUND_SEQUENCE.indexOf(current);
  if (index === -1 || index === ROOM_ROUND_SEQUENCE.length - 1) {
    return null;
  }
  return ROOM_ROUND_SEQUENCE[index + 1] ?? null;
}

export function canAdvanceRound(current: RoomRound): boolean {
  return getNextRound(current) !== null;
}

export function getRoundInfo(round: RoomRound): RoomRoundInfo {
  return ROUND_INFO[round];
}

export function getAdvanceLabel(nextRound: RoomRound | null): string {
  if (!nextRound) {
    return "Final round reached";
  }
  return `Advance to ${ROUND_INFO[nextRound].title}`;
}

export function isRoundOrderValid(current: RoomRound, next: RoomRound) {
  const currentIndex = ROOM_ROUND_SEQUENCE.indexOf(current);
  const nextIndex = ROOM_ROUND_SEQUENCE.indexOf(next);
  return nextIndex === currentIndex + 1;
}
