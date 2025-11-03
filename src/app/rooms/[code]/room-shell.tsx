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

  const availableLinks = useMemo(
    () => NAV_LINKS.filter((link) => roundIndex >= link.minRoundIndex),
    [roundIndex]
  );

  const showNav = availableLinks.length > 0;
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

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
              Gift Circle
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">
                Room {room.code}
              </h1>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCopyRoomCode}
                disabled={isCopying}
              >
                {isCopying ? "Copied!" : "Copy room code"}
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <p>
                Current round:{" "}
                <span className="font-medium text-slate-900">{roundInfo.title}</span>
              </p>
            </div>
          </div>
          {showNav ? (
            <nav className="flex w-full flex-wrap justify-center gap-2 md:w-auto md:justify-start">
              {availableLinks.map((entry) => {
                const targetPath =
                  entry.href.length > 0
                    ? `/rooms/${room.code}/${entry.href}`
                    : `/rooms/${room.code}`;
                const isActive = currentPath === targetPath;

                return (
                  <Link
                    key={entry.href || "overview"}
                    href={`${targetPath}${membershipQuery}`}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {entry.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </header>

      <div className="flex-1 pb-12">{children}</div>
    </div>
  );
}
