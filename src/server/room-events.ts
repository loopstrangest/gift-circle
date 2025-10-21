import type { DesireSummary, OfferSummary } from "@/lib/room-types";

export type RoomEvent =
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
    };
