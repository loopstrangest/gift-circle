export type MembershipRole = "HOST" | "PARTICIPANT";

export type RoomMember = {
  membershipId: string;
  userId: string;
  displayName: string | null;
  nickname: string | null;
  role: MembershipRole;
  joinedAt: string;
};

export type RoomSnapshot = {
  id: string;
  code: string;
  hostId: string;
  hostName: string | null;
  members: RoomMember[];
  updatedAt: string;
};
