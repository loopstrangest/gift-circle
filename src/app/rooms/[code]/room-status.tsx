"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import useSWR, { mutate } from "swr";
import { useSearchParams } from "next/navigation";

import {
  fetchRoomSnapshot,
  RoomSnapshot,
  RoomMember,
  OfferSummary,
  DesireSummary,
} from "@/lib/rooms-client";
import {
  connectToRoom,
  disconnectSocket,
  onRoomSocketConnect,
  onRoomEvent,
  offRoomEvent,
} from "@/lib/socket-client";
import type { PresenceMessage } from "@/lib/presence-types";
import type { RoomRealtimeEvent } from "@/lib/room-types";

function formatJoinedAt(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MemberList({
  members,
  currentMembershipId,
}: {
  members: RoomMember[];
  currentMembershipId?: string | null;
}) {
  return (
    <ul className="mt-4 space-y-2">
      {members.map((member) => {
        const isHost = member.role === "HOST";
        const isViewer = member.membershipId === currentMembershipId;
        const nickname = member.nickname?.trim();
        const fallBackName = member.displayName?.trim();
        const primaryName = nickname || fallBackName || (isHost ? "Host" : "Anonymous");
        const rowClasses = [
          "flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3 shadow-sm",
          member.isActive ? "bg-white" : "bg-slate-50",
          member.isActive ? "opacity-100" : "opacity-70",
        ].join(" ");

        return (
          <li key={member.membershipId} className={rowClasses}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-slate-900">
                  {primaryName}
                </p>
                {isHost ? (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Host
                  </span>
                ) : null}
                {isViewer ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    You
                  </span>
                ) : null}
              </div>
            </div>
            <span className="text-xs text-slate-500">
              Joined {formatJoinedAt(member.joinedAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ItemList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: (OfferSummary | DesireSummary)[];
  emptyLabel: string;
}) {
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.title}
                  </p>
                  {item.details ? (
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {item.details}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {item.status.toLowerCase()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function RoomStatus({ snapshot }: { snapshot: RoomSnapshot }) {
  const searchParams = useSearchParams();
  const membershipId = searchParams.get("membershipId");
  const [members, setMembers] = useState<RoomSnapshot["members"]>(snapshot.members);
  const [lastUpdated, setLastUpdated] = useState(snapshot.updatedAt);
  const [isCopying, setIsCopying] = useState(false);
  const membershipIdRef = useRef<string | null>(membershipId);

  useEffect(() => {
    membershipIdRef.current = membershipId;
  }, [membershipId]);

  const fetcher = useCallback(async () => {
    return fetchRoomSnapshot(snapshot.code);
  }, [snapshot.code]);

  const { data: latest } = useSWR(["room", snapshot.code], fetcher, {
    fallbackData: snapshot,
    refreshInterval: 5_000,
  });

  const roomData = latest ?? snapshot;

  useEffect(() => {
    setMembers(roomData.members);
    setLastUpdated(roomData.updatedAt);
  }, [roomData.members, roomData.updatedAt]);

  useEffect(() => {
    const socket = connectToRoom({
      roomId: snapshot.id,
      membershipId: membershipId ?? undefined,
    });

    const handlePresence = (message: PresenceMessage) => {
      if (message.roomId !== snapshot.id) {
        return;
      }

      switch (message.type) {
        case "refresh":
        case "member:connected":
        case "member:disconnected": {
          mutate(["room", snapshot.code]);
          break;
        }
        default:
          break;
      }
    };

    const handleRoomEvent = (event: RoomRealtimeEvent) => {
      if (event.roomId !== snapshot.id) {
        return;
      }

      mutate(["room", snapshot.code]);
    };

    const handleConnect = () => {
      mutate(["room", snapshot.code]);
    };

    const handleDisconnect = () => {
      mutate(["room", snapshot.code]);
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
  }, [snapshot.id, snapshot.code, membershipId]);

  const visibleMembers = members.slice().sort((a, b) => {
    if (a.role === b.role) {
      if (a.isActive === b.isActive) {
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      }
      return a.isActive ? -1 : 1;
    }
    return a.role === "HOST" ? -1 : 1;
  });

  const handleCopyCode = async () => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(roomData.code);
      setTimeout(() => setIsCopying(false), 1000);
    } catch (error) {
      console.error("Failed to copy room code", error);
      setIsCopying(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              Room {roomData.code}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Hosted by{" "}
              <span className="font-medium text-slate-900">
                {roomData.hostName ?? "Anonymous"}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Last updated {formatJoinedAt(lastUpdated)}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCopyCode}
            disabled={isCopying}
          >
            {isCopying ? "Copied!" : "Copy room code"}
          </button>
        </div>
      </header>

      <section className="card p-6">
        <h2 className="text-xl font-semibold text-slate-900">Participants</h2>
        <MemberList members={visibleMembers} currentMembershipId={membershipId} />
      </section>

      <ItemList
        title="Offers"
        items={roomData.offers}
        emptyLabel="No offers have been shared yet."
      />

      <ItemList
        title="Desires"
        items={roomData.desires}
        emptyLabel="No desires have been shared yet."
      />
    </main>
  );
}
