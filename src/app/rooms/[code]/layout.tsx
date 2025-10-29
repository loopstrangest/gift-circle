import type { Metadata } from "next";
import { cookies } from "next/headers";

import { RoomProvider } from "@/app/rooms/[code]/room-context";
import { loadRoomRouteData } from "@/app/rooms/[code]/room-loader";
import { RoomShell } from "@/app/rooms/[code]/room-shell";
import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  resolveIdentity,
} from "@/lib/identity";

export const metadata: Metadata = {
  title: "Gift Circle Room",
};

export default async function RoomLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: { code: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const cookieStore = cookies();
  const identityCookie = cookieStore.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(identityCookie);

  if (identity.shouldSetCookie) {
    cookieStore.set(
      IDENTITY_COOKIE_NAME,
      identity.token,
      identityCookieAttributes(identity.payload.expiresAt)
    );
  }

  const { snapshot, membershipId } = await loadRoomRouteData({
    params,
    searchParams,
    userId: identity.user.id,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <RoomProvider initialSnapshot={snapshot} membershipId={membershipId}>
        <RoomShell>{children}</RoomShell>
      </RoomProvider>
    </div>
  );
}
