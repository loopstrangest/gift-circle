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
    <div className="flex flex-col gap-6">
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Offers</h1>
            <p className="mt-3 text-sm text-slate-600">{roundInfo.guidance}</p>
          </div>
          {canEditOffers ? (
            <button type="button" className="btn-primary" onClick={startCreate}>
              Add offer
            </button>
          ) : null}
        </div>
        {!canEditOffers ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            You can only create and edit offers during the Offers round.
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {canEditOffers && formMode.type !== "idle" ? (
        <RoomItemForm
          draft={
            formMode.type === "create"
              ? formMode.draft
              : formMode.type === "edit"
                ? formMode.draft
                : EMPTY_DRAFT
          }
          heading={formMode.type === "edit" ? "Edit offer" : "Add a new offer"}
          submitLabel={formMode.type === "edit" ? "Save changes" : "Publish offer"}
          onChange={(draft) => {
            if (formMode.type === "idle") {
              setFormMode({ type: "create", draft });
            } else if (formMode.type === "create") {
              setFormMode({ type: "create", draft });
            } else {
              setFormMode({ type: "edit", offer: formMode.offer, draft });
            }
          }}
          onSubmit={formMode.type === "edit" ? handleUpdate : handleCreate}
          onCancel={handleReset}
          disabled={isSaving}
        />
      ) : null}

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Published Offers</h2>
        {myOffers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            You haven’t added any offers yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {myOffers.map((offer) => {
              const isDeleting =
                actionState.status === "deleting" && actionState.offerId === offer.id;
              return (
                <li
                  key={offer.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {offer.title}
                      </h3>
                      {offer.details ? (
                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                          {offer.details}
                        </p>
                      ) : null}
                      <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                        {offer.status.toLowerCase()}
                      </span>
                    </div>
                    {canEditOffers ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
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
                          className="btn-primary bg-red-600 hover:bg-red-500 disabled:bg-red-300"
                          onClick={() => handleDelete(offer.id)}
                          disabled={isSaving || isDeleting}
                        >
                          {isDeleting ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
