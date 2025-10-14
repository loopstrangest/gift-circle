"use client";

import useSWR from "swr";
import { useCallback, useMemo } from "react";

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

function MemberList({ members }: { members: RoomMember[] }) {
  const grouped = useMemo(() => {
    return members.reduce<{
      host: RoomMember[];
      participants: RoomMember[];
    }>(
      (acc, member) => {
        if (member.role === "HOST") {
          acc.host.push(member);
        } else {
          acc.participants.push(member);
        }
        return acc;
      },
      { host: [], participants: [] }
    );
  }, [members]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-700">Host</h3>
        <ul className="mt-2 space-y-2">
          {grouped.host.map((member) => (
            <li
              key={member.membershipId}
              className="flex items-center justify-between rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-indigo-900">
                  {member.displayName ?? "Host"}
                </p>
                {member.nickname ? (
                  <p className="text-xs text-indigo-700">
                    Nickname: {member.nickname}
                  </p>
                ) : null}
              </div>
              <span className="text-xs text-indigo-800">
                Joined {formatJoinedAt(member.joinedAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700">
          Participants ({grouped.participants.length})
        </h3>
        {grouped.participants.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No participants yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {grouped.participants.map((member) => (
              <li
                key={member.membershipId}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {member.displayName ?? "Anonymous"}
                  </p>
                  {member.nickname ? (
                    <p className="text-xs text-slate-500">
                      Nickname: {member.nickname}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-slate-500">
                  Joined {formatJoinedAt(member.joinedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function RoomStatus({ snapshot }: { snapshot: RoomSnapshot }) {
  const data = useRoomSnapshot(snapshot);

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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Participants</h2>
          <span className="text-sm text-slate-500">
            Total: {data.members.length}
          </span>
        </div>
        <MemberList members={data.members} />
      </section>
    </main>
  );
}
