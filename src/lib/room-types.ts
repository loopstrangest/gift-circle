export type MembershipRole = "HOST" | "PARTICIPANT";

export type RoomMember = {
  membershipId: string;
  userId: string;
  displayName: string | null;
  nickname: string | null;
  role: MembershipRole;
  joinedAt: string;
  isActive: boolean;
};

export type RoomSnapshot = {
  id: string;
  code: string;
  hostId: string;
  hostName: string | null;
  currentRound: RoomRound;
  nextRound: RoomRound | null;
  canAdvance: boolean;
  rounds: RoundState[];
  members: RoomMember[];
  updatedAt: string;
  offers: OfferSummary[];
  desires: DesireSummary[];
};

export type ItemStatus = "OPEN" | "FULFILLED" | "WITHDRAWN";

export type OfferSummary = {
  id: string;
  roomId: string;
  authorMembershipId: string;
  title: string;
  details: string | null;
  status: ItemStatus;
  updatedAt: string;
};

export type DesireSummary = {
  id: string;
  roomId: string;
  authorMembershipId: string;
  title: string;
  details: string | null;
  status: ItemStatus;
  updatedAt: string;
};

export type RoomRealtimeEvent =
  | {
      type: "offer:created";
      roomId: string;
      offer: OfferSummary;
    }
  | {
      type: "offer:updated";
      roomId: string;
      offer: OfferSummary;
    }
  | {
      type: "offer:deleted";
      roomId: string;
      offerId: string;
    }
  | {
      type: "desire:created";
      roomId: string;
      desire: DesireSummary;
    }
  | {
      type: "desire:updated";
      roomId: string;
      desire: DesireSummary;
    }
  | {
      type: "desire:deleted";
      roomId: string;
      desireId: string;
    }
  | {
      type: "round:changed";
      roomId: string;
      round: RoomRound;
    };

export type RoomRound = "WAITING" | "OFFERS" | "DESIRES" | "CONNECTIONS" | "DECISIONS";

export type RoundState = {
  round: RoomRound;
  title: string;
  description: string;
  guidance: string;
  isActive: boolean;
  isComplete: boolean;
};
