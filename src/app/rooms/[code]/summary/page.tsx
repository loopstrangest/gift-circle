"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useRoom } from "@/app/rooms/[code]/room-context";
import { buildCommitmentPreview } from "@/lib/room-commitments";

type PdfState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; message: string };

function sanitizeForFilename(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export default function SummaryPage() {
  const { room, membershipId } = useRoom();
  const [pdfState, setPdfState] = useState<PdfState>({ status: "idle" });

  const isSummaryRound = room.currentRound === "SUMMARY";

  const commitmentPreview = useMemo(() => buildCommitmentPreview(room), [room]);

  const currentMember = useMemo(() => {
    if (!membershipId) return null;
    return room.members.find((m) => m.membershipId === membershipId) ?? null;
  }, [room.members, membershipId]);

  const hasAcceptedCommitment = useMemo(() => {
    if (!membershipId) {
      return false;
    }
    const viewerCommitments = commitmentPreview.get(membershipId);
    if (!viewerCommitments) {
      return false;
    }
    return (
      viewerCommitments.giving.length > 0 || viewerCommitments.receiving.length > 0
    );
  }, [commitmentPreview, membershipId]);

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

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    // Total unique commitments (count each claim only once)
    const acceptedClaims = room.claims.filter((c) => c.status === "ACCEPTED");
    const totalCommitments = acceptedClaims.length;

    // Calculate giving/receiving counts per member
    const givingCounts = new Map<string, number>();
    const receivingCounts = new Map<string, number>();

    for (const [membershipId, data] of commitmentPreview.entries()) {
      givingCounts.set(membershipId, data.giving.length);
      receivingCounts.set(membershipId, data.receiving.length);
    }

    // Find top giver
    let topGiver: { membershipId: string; count: number } | null = null;
    for (const [memberId, count] of givingCounts.entries()) {
      if (count > 0 && (!topGiver || count > topGiver.count)) {
        topGiver = { membershipId: memberId, count };
      }
    }

    // Find top receiver
    let topReceiver: { membershipId: string; count: number } | null = null;
    for (const [memberId, count] of receivingCounts.entries()) {
      if (count > 0 && (!topReceiver || count > topReceiver.count)) {
        topReceiver = { membershipId: memberId, count };
      }
    }

    // Calculate average commitments per person (total commitments * 2 / number of participants with commitments)
    // Since each commitment involves 2 people, we count each side
    const participantsWithCommitments = new Set<string>();
    for (const claim of acceptedClaims) {
      participantsWithCommitments.add(claim.claimerMembershipId);
      const offer = claim.offerId ? room.offers.find((o) => o.id === claim.offerId) : null;
      const desire = claim.desireId ? room.desires.find((d) => d.id === claim.desireId) : null;
      if (offer) {
        participantsWithCommitments.add(offer.authorMembershipId);
      }
      if (desire) {
        participantsWithCommitments.add(desire.authorMembershipId);
      }
    }

    const avgCommitmentsPerPerson =
      participantsWithCommitments.size > 0
        ? (totalCommitments * 2) / participantsWithCommitments.size
        : 0;

    return {
      totalCommitments,
      avgCommitmentsPerPerson,
      topGiver,
      topReceiver,
    };
  }, [room.claims, room.offers, room.desires, commitmentPreview]);

  // Get all enjoyment submissions (including current user's)
  const allEnjoyments = useMemo(() => {
    return room.members
      .filter((m) => m.enjoyment)
      .map((m) => ({
        membershipId: m.membershipId,
        name: getMemberDisplayName(m.membershipId),
        enjoyment: m.enjoyment!,
        isCurrentUser: m.membershipId === membershipId,
      }));
  }, [room.members, membershipId, getMemberDisplayName]);

  return (
    <div className="space-y-6">
      <header className="section-card space-y-4" role="banner">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-4xl font-semibold text-brand-ink-900 text-center md:text-left flex-1">
            Summary
          </h1>
          {membershipId ? (
            <div className="flex flex-col items-center gap-1 md:items-end">
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
        {!isSummaryRound ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            The summary will be available once the host advances the room to the Summary round.
          </p>
        ) : null}
      </header>

      {isSummaryRound ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-brand-sand-100 bg-white p-4 text-center">
              <p className="text-3xl font-bold text-brand-ink-900">
                {summaryStats.totalCommitments}
              </p>
              <p className="mt-1 text-sm text-brand-ink-600">Total Commitments</p>
            </div>

            <div className="rounded-lg border border-brand-sand-100 bg-white p-4 text-center">
              <p className="text-3xl font-bold text-brand-ink-900">
                {summaryStats.avgCommitmentsPerPerson.toFixed(1)}
              </p>
              <p className="mt-1 text-sm text-brand-ink-600">Avg per Person</p>
            </div>

            <div className="rounded-lg border border-brand-green/20 bg-brand-green/5 p-4 text-center">
              {summaryStats.topGiver ? (
                <>
                  <p className="text-lg font-bold text-brand-green-dark">
                    {getMemberDisplayName(summaryStats.topGiver.membershipId)}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink-600">
                    Top Giver ({summaryStats.topGiver.count} {summaryStats.topGiver.count === 1 ? "gift" : "gifts"})
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-brand-ink-400">—</p>
                  <p className="mt-1 text-sm text-brand-ink-600">Top Giver</p>
                </>
              )}
            </div>

            <div className="rounded-lg border border-brand-gold/20 bg-brand-gold/5 p-4 text-center">
              {summaryStats.topReceiver ? (
                <>
                  <p className="text-lg font-bold text-brand-gold-dark">
                    {getMemberDisplayName(summaryStats.topReceiver.membershipId)}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink-600">
                    Top Receiver ({summaryStats.topReceiver.count} {summaryStats.topReceiver.count === 1 ? "gift" : "gifts"})
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-bold text-brand-ink-400">—</p>
                  <p className="mt-1 text-sm text-brand-ink-600">Top Receiver</p>
                </>
              )}
            </div>
          </div>
      ) : null}

      {isSummaryRound && allEnjoyments.length > 0 ? (
        <section
          className="section-card space-y-4"
          aria-labelledby="shared-experiences-heading"
        >
          <div>
            <h2 id="shared-experiences-heading" className="section-heading">
              Shared Experiences
            </h2>
            <p className="mt-1 text-sm text-brand-ink-600">
              What did you enjoy most about this Gift Circle?
            </p>
          </div>
          <ul className="space-y-4">
            {allEnjoyments.map((entry) => (
              <li
                key={entry.membershipId}
                className={`rounded-lg border p-4 ${
                  entry.isCurrentUser
                    ? "border-brand-green/20 bg-brand-green/5"
                    : "border-brand-sand-100 bg-white"
                }`}
              >
                <p className="text-sm font-semibold text-brand-ink-900">
                  {entry.name}
                  {entry.isCurrentUser ? (
                    <span className="ml-2 text-xs font-normal text-brand-ink-500">(You)</span>
                  ) : null}
                </p>
                <p className="mt-2 text-sm text-brand-ink-700 whitespace-pre-line">
                  {entry.enjoyment}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
