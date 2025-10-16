import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  IDENTITY_COOKIE_NAME,
  identityCookieAttributes,
  refreshIdentityToken,
  resolveIdentity,
  updateIdentityDisplayName,
} from "@/lib/identity";
export async function GET() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(IDENTITY_COOKIE_NAME)?.value;

  const identity = await resolveIdentity(cookie);

  const response = NextResponse.json({
    userId: identity.user.id,
    displayName: identity.user.displayName,
  });

  if (identity.shouldSetCookie) {
    response.cookies.set(
      IDENTITY_COOKIE_NAME,
      identity.token,
      identityCookieAttributes(identity.payload.expiresAt)
    );
  }

  return response;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(IDENTITY_COOKIE_NAME)?.value;
  const identity = await resolveIdentity(cookie);

  const body = (await request.json().catch(() => null)) as {
    displayName?: string | null;
    reset?: boolean;
  } | null;

  if (body?.reset) {
    const resetIdentity = await resolveIdentity(undefined);
    const response = NextResponse.json({
      userId: resetIdentity.user.id,
      displayName: resetIdentity.user.displayName,
    });
    response.cookies.set(
      IDENTITY_COOKIE_NAME,
      resetIdentity.token,
      identityCookieAttributes(resetIdentity.payload.expiresAt)
    );
    return response;
  }

  const displayName = body?.displayName?.trim() || null;

  if (displayName !== identity.user.displayName) {
    const updated = await updateIdentityDisplayName(identity.user.id, displayName);
    identity.user = updated;
    identity.shouldSetCookie = true;
  }

  if (identity.shouldSetCookie) {
    refreshIdentityToken(identity);
  }

  const response = NextResponse.json({
    userId: identity.user.id,
    displayName: identity.user.displayName,
  });

  if (identity.shouldSetCookie) {
    response.cookies.set(
      IDENTITY_COOKIE_NAME,
      identity.token,
      identityCookieAttributes(identity.payload.expiresAt)
    );
  }

  return response;
}
