"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import useSWR from "swr";

import {
  connectToRoom,
  disconnectSocket,
  onRoomEvent,
  offRoomEvent,
  onRoomSocketConnect,
} from "@/lib/socket-client";
import { fetchRoomSnapshot } from "@/lib/rooms-client";
import type { RoomSnapshot, RoomRealtimeEvent } from "@/lib/room-types";
import type { PresenceMessage } from "@/lib/presence-types";

type RoomContextValue = {
  room: RoomSnapshot;
  membershipId: string | null;
  currentMember: RoomSnapshot["members"][number] | null;
  isHost: boolean;
  refresh: () => Promise<RoomSnapshot | undefined>;
  isLoading: boolean;
  error: Error | undefined;
};

const RoomContext = createContext<RoomContextValue | null>(null);

type RoomProviderProps = {
  initialSnapshot: RoomSnapshot;
  membershipId: string | null;
  children: ReactNode;
};

export function RoomProvider({
  initialSnapshot,
  membershipId,
  children,
}: RoomProviderProps) {
  const cacheKey = useMemo(
    () => ["room", initialSnapshot.code] as const,
    [initialSnapshot.code]
  );

  const fetcher = useCallback(
    () => fetchRoomSnapshot(initialSnapshot.code),
    [initialSnapshot.code]
  );

  const [manualData, setManualData] = useState<RoomSnapshot>(initialSnapshot);

  const { data, mutate, error, isLoading } = useSWR(cacheKey, fetcher, {
    fallbackData: initialSnapshot,
    refreshInterval: 5_000,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (data) {
      setManualData(data);
    }
  }, [data]);

  useEffect(() => {
    const socket = connectToRoom({
      roomId: initialSnapshot.id,
      membershipId: membershipId ?? undefined,
    });

    const triggerRefresh = () => {
      void mutate();
    };

    const handlePresence = (message: PresenceMessage) => {
      if (message.roomId !== initialSnapshot.id) {
        return;
      }
      triggerRefresh();
    };

    const handleRoomEvent = (event: RoomRealtimeEvent) => {
      if (event.roomId !== initialSnapshot.id) {
        return;
      }
      triggerRefresh();
    };

    const handleConnect = () => {
      triggerRefresh();
    };

    const handleDisconnect = () => {
      triggerRefresh();
    };

    onRoomSocketConnect(handleConnect);
    socket.on("presence", handlePresence);
    socket.on("disconnect", handleDisconnect);
    onRoomEvent<RoomRealtimeEvent>("room:event", handleRoomEvent);

    return () => {
      socket.off("presence", handlePresence);
      socket.off("disconnect", handleDisconnect);
      offRoomEvent("room:event", handleRoomEvent);
      disconnectSocket();
    };
  }, [initialSnapshot.id, membershipId, mutate]);

  const refresh = useCallback(async () => {
    const result = await mutate();
    if (result) {
      setManualData(result);
    }
    return result;
  }, [mutate]);

  const room = data ?? manualData;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (membershipId) {
      window.localStorage.setItem(
        "gift-circle:last-membership",
        JSON.stringify({ roomCode: room.code, membershipId })
      );
    } else {
      window.localStorage.removeItem("gift-circle:last-membership");
    }
  }, [room.code, membershipId]);

  const currentMember = useMemo(() => {
    if (!membershipId) {
      return null;
    }
    return room.members.find((member) => member.membershipId === membershipId) ?? null;
  }, [room.members, membershipId]);

  const value = useMemo<RoomContextValue>(() => {
    return {
      room,
      membershipId,
      currentMember,
      isHost: currentMember?.role === "HOST",
      refresh,
      isLoading,
      error,
    };
  }, [room, membershipId, currentMember, refresh, isLoading, error]);

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
}
