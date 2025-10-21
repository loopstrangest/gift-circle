import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import RoomStatus from "@/app/rooms/[code]/room-status";
import { getRoomSnapshot } from "@/app/rooms/[code]/room-status-data";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  const membershipId = Array.isArray(query?.membershipId)
    ? query?.membershipId[0]
    : query?.membershipId;

  const roomCode = code?.toUpperCase();
  if (!roomCode || roomCode.length !== 6) {
    notFound();
  }

  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: {
      host: true,
      memberships: {
        include: { user: true },
      },
      offers: true,
      desires: true,
    },
  });

  if (!room) {
    notFound();
  }

  if (membershipId) {
    const membershipExists = room.memberships.some(
      (membership) => membership.id === membershipId
    );
    if (!membershipExists) {
      redirect(`/rooms/${room.code}`);
    }
  }

  const snapshot = await getRoomSnapshot(room);

  return <RoomStatus snapshot={snapshot} />;
}
