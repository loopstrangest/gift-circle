"use client";

import React, { useCallback, useMemo, useState } from "react";

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

  const myClaimerClaims = useMemo(() => {
    if (!membershipId) {
      return [] as ClaimSummary[];
    }
    return room.claims
      .filter((claim) => claim.claimerMembershipId === membershipId)
      .slice()
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }, [room.claims, membershipId]);

  const myPendingTargets = useMemo(() => {
    const set = new Set<string>();
    for (const claim of myClaimerClaims) {
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
  }, [myClaimerClaims]);

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
      <ul className="space-y-3">
        {claims.map((claim) => {
          const authorName = getMemberDisplayName(claim.claimerMembershipId);
          return (
            <li
              key={claim.id}
              className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700">{authorName}</p>
                {claim.note ? (
                  <p className="text-xs text-slate-500 line-clamp-2">{claim.note}</p>
                ) : null}
              </div>
              <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">
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
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-slate-900">{offer.title}</p>
              {offer.details ? (
                <p className="text-sm text-slate-600 whitespace-pre-line">{offer.details}</p>
              ) : null}
              <p className="text-xs text-slate-500">
                From {getMemberDisplayName(offer.authorMembershipId)}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <button
                type="button"
                className="btn-emerald text-xs"
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
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-slate-900">{desire.title}</p>
              {desire.details ? (
                <p className="text-sm text-slate-600 whitespace-pre-line">{desire.details}</p>
              ) : null}
              <p className="text-xs text-slate-500">
                For {getMemberDisplayName(desire.authorMembershipId)}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
              <button
                type="button"
                className="btn-emerald text-xs"
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

  const myActivityEntries = useMemo(() => {
    if (!membershipId) {
      return [] as {
        claim: ClaimSummary;
        claimerName: string;
        ownerName: string;
        isClaimer: boolean;
        targetTitle: string;
        kind: "offer" | "desire";
      }[];
    }

    return room.claims
      .map((claim) => {
        const isClaimer = claim.claimerMembershipId === membershipId;
        const offer = claim.offerId
          ? room.offers.find((entry) => entry.id === claim.offerId)
          : null;
        const desire = claim.desireId
          ? room.desires.find((entry) => entry.id === claim.desireId)
          : null;
        const ownerMembershipId = offer?.authorMembershipId ?? desire?.authorMembershipId ?? null;
        const isOwner = ownerMembershipId === membershipId;

        if (!isClaimer && !isOwner) {
          return null;
        }

        const claimerName = getMemberDisplayName(claim.claimerMembershipId);
        const ownerName = ownerMembershipId
          ? getMemberDisplayName(ownerMembershipId)
          : "Unknown member";
        const targetTitle = offer?.title ?? desire?.title ?? "Entry removed";

        return {
          claim,
          claimerName,
          ownerName,
          isClaimer,
          targetTitle,
          kind: offer ? "offer" : "desire",
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort(
        (a, b) =>
          new Date(a.claim.updatedAt).getTime() - new Date(b.claim.updatedAt).getTime()
      );
  }, [membershipId, room.claims, room.desires, room.offers, getMemberDisplayName]);

  const withdrawingClaimId =
    actionState.status === "withdrawing" ? actionState.claimId : null;

  return (
    <div className="space-y-6">
      <header className="section-card space-y-4" role="banner">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-slate-900">Connections</h1>
          <p className="text-sm text-slate-600">
          Reach out to receive offers or fulfill desires. Everyone will see new requests
          in real time.
        </p>
        </div>
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {!isConnectionsRound ? (
        <section className="section-card space-y-2">
          <h2 className="section-heading">Waiting for Connections</h2>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Claim requests are only available during the Connections round.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="section-card space-y-4" aria-labelledby="open-offers-heading">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="open-offers-heading" className="section-heading">
                  Open Offers
                </h2>
                {offerCards.length > 0 ? (
                  <p className="text-xs text-slate-500">Request to receive others&apos; offers.</p>
                ) : null}
              </div>
              {offerCards.length === 0 ? (
                <div className="empty-state">
                  The other participants did not share any offers.
                </div>
              ) : (
                <ul className="space-y-4">{offerCards}</ul>
              )}
            </section>

            <section className="section-card space-y-4" aria-labelledby="open-desires-heading">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="open-desires-heading" className="section-heading">
                  Open Desires
                </h2>
                {desireCards.length > 0 ? (
                  <p className="text-xs text-slate-500">Request to fulfill others&apos; desires.</p>
                ) : null}
              </div>
              {desireCards.length === 0 ? (
                <div className="empty-state">
                  The other participants did not share any desires.
                </div>
              ) : (
                <ul className="space-y-4">{desireCards}</ul>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="section-card space-y-4" aria-labelledby="my-activity-heading">
              <h2 id="my-activity-heading" className="section-heading">
                My Activity
              </h2>
              {myActivityEntries.length === 0 ? (
                <div className="empty-state">
                  You haven&apos;t sent any requests yet.
                </div>
              ) : (
                <ul className="space-y-3">
                  {myActivityEntries.map(
                    ({ claim, claimerName, ownerName, isClaimer, targetTitle, kind }) => {
                      const actionVerb = kind === "offer" ? "receive" : "give";
                      const directionWord = kind === "offer" ? "from" : "to";
                      const canWithdraw =
                        isClaimer && claim.status === "PENDING" && actionState.status === "idle";

                    return (
                      <li
                        key={claim.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <p className="text-sm text-slate-700">
                                  <span className="font-semibold text-slate-900">
                                    {claimerName}
                                  </span>{" "}
                                  has requested to {actionVerb}{" "}
                                  <span className="font-semibold italic text-slate-900">
                                    {targetTitle}
                                  </span>{" "}
                                  {directionWord} {ownerName}.
                                </p>
                          {canWithdraw ? (
                            <button
                              type="button"
                              className="btn-outline text-xs whitespace-nowrap"
                              onClick={() => handleWithdrawClaim(claim)}
                              disabled={withdrawingClaimId === claim.id}
                            >
                              {withdrawingClaimId === claim.id ? "Withdrawing…" : "Withdraw"}
                            </button>
                          ) : (
                            <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold capitalize text-slate-600">
                              {STATUS_LABELS[claim.status] ?? claim.status.toLowerCase()}
                            </span>
                          )}
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
