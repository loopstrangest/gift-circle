"use client";

import { useCallback, useMemo, useState } from "react";

import {
  createClaimApi,
  withdrawClaimApi,
  type ClaimSummary,
  type DesireSummary,
  type OfferSummary,
} from "@/lib/rooms-client";
import { useRoom } from "@/app/rooms/[code]/room-context";

type ActionState =
  | { status: "idle" }
  | { status: "creating"; targetId: string }
  | { status: "withdrawing"; claimId: string };

const STATUS_LABELS: Record<ClaimSummary["status"], string> = {
  PENDING: "Pending",
  WITHDRAWN: "Withdrawn",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

export default function ConnectionsPage() {
  const { room, membershipId, refresh } = useRoom();
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  const isConnectionsRound = room.currentRound === "CONNECTIONS";

  const getMemberDisplayName = useCallback(
    (membership: string) => {
      const entry = room.members.find((member) => member.membershipId === membership);
      if (!entry) {
        return "Unknown";
      }
      const nickname = entry.nickname?.trim();
      const name = entry.displayName?.trim();
      if (nickname) {
        return nickname;
      }
      if (name) {
        return name;
      }
      return entry.role === "HOST" ? "Host" : "Participant";
    },
    [room.members]
  );

  const claimsByOffer = useMemo(() => {
    const map = new Map<string, ClaimSummary[]>();
    for (const claim of room.claims) {
      if (!claim.offerId) {
        continue;
      }
      const current = map.get(claim.offerId) ?? [];
      current.push(claim);
      map.set(claim.offerId, current);
    }
    return map;
  }, [room.claims]);

  const claimsByDesire = useMemo(() => {
    const map = new Map<string, ClaimSummary[]>();
    for (const claim of room.claims) {
      if (!claim.desireId) {
        continue;
      }
      const current = map.get(claim.desireId) ?? [];
      current.push(claim);
      map.set(claim.desireId, current);
    }
    return map;
  }, [room.claims]);

  const myClaims = useMemo(() => {
    if (!membershipId) {
      return [] as ClaimSummary[];
    }
    return room.claims
      .filter((claim) => claim.claimerMembershipId === membershipId)
      .slice()
      .sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [room.claims, membershipId]);

  const myPendingTargets = useMemo(() => {
    const set = new Set<string>();
    for (const claim of myClaims) {
      if (claim.status === "PENDING") {
        if (claim.offerId) {
          set.add(`offer:${claim.offerId}`);
        }
        if (claim.desireId) {
          set.add(`desire:${claim.desireId}`);
        }
      }
    }
    return set;
  }, [myClaims]);

  type ClaimTarget =
    | { kind: "offer"; item: OfferSummary }
    | { kind: "desire"; item: DesireSummary };

  const handleCreateClaim = async (target: ClaimTarget) => {
    if (!membershipId || actionState.status !== "idle") {
      return;
    }

    setError(null);
    const payload =
      target.kind === "offer"
        ? { offerId: target.item.id }
        : { desireId: target.item.id };

    setActionState({ status: "creating", targetId: target.item.id });

    try {
      await createClaimApi(room.code, payload);
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to send request.";
      setError(message);
    } finally {
      setActionState({ status: "idle" });
    }
  };

  const handleWithdrawClaim = async (claim: ClaimSummary) => {
    if (actionState.status !== "idle") {
      return;
    }

    setError(null);
    setActionState({ status: "withdrawing", claimId: claim.id });

    try {
      await withdrawClaimApi(room.code, claim.id);
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Unable to withdraw request.";
      setError(message);
    } finally {
      setActionState({ status: "idle" });
    }
  };

  const renderClaimList = (claims: ClaimSummary[]) => {
    if (claims.length === 0) {
      return <p className="text-xs text-slate-500">No requests yet.</p>;
    }

    return (
      <ul className="space-y-2">
        {claims.map((claim) => {
          const authorName = getMemberDisplayName(claim.claimerMembershipId);
          return (
            <li
              key={claim.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700">
                  {authorName}
                </p>
                {claim.note ? (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                    {claim.note}
                  </p>
                ) : null}
              </div>
              <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">
                {STATUS_LABELS[claim.status] ?? claim.status.toLowerCase()}
              </span>
            </li>
          );
        })}
      </ul>
    );
  };

  const canStartClaim = (
    entity: OfferSummary | DesireSummary,
    kind: ClaimTarget["kind"]
  ) => {
    if (!membershipId) {
      return { allowed: false, reason: "Join the room to make requests." };
    }
    if (entity.authorMembershipId === membershipId) {
      return { allowed: false, reason: "You cannot request your own entry." };
    }
    if (entity.status !== "OPEN") {
      return { allowed: false, reason: "This entry is closed to new requests." };
    }
    const key = `${kind}:${entity.id}`;
    if (myPendingTargets.has(key)) {
      return { allowed: false, reason: "You already have a pending request here." };
    }
    return { allowed: true };
  };

  const visibleOffers = useMemo(() => {
    return room.offers.filter((offer) => {
      if (offer.status !== "OPEN") {
        return false;
      }
      if (membershipId && offer.authorMembershipId === membershipId) {
        return false;
      }
      return true;
    });
  }, [membershipId, room.offers]);

  const offerCards = visibleOffers.map((offer) => {
    const claims = claimsByOffer.get(offer.id) ?? [];
    const claimGate = canStartClaim(offer, "offer");
    const isCreating =
      actionState.status === "creating" && actionState.targetId === offer.id;

    return (
      <li
        key={offer.id}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{offer.title}</p>
              {offer.details ? (
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                  {offer.details}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                From {getMemberDisplayName(offer.authorMembershipId)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={() => {
                  if (!claimGate.allowed) {
                    return;
                  }
                  handleCreateClaim({ kind: "offer", item: offer });
                }}
                disabled={
                  !claimGate.allowed || isCreating || actionState.status !== "idle"
                }
                title={claimGate.allowed ? undefined : claimGate.reason}
              >
                {isCreating ? "Submitting…" : "Request to Receive"}
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Requests
            </h3>
            <div className="mt-2">{renderClaimList(claims)}</div>
          </div>
        </div>
      </li>
    );
  });

  const visibleDesires = useMemo(() => {
    return room.desires.filter((desire) => {
      if (desire.status !== "OPEN") {
        return false;
      }
      if (membershipId && desire.authorMembershipId === membershipId) {
        return false;
      }
      return true;
    });
  }, [membershipId, room.desires]);

  const desireCards = visibleDesires.map((desire) => {
    const claims = claimsByDesire.get(desire.id) ?? [];
    const claimGate = canStartClaim(desire, "desire");
    const isCreating =
      actionState.status === "creating" && actionState.targetId === desire.id;

    return (
      <li
        key={desire.id}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{desire.title}</p>
              {desire.details ? (
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                  {desire.details}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                For {getMemberDisplayName(desire.authorMembershipId)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={() => {
                  if (!claimGate.allowed) {
                    return;
                  }
                  handleCreateClaim({ kind: "desire", item: desire });
                }}
                disabled={
                  !claimGate.allowed || isCreating || actionState.status !== "idle"
                }
                title={claimGate.allowed ? undefined : claimGate.reason}
              >
                {isCreating ? "Submitting…" : "Request to Give"}
              </button>
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Requests
            </h3>
            <div className="mt-2">{renderClaimList(claims)}</div>
          </div>
        </div>
      </li>
    );
  });

  const withdrawingClaimId =
    actionState.status === "withdrawing" ? actionState.claimId : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="card p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Connections</h1>
        <p className="mt-3 text-sm text-slate-600">
          Reach out to receive offers or fulfill desires. Everyone will see new requests
          in real time.
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* success messages intentionally suppressed per request */}

      {!isConnectionsRound ? (
        <section className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Waiting for Connections
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Claim requests are only available while the room is in the Connections
            round. Check back once the host advances the session.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-900">Open Offers</h2>
                <p className="text-xs text-slate-500">
                  Request to receive others&#39; offers.
                </p>
              </div>
              {offerCards.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No offers have been posted yet.
                </p>
              ) : (
                <ul className="mt-5 space-y-4">{offerCards}</ul>
              )}
            </section>

            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-slate-900">Open Desires</h2>
                <p className="text-xs text-slate-500">
                  Request to fulfill others&#39; desires.
                </p>
              </div>
              {desireCards.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No desires have been posted yet.
                </p>
              ) : (
                <ul className="mt-5 space-y-4">{desireCards}</ul>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-6">
              <h2 className="text-lg font-semibold text-slate-900">My Activity</h2>
              {myClaims.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  You haven’t sent any requests yet.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {myClaims.map((claim) => {
                    const isOffer = Boolean(claim.offerId);
                    const target = isOffer
                      ? room.offers.find((offer) => offer.id === claim.offerId)
                      : room.desires.find((desire) => desire.id === claim.desireId);
                    const targetTitle = target?.title ?? "Entry removed";
                    const targetOwnerName = target
                      ? getMemberDisplayName(target.authorMembershipId)
                      : "Unknown member";
                    const claimerName = getMemberDisplayName(claim.claimerMembershipId);
                    const description = isOffer
                      ? `${claimerName} has requested to receive`
                      : `${claimerName} has requested to give`;
                    const counterpartPhrase = isOffer
                      ? `from ${targetOwnerName}`
                      : `to ${targetOwnerName}`;
                    const canWithdraw =
                      claim.status === "PENDING" && actionState.status === "idle";

                    return (
                      <li
                        key={claim.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-slate-700">
                              <span className="font-semibold">{description}</span>{" "}
                              <em className="font-semibold italic text-slate-900">
                                {targetTitle}
                              </em>{" "}
                              {counterpartPhrase}.
                            </p>
                            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold capitalize text-slate-600">
                              {STATUS_LABELS[claim.status] ??
                                claim.status.toLowerCase()}
                            </span>
                          </div>
                          {canWithdraw ? (
                            <button
                              type="button"
                              className="btn-secondary mx-auto text-xs whitespace-nowrap"
                              onClick={() => handleWithdrawClaim(claim)}
                              disabled={withdrawingClaimId === claim.id}
                            >
                              {withdrawingClaimId === claim.id
                                ? "Withdrawing…"
                                : "Withdraw"}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
