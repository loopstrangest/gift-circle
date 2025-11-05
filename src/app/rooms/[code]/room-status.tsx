"use client";

import React, { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { RoomMember, OfferSummary, DesireSummary } from "@/lib/rooms-client";
import { buildCommitmentPreview } from "@/lib/room-commitments";
import { advanceRoomRound } from "@/lib/rooms-client";
import { getAdvanceLabel, ROOM_ROUND_SEQUENCE } from "@/lib/room-round";
import { useRoom } from "@/app/rooms/[code]/room-context";

function formatJoinedAt(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type MemberCommitmentSummary = ReturnType<typeof buildCommitmentPreview> extends Map<
  string,
  infer Entry
>
  ? Entry
  : never;

function MemberList({
  members,
  currentMembershipId,
  commitments,
  showCommitments,
  resolveDisplayName,
}: {
  members: RoomMember[];
  currentMembershipId?: string | null;
  commitments?: Map<string, MemberCommitmentSummary>;
  showCommitments?: boolean;
  resolveDisplayName: (membershipId: string) => string;
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
          "flex flex-col gap-2 rounded-lg border border-slate-200 px-4 py-3 shadow-sm",
          member.isActive ? "bg-white" : "bg-slate-50",
          member.isActive ? "opacity-100" : "opacity-70",
        ].join(" ");

        const summary = commitments?.get(member.membershipId);
        const giving = summary?.giving ?? [];
        const receiving = summary?.receiving ?? [];
        const hasCommitmentDetails = showCommitments && summary && (giving.length > 0 || receiving.length > 0);
        const MAX_ENTRIES = 3;

        return (
          <li key={member.membershipId} className={rowClasses}>
            <div className="flex w-full items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
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
                  {showCommitments && summary ? (
                    <span className="flex flex-wrap gap-2">
                      {giving.length > 0 ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          Giving: {giving.length}
                        </span>
                      ) : null}
                      {receiving.length > 0 ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          Receiving: {receiving.length}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 text-xs text-slate-500">
                Joined {formatJoinedAt(member.joinedAt)}
              </span>
            </div>
            {hasCommitmentDetails ? (
              <div className="w-full space-y-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {giving.length > 0 ? (
                  <div>
                    <p className="font-semibold text-emerald-700">Giving</p>
                    <ul className="mt-1 space-y-1">
                      {giving.slice(0, MAX_ENTRIES).map((entry, index) => (
                        <li key={`${entry.claimId}-giving-${index}`} className="flex flex-wrap gap-1">
                          <span className="font-medium text-slate-700">{entry.itemTitle}</span>
                          <span className="text-slate-500">
                            → {resolveDisplayName(entry.counterpartMembershipId)}
                          </span>
                        </li>
                      ))}
                      {giving.length > MAX_ENTRIES ? (
                        <li className="text-slate-500">
                          +{giving.length - MAX_ENTRIES} more commitment
                          {giving.length - MAX_ENTRIES === 1 ? "" : "s"}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                {receiving.length > 0 ? (
                  <div>
                    <p className="font-semibold text-sky-700">Receiving</p>
                    <ul className="mt-1 space-y-1">
                      {receiving.slice(0, MAX_ENTRIES).map((entry, index) => (
                        <li key={`${entry.claimId}-receiving-${index}`} className="flex flex-wrap gap-1">
                          <span className="font-medium text-slate-700">{entry.itemTitle}</span>
                          <span className="text-slate-500">
                            ← {resolveDisplayName(entry.counterpartMembershipId)}
                          </span>
                        </li>
                      ))}
                      {receiving.length > MAX_ENTRIES ? (
                        <li className="text-slate-500">
                          +{receiving.length - MAX_ENTRIES} more commitment
                          {receiving.length - MAX_ENTRIES === 1 ? "" : "s"}
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type ItemListProps = {
  title: string;
  items: (OfferSummary | DesireSummary)[];
  emptyLabel: string;
  controls?: ReactNode;
  getAuthorName?: (membershipId: string) => string | null;
  authorLabel?: string;
};

function ItemList({
  title,
  items,
  emptyLabel,
  controls,
  getAuthorName,
  authorLabel,
}: ItemListProps) {
  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        {controls ?? null}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const authorName = getAuthorName
              ? getAuthorName(item.authorMembershipId)
              : null;
            return (
              <li
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {item.title}
                    </p>
                    {authorName ? (
                    <p className="mt-1 text-xs italic text-slate-500">
                      {authorLabel ? `${authorLabel} ${authorName}` : authorName}
                    </p>
                    ) : null}
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
            );
          })}
        </ul>
      )}
    </section>
  );
}

type SortOption = "chronological" | "author";

export default function RoomStatus() {
  const { room, membershipId, isHost, refresh } = useRoom();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [offerSort, setOfferSort] = useState<SortOption>("chronological");
  const [desireSort, setDesireSort] = useState<SortOption>("chronological");

  const hostMembershipId = useMemo(() => {
    return room.members.find((member) => member.role === "HOST")?.membershipId ?? null;
  }, [room.members]);

  const roundIndex = useMemo(
    () => ROOM_ROUND_SEQUENCE.indexOf(room.currentRound),
    [room.currentRound]
  );

  const offersEnabled = roundIndex >= ROOM_ROUND_SEQUENCE.indexOf("OFFERS");
  const desiresEnabled = roundIndex >= ROOM_ROUND_SEQUENCE.indexOf("DESIRES");

  const visibleMembers = useMemo(() => {
    return room.members.slice().sort((a, b) => {
      if (a.role === "HOST") {
        return -1;
      }
      if (b.role === "HOST") {
        return 1;
      }

      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });
  }, [room.members]);

  const getMemberDisplayName = useCallback(
    (authorMembershipId: string) => {
      const member = room.members.find(
        (entry) => entry.membershipId === authorMembershipId
      );
      if (!member) {
        return "Unknown";
      }
      const nickname = member.nickname?.trim();
      const displayName = member.displayName?.trim();
      return nickname || displayName || (member.role === "HOST" ? "Host" : "Anonymous");
    },
    [room.members]
  );

  const sortedOffers = useMemo(() => {
    if (offerSort === "author") {
      return [...room.offers].sort((a, b) =>
        getMemberDisplayName(a.authorMembershipId).localeCompare(
          getMemberDisplayName(b.authorMembershipId),
          undefined,
          { sensitivity: "base" }
        )
      );
    }
    return room.offers;
  }, [room.offers, offerSort, getMemberDisplayName]);

  const sortedDesires = useMemo(() => {
    if (desireSort === "author") {
      return [...room.desires].sort((a, b) =>
        getMemberDisplayName(a.authorMembershipId).localeCompare(
          getMemberDisplayName(b.authorMembershipId),
          undefined,
          { sensitivity: "base" }
        )
      );
    }
    return room.desires;
  }, [room.desires, desireSort, getMemberDisplayName]);

  const commitmentPreview = useMemo(() => buildCommitmentPreview(room), [room]);
  const showCommitments = room.currentRound === "DECISIONS";

  const isViewingHostControls = isHost && hostMembershipId === membershipId;

  const handleAdvanceRound = async () => {
    if (isAdvancing || !room.nextRound) {
      return;
    }

    try {
      setIsAdvancing(true);
      await advanceRoomRound(room.code);
      await refresh();
    } catch (error) {
      console.error("Failed to advance round", error);
    } finally {
      setIsAdvancing(false);
    }
  };

  const sortSelectClass =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700";

  const offerSortControls = (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      Sort by
      <select
        className={sortSelectClass}
        value={offerSort}
        onChange={(event) => setOfferSort(event.target.value as SortOption)}
      >
        <option value="chronological">Chronological</option>
        <option value="author">Author</option>
      </select>
    </label>
  );

  const desireSortControls = (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      Sort by
      <select
        className={sortSelectClass}
        value={desireSort}
        onChange={(event) => setDesireSort(event.target.value as SortOption)}
      >
        <option value="chronological">Chronological</option>
        <option value="author">Author</option>
      </select>
    </label>
  );

  return (
    <section className="flex flex-col gap-6">
      {room.canAdvance && isViewingHostControls ? (
        <section className="card flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Host Controls</h2>
            <p className="text-sm text-slate-600">
              Advance the circle when everyone is ready for the next step.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 self-start"
            onClick={handleAdvanceRound}
            disabled={isAdvancing || !room.nextRound}
          >
            {isAdvancing ? "Advancing…" : getAdvanceLabel(room.nextRound)}
          </button>
        </section>
      ) : null}

      <section className="card p-6">
        <h2 className="text-xl font-semibold text-slate-900">Participants</h2>
        <MemberList
          members={visibleMembers}
          currentMembershipId={membershipId}
          commitments={commitmentPreview}
          showCommitments={showCommitments}
          resolveDisplayName={getMemberDisplayName}
        />
      </section>

      {offersEnabled ? (
        <ItemList
          title="Offers"
          items={sortedOffers}
          emptyLabel="No offers have been shared yet."
          controls={offerSortControls}
          getAuthorName={getMemberDisplayName}
          authorLabel="From:"
        />
      ) : null}

      {desiresEnabled ? (
        <ItemList
          title="Desires"
          items={sortedDesires}
          emptyLabel="No desires have been shared yet."
          controls={desireSortControls}
          getAuthorName={getMemberDisplayName}
          authorLabel="To:"
        />
      ) : null}
    </section>
  );
}
