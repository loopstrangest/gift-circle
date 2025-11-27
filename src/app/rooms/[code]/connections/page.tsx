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

type RequestTab = "offers" | "desires";


export default function ConnectionsPage() {
  const { room, membershipId, refresh } = useRoom();
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RequestTab>("offers");

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

  const myClaimerClaims = useMemo(() => {
    if (!membershipId) {
      return [] as ClaimSummary[];
    }
    return room.claims
      .filter((claim) => claim.claimerMembershipId === membershipId)
      .slice()
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }, [room.claims, membershipId]);

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
    const hasPendingRequest = myClaimerClaims.some(
      (c) =>
        c.status === "PENDING" &&
        ((kind === "offer" && c.offerId === entity.id) ||
          (kind === "desire" && c.desireId === entity.id))
    );
    if (hasPendingRequest) {
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
    const claimGate = canStartClaim(offer, "offer");
    const isCreating =
      actionState.status === "creating" && actionState.targetId === offer.id;
    const myPendingClaim = myClaimerClaims.find(
      (c) => c.offerId === offer.id && c.status === "PENDING"
    );
    const isWithdrawing =
      actionState.status === "withdrawing" && myPendingClaim && actionState.claimId === myPendingClaim.id;

    return (
      <li
        key={offer.id}
        className="rounded-lg border border-brand-sand-100 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-brand-ink-900">{offer.title}</p>
            {offer.details ? (
              <p className="text-sm text-brand-ink-600 whitespace-pre-line">{offer.details}</p>
            ) : null}
            <p className="text-xs text-brand-ink-500">
              From {getMemberDisplayName(offer.authorMembershipId)}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            {myPendingClaim ? (
              <button
                type="button"
                className="btn-danger text-xs"
                onClick={() => handleWithdrawClaim(myPendingClaim)}
                disabled={isWithdrawing || actionState.status !== "idle"}
              >
                {isWithdrawing ? "Withdrawing…" : "Withdraw"}
              </button>
            ) : (
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
            )}
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
    const claimGate = canStartClaim(desire, "desire");
    const isCreating =
      actionState.status === "creating" && actionState.targetId === desire.id;
    const myPendingClaim = myClaimerClaims.find(
      (c) => c.desireId === desire.id && c.status === "PENDING"
    );
    const isWithdrawing =
      actionState.status === "withdrawing" && myPendingClaim && actionState.claimId === myPendingClaim.id;

    return (
      <li
        key={desire.id}
        className="rounded-lg border border-brand-sand-100 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold text-brand-ink-900">{desire.title}</p>
            {desire.details ? (
              <p className="text-sm text-brand-ink-600 whitespace-pre-line">{desire.details}</p>
            ) : null}
            <p className="text-xs text-brand-ink-500">
              For {getMemberDisplayName(desire.authorMembershipId)}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            {myPendingClaim ? (
              <button
                type="button"
                className="btn-danger text-xs"
                onClick={() => handleWithdrawClaim(myPendingClaim)}
                disabled={isWithdrawing || actionState.status !== "idle"}
              >
                {isWithdrawing ? "Withdrawing…" : "Withdraw"}
              </button>
            ) : (
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
            )}
          </div>
        </div>
      </li>
    );
  });

  return (
    <div className="space-y-6">
      <header className="section-card space-y-4" role="banner">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold text-brand-ink-900">Requests</h1>
          <p className="text-sm text-brand-ink-600">
            Request to receive offers and fulfill desires.
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
          <h2 className="section-heading">Waiting for Requests</h2>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Requests are only available during the Connections round.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto border-b border-brand-sand-200 px-1">
            <button
              type="button"
              onClick={() => setActiveTab("offers")}
              className={[
                "whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "offers"
                  ? "border-b-2 border-brand-gold text-brand-gold-dark"
                  : "text-brand-ink-600 hover:text-brand-ink-900",
              ].join(" ")}
            >
              Open Offers ({visibleOffers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("desires")}
              className={[
                "whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors",
                activeTab === "desires"
                  ? "border-b-2 border-brand-gold text-brand-gold-dark"
                  : "text-brand-ink-600 hover:text-brand-ink-900",
              ].join(" ")}
            >
              Open Desires ({visibleDesires.length})
            </button>
          </div>

          {activeTab === "offers" ? (
            <section className="section-card space-y-4" aria-labelledby="open-offers-heading">
              <h2 id="open-offers-heading" className="section-heading">
                Open Offers
              </h2>
              {offerCards.length === 0 ? (
                <div className="empty-state">
                  The other participants did not share any offers.
                </div>
              ) : (
                <ul className="space-y-4">{offerCards}</ul>
              )}
            </section>
          ) : null}

          {activeTab === "desires" ? (
            <section className="section-card space-y-4" aria-labelledby="open-desires-heading">
              <h2 id="open-desires-heading" className="section-heading">
                Open Desires
              </h2>
              {desireCards.length === 0 ? (
                <div className="empty-state">
                  The other participants did not share any desires.
                </div>
              ) : (
                <ul className="space-y-4">{desireCards}</ul>
              )}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
