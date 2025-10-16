"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { useSearchParams } from "next/navigation";

import { fetchRoomSnapshot, RoomSnapshot, RoomMember } from "@/lib/rooms-client";

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

        return (
          <li
            key={member.membershipId}
            className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
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

export default function RoomStatus({ snapshot }: { snapshot: RoomSnapshot }) {
  const searchParams = useSearchParams();
  const membershipId = searchParams.get("membershipId");
  const [members, setMembers] = useState<RoomSnapshot["members"]>(snapshot.members);
  const [lastUpdated, setLastUpdated] = useState(snapshot.updatedAt);
  const [isCopying, setIsCopying] = useState(false);

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
        <MemberList members={members} currentMembershipId={membershipId} />
      </section>
    </main>
  );
}
