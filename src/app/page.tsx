"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createRoom, joinRoom } from "@/lib/rooms-client";
import { useIdentity } from "@/lib/identity-client";

type ViewState =
  | { mode: "idle" }
  | { mode: "creating" }
  | { mode: "joining"; code: string };

export default function HomePage() {
  const { identity, setDisplayName, refresh } = useIdentity();
  const [viewState, setViewState] = useState<ViewState>({ mode: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const router = useRouter();

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const displayName = (formData.get("hostDisplayName") as string | null)?.trim();

    if (!displayName) {
      setError("Please enter your name.");
      return;
    }

    setViewState({ mode: "creating" });
    try {
      const response = await createRoom({ hostDisplayName: displayName });
      await refresh();
      setViewState({ mode: "idle" });
      form.reset();
      startTransition(() => {
        router.push(
          `/rooms/${response.room.code}?membershipId=${response.membership.id}`
        );
      });
    } catch (err) {
      console.error(err);
      const message =
        (err as Error & { message?: string }).message ??
        "Something went wrong creating the room.";
      setError(message);
      setViewState({ mode: "idle" });
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const displayName = (formData.get("displayName") as string | null)?.trim();
    const code = (formData.get("roomCode") as string | null)?.trim();

    if (!displayName || !code) {
      setError("Enter your name and a room code.");
      return;
    }

    setViewState({ mode: "joining", code });

    try {
      const currentIdentity = identity ?? (await refresh());
      const shouldReset = currentIdentity
        ? currentIdentity.displayName !== null &&
          currentIdentity.displayName !== displayName
        : true;

      await setDisplayName(displayName, { reset: shouldReset });
      const response = await joinRoom({ code, displayName });
      setViewState({ mode: "idle" });
      form.reset();
      startTransition(() => {
        router.push(
          `/rooms/${response.room.code}?membershipId=${response.membership.id}`
        );
      });
    } catch (err) {
      console.error(err);
      const message =
        (err as Error).message ??
        "Unable to join that room. Double check the code and try again.";
      setError(message);
      setViewState({ mode: "idle" });
    }
  }

  const isBusy =
    viewState.mode === "creating" || viewState.mode === "joining" || isNavigating;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="space-y-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Gift Circle
        </h1>
        <p className="text-base text-slate-600">
          Share your offers and desires, enjoy the generosity of giving and receiving.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <form onSubmit={handleCreate} className="card flex flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Host a room</h2>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Your name</span>
            <input
              name="hostDisplayName"
              type="text"
              autoComplete="name"
              className="rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
          <button
            type="submit"
            disabled={viewState.mode === "creating" || isBusy}
            className="btn-primary"
          >
            {viewState.mode === "creating" || isBusy ? "Creating…" : "Create room"}
          </button>
        </form>

        <form onSubmit={handleJoin} className="card flex flex-col gap-4 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Join a room</h2>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Your name</span>
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              className="rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-slate-700">Room code</span>
            <input
              name="roomCode"
              type="text"
              maxLength={6}
              className="rounded-md border border-slate-300 px-3 py-2 text-base uppercase shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </label>
          <button
            type="submit"
            disabled={viewState.mode === "joining" || isBusy}
            className="btn-secondary"
          >
            {viewState.mode === "joining" || isBusy ? "Joining…" : "Join room"}
          </button>
        </form>
      </section>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}
