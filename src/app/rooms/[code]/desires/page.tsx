"use client";

import { useMemo, useState } from "react";

import {
  createDesireApi,
  deleteDesireApi,
  updateDesireApi,
  type DesireSummary,
} from "@/lib/rooms-client";
import { useRoom } from "@/app/rooms/[code]/room-context";
import { getRoundInfo } from "@/lib/room-round";
import { RoomItemForm, type ItemDraft } from "@/app/rooms/[code]/room-item-form";

type FormMode =
  | { type: "idle" }
  | { type: "create"; draft: ItemDraft }
  | { type: "edit"; desire: DesireSummary; draft: ItemDraft };

const EMPTY_DRAFT: ItemDraft = {
  title: "",
  details: "",
};

function createDraftFromDesire(desire: DesireSummary): ItemDraft {
  return {
    title: desire.title,
    details: desire.details ?? "",
  };
}

type ActionState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "deleting"; desireId: string };

export default function MyDesiresPage() {
  const { room, membershipId, refresh } = useRoom();
  const [formMode, setFormMode] = useState<FormMode>({ type: "idle" });
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  const myDesires = useMemo(() => {
    if (!membershipId) {
      return [] as DesireSummary[];
    }
    return room.desires.filter((desire) => desire.authorMembershipId === membershipId);
  }, [room.desires, membershipId]);

  const canEditDesires = room.currentRound === "DESIRES" && !!membershipId;
  const roundInfo = getRoundInfo("DESIRES");

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
      setError("Please add a title for your desire.");
      return;
    }

    try {
      setActionState({ status: "saving" });
      await createDesireApi(room.code, {
        title: trimmedTitle,
        details: formMode.draft.details.trim() || undefined,
      });
      handleReset();
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to create desire.";
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
      setError("Please add a title for your desire.");
      return;
    }

    try {
      setActionState({ status: "saving" });
      await updateDesireApi(room.code, formMode.desire.id, {
        title: trimmedTitle,
        details: formMode.draft.details.trim() || undefined,
      });
      handleReset();
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to update desire.";
      setError(message);
    } finally {
      setActionState({ status: "idle" });
    }
  };

  const handleDelete = async (desireId: string) => {
    if (!membershipId) {
      return;
    }

    if (!window.confirm("Are you sure you want to delete this desire?")) {
      return;
    }

    try {
      setActionState({ status: "deleting", desireId });
      await deleteDesireApi(room.code, desireId);
      handleReset();
      await refresh();
    } catch (err) {
      console.error(err);
      const message = (err as Error)?.message ?? "Failed to delete desire.";
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
            <h1 className="text-3xl font-semibold text-brand-ink-900">My Desires</h1>
            <p className="text-sm text-brand-ink-600">{roundInfo.guidance}</p>
          </div>
          {canEditDesires ? (
            <button type="button" className="btn-emerald" onClick={startCreate}>
              Add desire
            </button>
          ) : null}
        </div>
        {!canEditDesires ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            You can only create and edit desires during the Desires round.
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

      {canEditDesires && formMode.type !== "idle" ? (
        <RoomItemForm
          draft={formMode.draft}
          heading={formMode.type === "edit" ? "Edit desire" : "Add a new desire"}
          submitLabel={formMode.type === "edit" ? "Save changes" : "Publish desire"}
          onChange={(draft) => {
            if (formMode.type === "create") {
              setFormMode({ type: "create", draft });
            } else if (formMode.type === "edit") {
              setFormMode({ type: "edit", desire: formMode.desire, draft });
            }
          }}
          onSubmit={formMode.type === "edit" ? handleUpdate : handleCreate}
          onCancel={handleReset}
          disabled={isSaving}
        />
      ) : null}

      <section className="section-card space-y-4" aria-labelledby="my-added-desires-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="my-added-desires-heading" className="section-heading">
            My Added Desires
          </h2>
        </div>
        {myDesires.length === 0 ? (
          <div className="empty-state">
            You haven&apos;t added any desires.
          </div>
        ) : (
          <ul className="space-y-4">
            {myDesires.map((desire) => {
              const isDeleting =
                actionState.status === "deleting" && actionState.desireId === desire.id;
              return (
                <li
                  key={desire.id}
                  className="card-muted border border-brand-sand-100 bg-white/80 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="text-sm font-semibold text-brand-ink-900">
                        {desire.title}
                      </h3>
                      {desire.details ? (
                        <p className="text-sm text-brand-ink-700 whitespace-pre-line">
                          {desire.details}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-sand-100 px-2 py-0.5 text-xs font-medium capitalize text-brand-ink-700">
                      {desire.status.toLowerCase()}
                    </span>
                  </div>
                  {canEditDesires ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() =>
                          setFormMode({
                            type: "edit",
                            desire,
                            draft: createDraftFromDesire(desire),
                          })
                        }
                        disabled={isSaving}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDelete(desire.id)}
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
