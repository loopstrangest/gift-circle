import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

export type IdentityTokenPayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

export type ResolvedIdentity = {
  user: Exclude<Awaited<ReturnType<typeof prisma.user.findUnique>>, null>;
  token: string;
  payload: IdentityTokenPayload;
  shouldSetCookie: boolean;
};

const IDENTITY_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const IDENTITY_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const IDENTITY_COOKIE_NAME = "gc_identity";

function getIdentitySecret() {
  const secret =
    process.env.IDENTITY_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("IDENTITY_SECRET environment variable must be configured");
  }

  return "local-development-identity-secret";
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string) {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = `${input}${"=".repeat(padLength)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function signPayload(payload: string) {
  const secret = getIdentitySecret();
  return createHmac("sha256", secret).update(payload).digest();
}

export function encodeIdentityToken(payload: IdentityTokenPayload) {
  const payloadJson = JSON.stringify(payload);
  const payloadSegment = base64UrlEncode(payloadJson);
  const signature = signPayload(payloadSegment);
  const signatureSegment = base64UrlEncode(signature);
  return `${payloadSegment}.${signatureSegment}`;
}

export function decodeIdentityToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) {
    return null;
  }

  try {
    const expectedSignature = signPayload(payloadSegment);
    const providedSignature = base64UrlDecode(signatureSegment);

    if (expectedSignature.length !== providedSignature.length) {
      return null;
    }

    if (!timingSafeEqual(expectedSignature, providedSignature)) {
      return null;
    }

    const payloadJson = base64UrlDecode(payloadSegment).toString("utf8");
    const parsed = JSON.parse(payloadJson) as IdentityTokenPayload;

    if (
      typeof parsed?.userId !== "string" ||
      typeof parsed?.issuedAt !== "number" ||
      typeof parsed?.expiresAt !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to decode identity token", error);
    return null;
  }
}

export function createIdentityPayload(userId: string, now = Date.now()) {
  return {
    userId,
    issuedAt: now,
    expiresAt: now + IDENTITY_COOKIE_MAX_AGE_MS,
  } satisfies IdentityTokenPayload;
}

export function shouldRefreshIdentity(payload: IdentityTokenPayload, now = Date.now()) {
  return payload.expiresAt - now < IDENTITY_REFRESH_THRESHOLD_MS;
}

export function refreshIdentityToken(identity: ResolvedIdentity, now = Date.now()) {
  const refreshedPayload = createIdentityPayload(identity.user.id, now);
  identity.payload = refreshedPayload;
  identity.token = encodeIdentityToken(refreshedPayload);
  identity.shouldSetCookie = true;
  return identity;
}

export async function updateIdentityDisplayName(
  userId: string,
  displayName: string | null
) {
  return prisma.user.update({
    where: { id: userId },
    data: { displayName },
  });
}

export async function resolveIdentity(
  token: string | undefined
): Promise<ResolvedIdentity> {
  const now = Date.now();
  const payload = decodeIdentityToken(token);

  if (payload && payload.expiresAt > now) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (user) {
      const identity: ResolvedIdentity = {
        user,
        payload,
        token: token!,
        shouldSetCookie: false,
      };
      if (shouldRefreshIdentity(payload, now)) {
        refreshIdentityToken(identity, now);
      }
      return identity;
    }
  }

  const user = await prisma.user.create({ data: {} });
  const freshPayload = createIdentityPayload(user.id, now);
  const freshToken = encodeIdentityToken(freshPayload);

  return {
    user,
    payload: freshPayload,
    token: freshToken,
    shouldSetCookie: true,
  };
}

export function identityCookieAttributes(expiresAt: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    expires: new Date(expiresAt),
  };
}
