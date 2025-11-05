"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { decideClaimApi, type ClaimSummary } from "@/lib/rooms-client";
import { useRoom } from "@/app/rooms/[code]/room-context";
import { buildCommitmentPreview } from "@/lib/room-commitments";

type ActionState =
  | { status: "idle" }
  | { status: "updating"; claimId: string; decision: "ACCEPTED" | "DECLINED" };

type PdfState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

const STATUS_LABELS: Record<ClaimSummary["status"], string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

export default function DecisionsPage() {
  const { room, membershipId, refresh } = useRoom();
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pdfState, setPdfState] = useState<PdfState>({ status: "idle" });

  const isDecisionsRound = room.currentRound === "DECISIONS";

  const commitmentPreview = useMemo(() => buildCommitmentPreview(room), [room]);
  const viewerCommitments = useMemo(() => {
    if (!membershipId) {
      return null;
    }
    return commitmentPreview.get(membershipId) ?? null;
  }, [commitmentPreview, membershipId]);

  const hasAcceptedCommitment = useMemo(() => {
    if (!viewerCommitments) {
      return false;
    }
    return (
      viewerCommitments.giving.length > 0 || viewerCommitments.receiving.length > 0
    );
  }, [viewerCommitments]);

  const getMemberDisplayName = useCallback(
    (memberId: string) => {
      const member = room.members.find((entry) => entry.membershipId === memberId);
      if (!member) {
        return "Unknown";
      }
      const nickname = member.nickname?.trim();
      const name = member.displayName?.trim();
      if (nickname) {
        return nickname;
      }
      if (name) {
        return name;
      }
      return member.role === "HOST" ? "Host" : "Participant";
    },
    [room.members]
  );

  const offerTargets = useMemo(() => {
    if (!membershipId) {
      return [] as {
        item: (typeof room.offers)[number];
        claims: ClaimSummary[];
      }[];
    }

    return room.offers
      .filter((offer) => offer.authorMembershipId === membershipId)
      .map((offer) => ({
        item: offer,
        claims: room.claims
          .filter((claim) => claim.offerId === offer.id)
          .slice()
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }))
      .filter((entry) => entry.claims.length > 0);
  }, [membershipId, room]);

  const desireTargets = useMemo(() => {
    if (!membershipId) {
      return [] as {
        item: (typeof room.desires)[number];
        claims: ClaimSummary[];
      }[];
    }

    return room.desires
      .filter((desire) => desire.authorMembershipId === membershipId)
      .map((desire) => ({
        item: desire,
        claims: room.claims
          .filter((claim) => claim.desireId === desire.id)
          .slice()
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      }))
      .filter((entry) => entry.claims.length > 0);
  }, [membershipId, room]);

  const pendingDecisionCount = useMemo(() => {
    return room.claims.filter((claim) => {
      if (claim.status !== "PENDING") {
        return false;
      }
      return (
        (claim.offerId && room.offers.find((offer) => offer.id === claim.offerId)?.authorMembershipId === membershipId) ||
        (claim.desireId &&
          room.desires.find((desire) => desire.id === claim.desireId)?.authorMembershipId === membershipId)
      );
    }).length;
  }, [membershipId, room.claims, room.desires, room.offers]);

  const handleDecision = async (claim: ClaimSummary, decision: "ACCEPTED" | "DECLINED") => {
    if (actionState.status === "updating") {
      return;
    }

    setError(null);
    setActionState({ status: "updating", claimId: claim.id, decision });

    try {
      await decideClaimApi(room.code, claim.id, decision);
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to update the request.";
      setError(message);
    } finally {
      setActionState({ status: "idle" });
    }
  };

  const isUpdatingClaim = useCallback(
    (claimId: string, decision: "ACCEPTED" | "DECLINED") => {
      return (
        actionState.status === "updating" &&
        actionState.claimId === claimId &&
        actionState.decision === decision
      );
    },
    [actionState]
  );

  const handleDownloadPdf = useCallback(async () => {
    if (!membershipId || pdfState.status === "loading" || !hasAcceptedCommitment) {
      return;
    }

    setPdfState({ status: "loading" });

    try {
      const response = await fetch(`/api/rooms/${room.code}/export`, {
        headers: {
          Accept: "application/pdf",
        },
      });

      if (!response.ok) {
        const payload = await response
          .json()
          .catch(() => ({ message: "Failed to generate PDF." }));
        const message =
          (payload as { message?: string; error?: string }).message ??
          (payload as { error?: string }).error ??
          "Failed to generate PDF.";
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `gift-circle-${room.code}-${membershipId}.pdf`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setPdfState({ status: "success" });
    } catch (err) {
      const message = (err as Error)?.message ?? "Failed to generate PDF.";
      setPdfState({ status: "error", message });
    }
  }, [membershipId, pdfState.status, room.code, hasAcceptedCommitment]);

  useEffect(() => {
    if (pdfState.status === "success" || pdfState.status === "error") {
      const timer = window.setTimeout(() => {
        setPdfState({ status: "idle" });
      }, 4000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pdfState.status]);

  const renderClaims = (claims: ClaimSummary[]) => {
    if (claims.length === 0) {
      return <p className="text-sm text-slate-500">No requests for this entry.</p>;
    }

    return (
      <ul className="mt-3 space-y-3">
        {claims.map((claim) => {
          const claimerName = getMemberDisplayName(claim.claimerMembershipId);
          const isPending = claim.status === "PENDING";

          return (
            <li
              key={claim.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{claimerName}</p>
                    {claim.note ? (
                      <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                        {claim.note}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-semibold capitalize text-slate-600">
                    {STATUS_LABELS[claim.status] ?? claim.status}
                  </span>
                </div>

                {isPending ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={actionState.status === "updating"}
                      onClick={() => handleDecision(claim, "ACCEPTED")}
                    >
                      {isUpdatingClaim(claim.id, "ACCEPTED") ? "Accepting…" : "Accept"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={actionState.status === "updating"}
                      onClick={() => handleDecision(claim, "DECLINED")}
                    >
                      {isUpdatingClaim(claim.id, "DECLINED") ? "Declining…" : "Decline"}
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold text-slate-900">Decisions</h1>
            <p className="mt-3 text-sm text-slate-600">
              Accept or decline your incoming requests.
            </p>
          </div>
          <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
            {isDecisionsRound ? (
              <div className="rounded-md bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
                {pendingDecisionCount === 0
                  ? "All decisions are up to date."
                  : `${pendingDecisionCount} pending ${pendingDecisionCount === 1 ? "decision" : "decisions"}.`}
              </div>
            ) : null}
            {isDecisionsRound && membershipId ? (
              <div className="flex flex-col items-start gap-1 md:items-end">
                <button
                  type="button"
                  className={`btn-secondary text-xs ${
                    !hasAcceptedCommitment || pdfState.status === "loading"
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  }`}
                  onClick={handleDownloadPdf}
                  disabled={
                    pdfState.status === "loading" || !hasAcceptedCommitment
                  }
                  title={
                    !hasAcceptedCommitment
                      ? "Available after you have at least one accepted commitment."
                      : undefined
                  }
                >
                  {pdfState.status === "loading"
                    ? "Preparing PDF…"
                    : "Download my commitments"}
                </button>
                {pdfState.status === "success" ? (
                  <span className="text-xs text-green-600">Download started.</span>
                ) : null}
                {pdfState.status === "error" ? (
                  <span className="text-xs text-red-600">{pdfState.message}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {!isDecisionsRound ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Decisions will be available once the host advances the room to the Decisions round.
          </p>
        ) : null}
        {!membershipId ? (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Join the room to manage requests made on your offers and desires.
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {isDecisionsRound && membershipId ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Offers awaiting decisions</h2>
              <span className="text-xs text-slate-500">
                {offerTargets.length === 0
                  ? "No requests on your offers."
                  : `${offerTargets.length} offer${offerTargets.length === 1 ? "" : "s"} with requests.`}
              </span>
            </div>
            {offerTargets.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Once others request your offers, they will appear here for review.
              </p>
            ) : (
              <ul className="mt-5 space-y-4">
                {offerTargets.map(({ item, claims }) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          {item.details ? (
                            <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                              {item.details}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                          {item.status.toLowerCase()}
                        </span>
                      </div>
                      {renderClaims(claims)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-900">Desires awaiting decisions</h2>
              <span className="text-xs text-slate-500">
                {desireTargets.length === 0
                  ? "No requests on your desires."
                  : `${desireTargets.length} desire${desireTargets.length === 1 ? "" : "s"} with requests.`}
              </span>
            </div>
            {desireTargets.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                Any offers to fulfill your desires will show up here for approval.
              </p>
            ) : (
              <ul className="mt-5 space-y-4">
                {desireTargets.map(({ item, claims }) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                          {item.details ? (
                            <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                              {item.details}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                          {item.status.toLowerCase()}
                        </span>
                      </div>
                      {renderClaims(claims)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

