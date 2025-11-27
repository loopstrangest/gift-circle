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

type EnjoymentState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success" }
  | { status: "error"; message: string };

function sanitizeForFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

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
  const [enjoymentDraft, setEnjoymentDraft] = useState("");
  const [enjoymentState, setEnjoymentState] = useState<EnjoymentState>({ status: "idle" });

  const isDecisionsRound = room.currentRound === "DECISIONS";

  const currentMember = useMemo(() => {
    if (!membershipId) {
      return null;
    }
    return room.members.find((m) => m.membershipId === membershipId) ?? null;
  }, [room.members, membershipId]);

  const hasSubmittedEnjoyment = Boolean(currentMember?.enjoyment);

  const commitmentPreview = useMemo(() => buildCommitmentPreview(room), [room]);
  const viewerCommitments = useMemo(() => {
    if (!membershipId) {
      return null;
    }
    return commitmentPreview.get(membershipId) ?? null;
  }, [commitmentPreview, membershipId]);

  const viewerGivingCommitments = viewerCommitments?.giving ?? [];
  const viewerReceivingCommitments = viewerCommitments?.receiving ?? [];

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
          .filter((claim) => claim.offerId === offer.id && claim.status !== "WITHDRAWN")
          .slice()
          .sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
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
          .filter((claim) => claim.desireId === desire.id && claim.status !== "WITHDRAWN")
          .slice()
          .sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
      }))
      .filter((entry) => entry.claims.length > 0);
  }, [membershipId, room]);

  const pendingDecisionCount = useMemo(() => {
    return room.claims.filter((claim) => {
      if (claim.status !== "PENDING") {
        return false;
      }
      return (
        (claim.offerId &&
          room.offers.find((offer) => offer.id === claim.offerId)
            ?.authorMembershipId === membershipId) ||
        (claim.desireId &&
          room.desires.find((desire) => desire.id === claim.desireId)
            ?.authorMembershipId === membershipId)
      );
    }).length;
  }, [membershipId, room.claims, room.desires, room.offers]);

  const handleDecision = async (
    claim: ClaimSummary,
    decision: "ACCEPTED" | "DECLINED"
  ) => {
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
      const userName = sanitizeForFilename(currentMember?.nickname || currentMember?.displayName || "participant");
      const filename = room.title
        ? `gift-circle-${sanitizeForFilename(room.title)}-${userName}.pdf`
        : `gift-circle-${userName}.pdf`;
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

  const handleSubmitEnjoyment = useCallback(async () => {
    if (!membershipId || enjoymentState.status === "saving") {
      return;
    }

    const trimmedEnjoyment = enjoymentDraft.trim();
    if (!trimmedEnjoyment) {
      return;
    }

    setEnjoymentState({ status: "saving" });

    try {
      const response = await fetch(`/api/rooms/${room.code}/enjoyment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enjoyment: trimmedEnjoyment }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ message: "Failed to save." }));
        throw new Error(
          (payload as { message?: string; error?: string }).message ??
            (payload as { error?: string }).error ??
            "Failed to save."
        );
      }

      setEnjoymentState({ status: "success" });
      setEnjoymentDraft("");
      await refresh();
    } catch (err) {
      const message = (err as Error)?.message ?? "Failed to save.";
      setEnjoymentState({ status: "error", message });
    }
  }, [membershipId, enjoymentState.status, enjoymentDraft, room.code, refresh]);

  const renderClaims = (
    claims: ClaimSummary[],
    options: { ownerName: string; direction: "offer" | "desire" }
  ) => {
    const { ownerName, direction } = options;
    if (claims.length === 0) {
      return <p className="text-sm text-brand-ink-500">No requests for this entry.</p>;
    }

    return (
      <ul className="mt-3 space-y-3">
        {claims.map((claim) => {
          const claimerName = getMemberDisplayName(claim.claimerMembershipId);
          const isPending = claim.status === "PENDING";
          const connectionText =
            direction === "offer"
              ? `${ownerName} → ${claimerName}`
              : `${claimerName} → ${ownerName}`;

          return (
            <li
              key={claim.id}
              className="rounded-lg border border-brand-sand-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-ink-900">
                      {connectionText}
                    </p>
                    {claim.note ? (
                      <p className="mt-1 text-sm text-brand-ink-600 whitespace-pre-line">
                        {claim.note}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-sand-100 px-3 py-0.5 text-xs font-semibold capitalize text-brand-ink-600">
                    {STATUS_LABELS[claim.status] ?? claim.status}
                  </span>
                </div>

                {isPending ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-emerald text-xs"
                      disabled={actionState.status === "updating"}
                      onClick={() => handleDecision(claim, "ACCEPTED")}
                    >
                      {isUpdatingClaim(claim.id, "ACCEPTED") ? "Accepting…" : "Accept"}
                    </button>
                    <button
                      type="button"
                      className="btn-outline text-xs"
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
    <div className="space-y-6">
      <header className="section-card space-y-4" role="banner">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3">
            <h1 className="text-3xl font-semibold text-brand-ink-900">Decisions</h1>
            <p className="text-sm text-brand-ink-600">
              Accept or decline your incoming requests.
            </p>
          </div>
          <div className="flex w-full flex-col items-start gap-2 md:w-auto md:items-end">
            {isDecisionsRound ? (
              <div className="rounded-md bg-brand-gold/10 px-3 py-2 text-xs font-medium text-brand-gold-dark">
                {pendingDecisionCount === 0
                  ? "No remaining decisions."
                  : `${pendingDecisionCount} pending ${pendingDecisionCount === 1 ? "decision" : "decisions"}.`}
              </div>
            ) : null}
            {membershipId ? (
              <div className="flex flex-col items-start gap-1 md:items-end">
                <button
                  type="button"
                  className={`btn-outline text-xs ${
                    !hasAcceptedCommitment || pdfState.status === "loading"
                      ? "cursor-not-allowed opacity-50"
                      : ""
                  } ${!hasAcceptedCommitment || pdfState.status === "loading" ? "hover:text-brand-ink-900 hover:border-brand-ink-500" : ""}`}
                  onClick={handleDownloadPdf}
                  disabled={pdfState.status === "loading" || !hasAcceptedCommitment}
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
                  <span className="text-xs text-brand-green">Download started.</span>
                ) : null}
                {pdfState.status === "error" ? (
                  <span className="text-xs text-red-600">{pdfState.message}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {!isDecisionsRound ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Decisions are only available during the Decisions round.
          </p>
        ) : null}
        {!membershipId ? (
          <p className="rounded-md border border-brand-sand-200 bg-brand-sand-50 px-4 py-2 text-sm text-brand-ink-600">
            Join the room to manage requests made on your offers and desires.
          </p>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {isDecisionsRound && membershipId ? (
        <section
          className="section-card space-y-4"
          aria-labelledby="my-commitments-heading"
        >
          <div>
            <h2 id="my-commitments-heading" className="section-heading">
              My Confirmed Connections
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
              <h3 className="text-sm font-semibold text-brand-green-dark">Giving</h3>
              {viewerGivingCommitments.length === 0 ? (
                <p className="text-sm text-brand-ink-500">
                  No accepted giving commitments yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {viewerGivingCommitments.map((entry) => (
                    <li key={entry.claimId} className="text-sm text-brand-ink-700">
                      <span className="font-semibold text-brand-ink-900">
                        {entry.itemTitle}
                      </span>{" "}
                      to {getMemberDisplayName(entry.counterpartMembershipId)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3 rounded-lg border border-brand-gold/20 bg-brand-gold/5 p-4">
              <h3 className="text-sm font-semibold text-brand-gold-dark">Receiving</h3>
              {viewerReceivingCommitments.length === 0 ? (
                <p className="text-sm text-brand-ink-500">
                  No accepted receiving commitments yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {viewerReceivingCommitments.map((entry) => (
                    <li key={entry.claimId} className="text-sm text-brand-ink-700">
                      <span className="font-semibold text-brand-ink-900">
                        {entry.itemTitle}
                      </span>{" "}
                      from {getMemberDisplayName(entry.counterpartMembershipId)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {isDecisionsRound && membershipId ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section
            className="section-card space-y-4"
            aria-labelledby="offers-awaiting-heading"
          >
            <h2 id="offers-awaiting-heading" className="section-heading">
              Offers awaiting decisions
            </h2>
            {offerTargets.length === 0 ? (
              <div className="empty-state">None.</div>
            ) : (
              <ul className="space-y-4">
                {offerTargets.map(({ item, claims }) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-brand-sand-100 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-brand-ink-900">
                            {item.title}
                          </p>
                          {item.details ? (
                            <p className="mt-1 text-sm text-brand-ink-600 whitespace-pre-line">
                              {item.details}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-sand-100 px-2 py-0.5 text-xs font-medium capitalize text-brand-ink-600">
                          {item.status.toLowerCase()}
                        </span>
                      </div>
                      {renderClaims(claims, {
                        ownerName: getMemberDisplayName(item.authorMembershipId),
                        direction: "offer",
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="section-card space-y-4"
            aria-labelledby="desires-awaiting-heading"
          >
            <h2 id="desires-awaiting-heading" className="section-heading">
              Desires awaiting decisions
            </h2>
            {desireTargets.length === 0 ? (
              <div className="empty-state">None.</div>
            ) : (
              <ul className="space-y-4">
                {desireTargets.map(({ item, claims }) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-brand-sand-100 bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-brand-ink-900">
                            {item.title}
                          </p>
                          {item.details ? (
                            <p className="mt-1 text-sm text-brand-ink-600 whitespace-pre-line">
                              {item.details}
                            </p>
                          ) : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-sand-100 px-2 py-0.5 text-xs font-medium capitalize text-brand-ink-600">
                          {item.status.toLowerCase()}
                        </span>
                      </div>
                      {renderClaims(claims, {
                        ownerName: getMemberDisplayName(item.authorMembershipId),
                        direction: "desire",
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {isDecisionsRound && membershipId ? (
        <section
          className="section-card space-y-4"
          aria-labelledby="enjoyment-heading"
        >
          <div>
            <h2 id="enjoyment-heading" className="section-heading">
              Share Your Experience
            </h2>
            <p className="mt-1 text-sm text-brand-ink-600">
              What did you enjoy most about this Gift Circle? Your response will be shared with other participants.
            </p>
          </div>
          {hasSubmittedEnjoyment ? (
            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
              <p className="text-sm font-medium text-brand-green-dark">You shared:</p>
              <p className="mt-2 text-sm text-brand-ink-700 whitespace-pre-line">
                {currentMember?.enjoyment}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                className="w-full rounded-lg border border-brand-sand-200 bg-white px-4 py-3 text-sm text-brand-ink-900 placeholder:text-brand-ink-400 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                rows={4}
                placeholder="Share what you enjoyed about this experience..."
                value={enjoymentDraft}
                onChange={(e) => setEnjoymentDraft(e.target.value)}
                disabled={enjoymentState.status === "saving"}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn-gold"
                  onClick={handleSubmitEnjoyment}
                  disabled={
                    enjoymentState.status === "saving" || !enjoymentDraft.trim()
                  }
                >
                  {enjoymentState.status === "saving" ? "Sharing..." : "Share"}
                </button>
                {enjoymentState.status === "error" ? (
                  <span className="text-xs text-red-600">{enjoymentState.message}</span>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
