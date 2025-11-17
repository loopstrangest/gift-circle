"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { useRoom } from "@/app/rooms/[code]/room-context";
import { getRoundInfo, ROOM_ROUND_SEQUENCE } from "@/lib/room-round";

const OFFERS_INDEX = ROOM_ROUND_SEQUENCE.indexOf("OFFERS");
const DESIRES_INDEX = ROOM_ROUND_SEQUENCE.indexOf("DESIRES");
const CONNECTIONS_INDEX = ROOM_ROUND_SEQUENCE.indexOf("CONNECTIONS");
const DECISIONS_INDEX = ROOM_ROUND_SEQUENCE.indexOf("DECISIONS");

type NavLink = {
  href: string;
  label: string;
  minRoundIndex: number;
};

const NAV_LINKS: NavLink[] = [
  { href: "", label: "Overview", minRoundIndex: OFFERS_INDEX },
  { href: "offers", label: "My Offers", minRoundIndex: OFFERS_INDEX },
  { href: "desires", label: "My Desires", minRoundIndex: DESIRES_INDEX },
  { href: "connections", label: "Connections", minRoundIndex: CONNECTIONS_INDEX },
  { href: "decisions", label: "Decisions", minRoundIndex: DECISIONS_INDEX },
];

export function RoomShell({ children }: { children: ReactNode }) {
  const { room, membershipId } = useRoom();
  const pathname = usePathname();
  const router = useRouter();

  const [isCopying, setIsCopying] = useState(false);

  const currentPath = pathname ?? "";
  const roundInfo = getRoundInfo(room.currentRound);
  const roundIndex = useMemo(
    () => ROOM_ROUND_SEQUENCE.indexOf(room.currentRound),
    [room.currentRound]
  );
  const showRoomMeta = room.currentRound === "WAITING";

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

  const linkBaseClasses =
    "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="layout-container flex min-h-screen flex-col gap-6">
        <header className="section-card space-y-6" role="banner">
          <div className="flex flex-col gap-4">
            <div className="space-y-4 text-center">
              <h1 className="text-4xl font-semibold text-slate-900">Gift Circle</h1>
              {showRoomMeta ? (
                <div className="space-y-3">
                  <p className="text-base font-semibold text-slate-900">
                    Room {room.code}
                  </p>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCopyRoomCode}
                      disabled={isCopying}
                    >
                      {isCopying ? "Copied!" : "Copy room code"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-1 text-sm text-slate-600 text-center md:text-left">
              <p>
                Current round:{" "}
                <span className="font-medium text-slate-900">{roundInfo.title}</span>
              </p>
              {roundInfo.guidance ? (
                <p className="max-w-xl text-slate-500 mx-auto md:mx-0">
                  {roundInfo.guidance}
                </p>
              ) : null}
            </div>
          </div>

          {availableLinks.length > 0 ? (
            <nav
              aria-label="Room navigation"
              className="-mx-2 overflow-x-auto pb-2 md:mx-0 md:pb-0"
            >
              <div className="flex w-max items-center gap-2 px-2 md:w-full md:flex-wrap md:px-0">
                {availableLinks.map((entry) => {
                  const targetPath =
                    entry.href.length > 0
                      ? `/rooms/${room.code}/${entry.href}`
                      : `/rooms/${room.code}`;
                  const href = `${targetPath}${membershipQuery}`;
                  const isActive = currentPath === targetPath;
                  const activeClasses = "bg-indigo-600 text-white shadow-sm";
                  const inactiveClasses = "text-slate-600 hover:bg-slate-100";

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
