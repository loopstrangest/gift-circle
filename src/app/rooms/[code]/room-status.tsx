"use client";

import useSWR from "swr";
import { useCallback } from "react";
import { useSearchParams } from "next/navigation";

import {
  fetchRoomSnapshot,
  RoomSnapshot,
  RoomMember,
} from "@/lib/rooms-client";

const REFRESH_INTERVAL_MS = 3_000;

function useRoomSnapshot(initial: RoomSnapshot) {
  const fetcher = useCallback(async () => {
    return fetchRoomSnapshot(initial.code);
  }, [initial.code]);

  const { data } = useSWR(["room", initial.code], fetcher, {
    fallbackData: initial,
    refreshInterval: REFRESH_INTERVAL_MS,
  });

  return data ?? initial;
}

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
        const isActive = member.membershipId === currentMembershipId;
        const baseName = member.displayName ?? (isHost ? "Host" : "Anonymous");
        const nickname = member.nickname?.trim();
        const showNickname = Boolean(nickname && nickname !== baseName);

        return (
          <li
            key={member.membershipId}
            data-active={isActive}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm data-[active=true]:border-indigo-200 data-[active=true]:bg-indigo-50"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-slate-900 data-[active=true]:text-indigo-900">
                  {baseName}
                </p>
                {isHost ? (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    Host
                  </span>
                ) : null}
              </div>
              {showNickname ? (
                <p className="text-xs text-slate-500 data-[active=true]:text-indigo-700">
                  Nickname: {nickname}
                </p>
              ) : null}
            </div>
            <span className="text-xs text-slate-500 data-[active=true]:text-indigo-800">
              Joined {formatJoinedAt(member.joinedAt)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function RoomStatus({ snapshot }: { snapshot: RoomSnapshot }) {
  const data = useRoomSnapshot(snapshot);
  const searchParams = useSearchParams();
  const membershipId = searchParams.get("membershipId");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900">
          Room {data.code}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Hosted by{" "}
          <span className="font-medium text-slate-900">
            {data.hostName ?? "Anonymous"}
          </span>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Last updated {formatJoinedAt(data.updatedAt)}
        </p>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Participants</h2>
        <MemberList members={data.members} currentMembershipId={membershipId} />
      </section>
    </main>
  );
}
