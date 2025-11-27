"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useRoom } from "@/app/rooms/[code]/room-context";
import { getAdvanceLabel, getRoundInfo, ROOM_ROUND_SEQUENCE } from "@/lib/room-round";
import { advanceRoomRound } from "@/lib/rooms-client";

const OFFERS_INDEX = ROOM_ROUND_SEQUENCE.indexOf("OFFERS");
const DESIRES_INDEX = ROOM_ROUND_SEQUENCE.indexOf("DESIRES");
const CONNECTIONS_INDEX = ROOM_ROUND_SEQUENCE.indexOf("CONNECTIONS");
const DECISIONS_INDEX = ROOM_ROUND_SEQUENCE.indexOf("DECISIONS");
const SUMMARY_INDEX = ROOM_ROUND_SEQUENCE.indexOf("SUMMARY");

type NavLink = {
  href: string;
  label: string;
  minRoundIndex: number;
};

const NAV_LINKS: NavLink[] = [
  { href: "", label: "Overview", minRoundIndex: OFFERS_INDEX },
  { href: "offers", label: "My Offers", minRoundIndex: OFFERS_INDEX },
  { href: "desires", label: "My Desires", minRoundIndex: DESIRES_INDEX },
  { href: "connections", label: "Requests", minRoundIndex: CONNECTIONS_INDEX },
  { href: "decisions", label: "Decisions", minRoundIndex: DECISIONS_INDEX },
  { href: "summary", label: "Summary", minRoundIndex: SUMMARY_INDEX },
];

export function RoomShell({ children }: { children: ReactNode }) {
  const { room, membershipId, refresh } = useRoom();
  const pathname = usePathname();
  const router = useRouter();

  const [isCopying, setIsCopying] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(room.title ?? "");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const currentPath = pathname ?? "";
  const roundInfo = getRoundInfo(room.currentRound);
  const roundIndex = useMemo(
    () => ROOM_ROUND_SEQUENCE.indexOf(room.currentRound),
    [room.currentRound]
  );
  const showRoomMeta = room.currentRound === "WAITING";

  const isHost = useMemo(() => {
    if (!membershipId) return false;
    const membership = room.members.find((m) => m.membershipId === membershipId);
    return membership?.role === "HOST";
  }, [membershipId, room.members]);

  const availableLinks = useMemo(
    () => NAV_LINKS.filter((link) => roundIndex >= link.minRoundIndex),
    [roundIndex]
  );

  const membershipQuery = membershipId ? `?membershipId=${membershipId}` : "";

  const previousRoundRef = useRef(room.currentRound);

  useEffect(() => {
    const previousRound = previousRoundRef.current;
    if (previousRound !== room.currentRound) {
      let targetPath: string | null = null;
      if (room.currentRound === "OFFERS") {
        targetPath = `/rooms/${room.code}/offers`;
      } else if (room.currentRound === "DESIRES") {
        targetPath = `/rooms/${room.code}/desires`;
      } else if (room.currentRound === "CONNECTIONS") {
        targetPath = `/rooms/${room.code}/connections`;
      } else if (room.currentRound === "DECISIONS") {
        targetPath = `/rooms/${room.code}/decisions`;
      } else if (room.currentRound === "SUMMARY") {
        targetPath = `/rooms/${room.code}/summary`;
      }

      if (targetPath && currentPath !== targetPath) {
        router.push(`${targetPath}${membershipQuery}`);
      }

      previousRoundRef.current = room.currentRound;
    }
  }, [room.currentRound, room.code, currentPath, membershipQuery, router]);

  const handleCopyRoomCode = async () => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(room.code);
      setTimeout(() => setIsCopying(false), 1000);
    } catch (error) {
      console.error("Failed to copy room code", error);
      setIsCopying(false);
    }
  };

  const handleSaveTitle = async () => {
    if (isSavingTitle) return;

    const trimmedTitle = titleDraft.trim() || null;

    // Don't save if unchanged
    if (trimmedTitle === room.title) {
      setIsEditingTitle(false);
      return;
    }

    setIsSavingTitle(true);
    try {
      const response = await fetch(`/api/rooms/${room.code}/title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      if (!response.ok) {
        throw new Error("Failed to save title");
      }

      await refresh();
      setIsEditingTitle(false);
    } catch (error) {
      console.error("Failed to save room title", error);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelEditTitle = () => {
    setTitleDraft(room.title ?? "");
    setIsEditingTitle(false);
  };

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

  const linkBaseClasses =
    "whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold";

  return (
    <div className="min-h-screen bg-brand-sand-50">
      <div className="layout-container flex min-h-screen flex-col gap-6">
        <header
          className="section-card surface-grid space-y-6 rounded-3xl border-brand-sand-100/80 bg-white/90"
          role="banner"
        >
          <div className="flex flex-col gap-4 text-center md:text-left">
            <div className="space-y-4 text-center">
              {showRoomMeta && isHost && isEditingTitle ? (
                <div className="flex flex-col items-center gap-3">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    placeholder="Room Name"
                    className="w-full max-w-md rounded-lg border border-brand-sand-200 bg-white px-4 py-2 text-center text-2xl font-semibold text-brand-ink-900 placeholder:text-brand-ink-400 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                    maxLength={100}
                    disabled={isSavingTitle}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-gold text-sm"
                      onClick={handleSaveTitle}
                      disabled={isSavingTitle}
                    >
                      {isSavingTitle ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline text-sm"
                      onClick={handleCancelEditTitle}
                      disabled={isSavingTitle}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <h1 className="text-4xl font-semibold text-brand-ink-900">
                    {room.title || "Gift Circle"}
                  </h1>
                  {showRoomMeta && isHost && !room.title ? (
                    <button
                      type="button"
                      className="text-sm text-brand-ink-500 hover:text-brand-gold underline"
                      onClick={() => setIsEditingTitle(true)}
                    >
                      Customize room name
                    </button>
                  ) : null}
                  {showRoomMeta && isHost && room.title ? (
                    <button
                      type="button"
                      className="text-sm text-brand-ink-500 hover:text-brand-gold underline"
                      onClick={() => {
                        setTitleDraft(room.title ?? "");
                        setIsEditingTitle(true);
                      }}
                    >
                      Customize room name
                    </button>
                  ) : null}
                </div>
              )}
              {showRoomMeta ? (
                <div className="space-y-3 text-brand-ink-800">
                  <p className="text-base font-semibold">Room code: {room.code}</p>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="btn-emerald"
                      onClick={handleCopyRoomCode}
                      disabled={isCopying}
                    >
                      {isCopying ? "Copied!" : "Copy room code"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-2 text-sm text-brand-ink-600">
              <p>
                Current round:{" "}
                <span className="font-medium text-brand-ink-900">{roundInfo.title}</span>
              </p>
              {roundInfo.guidance ? (
                <p className="max-w-xl text-brand-ink-600 mx-auto md:mx-0">
                  {roundInfo.guidance}
                </p>
              ) : null}
            </div>

            {room.canAdvance && isHost ? (
              <div className="pt-2">
                <button
                  type="button"
                  className="btn-gold"
                  onClick={handleAdvanceRound}
                  disabled={isAdvancing || !room.nextRound}
                  aria-live="polite"
                >
                  {isAdvancing ? "Advancing…" : getAdvanceLabel(room.nextRound)}
                </button>
              </div>
            ) : null}
          </div>

          {availableLinks.length > 0 ? (
            <nav
              aria-label="Room navigation"
            >
              <div className="flex flex-wrap items-center justify-center gap-2">
                {availableLinks.map((entry) => {
                  const targetPath =
                    entry.href.length > 0
                      ? `/rooms/${room.code}/${entry.href}`
                      : `/rooms/${room.code}`;
                  const href = `${targetPath}${membershipQuery}`;
                  const isActive = currentPath === targetPath;
                  const activeClasses =
                    "bg-brand-green text-white shadow-card hover:bg-brand-green-dark hover:text-white";
                  const inactiveClasses =
                    "text-brand-ink-600 bg-white/70 border border-brand-sand-200 hover:border-brand-gold hover:text-brand-gold";

                  return (
                    <Link
                      key={entry.href || "overview"}
                      href={href}
                      className={`${linkBaseClasses} ${
                        isActive ? activeClasses : inactiveClasses
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {entry.label}
                    </Link>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </header>

        <main className="flex-1 pb-12">
          <div className="space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
