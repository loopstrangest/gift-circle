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

type MaybePromise<T> = T | Promise<T>;

export default async function RoomLayout({
  children,
  params,
  searchParams,
}: {
  children: React.ReactNode;
  params: MaybePromise<{ code: string }>;
  searchParams?: MaybePromise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = searchParams
    ? await Promise.resolve(searchParams)
    : undefined;

  const cookieStore = await cookies();
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
    params: resolvedParams,
    searchParams: resolvedSearchParams,
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
