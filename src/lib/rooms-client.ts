import { RoomSnapshot } from "./room-types";

type RoomResponse = {
  room: {
    id: string;
    code: string;
    hostId: string;
  };
  host?: {
    id: string;
    displayName: string | null;
  };
  user?: {
    id: string;
    displayName: string | null;
  };
  membership: {
    id: string;
    role: "HOST" | "PARTICIPANT";
    nickname: string | null;
  };
};

export async function createRoom({ hostDisplayName }: { hostDisplayName: string }) {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ hostDisplayName }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create room: ${response.status}`);
  }

  return (await response.json()) as RoomResponse & {
    host: NonNullable<RoomResponse["host"]>;
  };
}

export async function joinRoom({
  code,
  displayName,
}: {
  code: string;
  displayName: string;
}) {
  const response = await fetch(`/api/rooms/${code}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName }),
  });

  if (!response.ok) {
    throw new Error(`Failed to join room: ${response.status}`);
  }

  return (await response.json()) as RoomResponse & {
    user: NonNullable<RoomResponse["user"]>;
  };
}

export async function fetchRoomSnapshot(code: string): Promise<RoomSnapshot> {
  const response = await fetch(`/api/rooms/${code}`);
  if (!response.ok) {
    throw new Error(`Failed to load room: ${response.status}`);
  }
  return (await response.json()) as RoomSnapshot;
}

export type { RoomSnapshot, RoomMember } from "./room-types";
