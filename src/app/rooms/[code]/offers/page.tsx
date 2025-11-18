"use client";

import { useMemo, useState } from "react";

import {
  createOfferApi,
  deleteOfferApi,
  updateOfferApi,
  type OfferSummary,
} from "@/lib/rooms-client";
import { useRoom } from "@/app/rooms/[code]/room-context";
import { getRoundInfo } from "@/lib/room-round";
import { RoomItemForm, type ItemDraft } from "@/app/rooms/[code]/room-item-form";

type FormMode =
  | { type: "idle" }
  | { type: "create"; draft: ItemDraft }
  | { type: "edit"; offer: OfferSummary; draft: ItemDraft };

const EMPTY_DRAFT: ItemDraft = {
  title: "",
  details: "",
};

function createDraftFromOffer(offer: OfferSummary): ItemDraft {
  return {
    title: offer.title,
    details: offer.details ?? "",
  };
}

type ActionState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "deleting"; offerId: string };

export default function MyOffersPage() {
  const { room, membershipId, refresh } = useRoom();
  const [formMode, setFormMode] = useState<FormMode>({ type: "idle" });
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  const myOffers = useMemo(() => {
    if (!membershipId) {
      return [] as OfferSummary[];
    }
    return room.offers.filter((offer) => offer.authorMembershipId === membershipId);
  }, [room.offers, membershipId]);

  const canEditOffers = room.currentRound === "OFFERS" && !!membershipId;
  const roundInfo = getRoundInfo("OFFERS");

  const startCreate = () => {
    setFormMode({ type: "create", draft: EMPTY_DRAFT });
  };

  const handleReset = () => {
    setFormMode({ type: "idle" });
    setError(null);
  };

  const handleCreate = async () => {
    if (formMode.type !== "create" || !membershipId) {
      return;
    }

    const trimmedTitle = formMode.draft.title.trim();
    if (!trimmedTitle) {
      setError("Please add a title for your offer.");
      return;
    }

    try {
      setActionState({ status: "saving" });
      await createOfferApi(room.code, {
        title: trimmedTitle,
        details: formMode.draft.details.trim() || undefined,
      });
      handleReset();
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to create offer.";
      setError(message);
    } finally {
      setActionState({ status: "idle" });
    }
  };

  const handleUpdate = async () => {
    if (formMode.type !== "edit" || !membershipId) {
      return;
    }

    const trimmedTitle = formMode.draft.title.trim();
    if (!trimmedTitle) {
      setError("Please add a title for your offer.");
      return;
    }

    try {
      setActionState({ status: "saving" });
      await updateOfferApi(room.code, formMode.offer.id, {
        title: trimmedTitle,
        details: formMode.draft.details.trim() || undefined,
      });
      handleReset();
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to update offer.";
      setError(message);
    } finally {
      setActionState({ status: "idle" });
    }
  };

  const handleDelete = async (offerId: string) => {
    if (!membershipId) {
      return;
    }

    if (!window.confirm("Are you sure you want to delete this offer?")) {
      return;
    }

    try {
      setActionState({ status: "deleting", offerId });
      await deleteOfferApi(room.code, offerId);
      handleReset();
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to delete offer.";
      setError(message);
    } finally {
      setActionState({ status: "idle" });
    }
  };

  const isSaving = actionState.status === "saving";

  return (
    <div className="space-y-6">
      <header className="section-card space-y-4" role="banner">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2 text-brand-ink-800">
            <h1 className="text-3xl font-semibold text-brand-ink-900">My Offers</h1>
            <p className="text-sm text-brand-ink-600">{roundInfo.guidance}</p>
          </div>
          {canEditOffers ? (
            <button type="button" className="btn-gold" onClick={startCreate}>
              Add offer
            </button>
          ) : null}
        </div>
        {!canEditOffers ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            You can only create and edit offers during the Offers round.
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

      {canEditOffers && formMode.type !== "idle" ? (
        <RoomItemForm
          draft={formMode.draft}
          heading={formMode.type === "edit" ? "Edit offer" : "Add a new offer"}
          submitLabel={formMode.type === "edit" ? "Save changes" : "Publish offer"}
          onChange={(draft) => {
            if (formMode.type === "create") {
              setFormMode({ type: "create", draft });
            } else if (formMode.type === "edit") {
              setFormMode({ type: "edit", offer: formMode.offer, draft });
            }
          }}
          onSubmit={formMode.type === "edit" ? handleUpdate : handleCreate}
          onCancel={handleReset}
          disabled={isSaving}
        />
      ) : null}

      <section className="section-card space-y-4" aria-labelledby="published-offers-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="published-offers-heading" className="section-heading">
            Published Offers
          </h2>
          {myOffers.length > 0 ? (
            <span className="text-xs text-brand-ink-600">
              {`${myOffers.length} active ${myOffers.length === 1 ? "entry" : "entries"}`}
            </span>
          ) : null}
        </div>
        {myOffers.length === 0 ? (
          <div className="empty-state">
            You haven&apos;t added any offers.
          </div>
        ) : (
          <ul className="space-y-4">
            {myOffers.map((offer) => {
              const isDeleting =
                actionState.status === "deleting" && actionState.offerId === offer.id;
              return (
                <li
                  key={offer.id}
                  className="card-muted border border-brand-sand-100 bg-white/80 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="text-sm font-semibold text-brand-ink-900">
                        {offer.title}
                      </h3>
                      {offer.details ? (
                        <p className="text-sm text-brand-ink-700 whitespace-pre-line">
                          {offer.details}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-sand-100 px-2 py-0.5 text-xs font-medium capitalize text-brand-ink-700">
                      {offer.status.toLowerCase()}
                    </span>
                  </div>
                  {canEditOffers ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() =>
                          setFormMode({
                            type: "edit",
                            offer,
                            draft: createDraftFromOffer(offer),
                          })
                        }
                        disabled={isSaving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDelete(offer.id)}
                        disabled={isSaving || isDeleting}
                      >
                        {isDeleting ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
