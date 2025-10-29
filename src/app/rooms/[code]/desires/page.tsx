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
    <div className="flex flex-col gap-6">
      <header className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">My Desires</h1>
            <p className="mt-3 text-sm text-slate-600">{roundInfo.guidance}</p>
          </div>
          {canEditDesires ? (
            <button type="button" className="btn-primary" onClick={startCreate}>
              Add desire
            </button>
          ) : null}
        </div>
        {!canEditDesires ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            You can only create and edit desires during the Desires round.
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
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

      <section className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900">Published Desires</h2>
        {myDesires.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            You haven’t added any desires yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {myDesires.map((desire) => {
              const isDeleting =
                actionState.status === "deleting" && actionState.desireId === desire.id;
              return (
                <li
                  key={desire.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {desire.title}
                      </h3>
                      {desire.details ? (
                        <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                          {desire.details}
                        </p>
                      ) : null}
                      <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600">
                        {desire.status.toLowerCase()}
                      </span>
                    </div>
                    {canEditDesires ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
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
                          className="btn-primary bg-red-600 hover:bg-red-500 disabled:bg-red-300"
                          onClick={() => handleDelete(desire.id)}
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
