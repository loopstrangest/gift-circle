export type PresenceRefreshReason = "created" | "updated" | "deleted" | "reassigned";

export type PresenceMessage =
  | {
      type: "refresh";
      roomId: string;
      membershipId?: string;
      reason?: PresenceRefreshReason;
      timestamp: number;
    }
  | {
      type: "member:connected";
      roomId: string;
      membershipId: string;
      timestamp: number;
    }
  | {
      type: "member:disconnected";
      roomId: string;
      membershipId: string;
      timestamp: number;
    };
