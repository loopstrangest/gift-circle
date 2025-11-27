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
  const [isLearnMoreVisible, setIsLearnMoreVisible] = useState(false);
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
    <main className="layout-container flex min-h-screen flex-col gap-10">
      <header className="card app-hero surface-grid space-y-5 rounded-3xl px-6 py-10 text-center">
        <div className="flex flex-col items-center gap-3 text-brand-ink-800">
          <h1 className="text-4xl font-semibold tracking-tight text-brand-ink-900">
            Gift Circle
          </h1>
          <p className="max-w-2xl text-base text-brand-ink-700">
            Share your offers and desires, enjoy the generosity of giving and receiving.
          </p>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="card flex flex-col gap-5 border-brand-sand-100/70 p-6"
        >
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Host a room</h2>
          </div>
          <label className="flex flex-col gap-2">
            <span className="form-label">Your name</span>
            <input
              name="hostDisplayName"
              type="text"
              autoComplete="name"
              className="input-field"
            />
          </label>
          <button
            type="submit"
            disabled={viewState.mode === "creating" || isBusy}
            className="btn-emerald"
          >
            {viewState.mode === "creating" || isBusy ? "Creating…" : "Create room"}
          </button>
        </form>

        <form
          onSubmit={handleJoin}
          className="card flex flex-col gap-5 border-brand-sand-100/70 p-6"
        >
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-brand-ink-900">Join a room</h2>
          </div>
          <label className="flex flex-col gap-2">
            <span className="form-label">Your name</span>
            <input
              name="displayName"
              type="text"
              autoComplete="name"
              className="input-field"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="form-label">Room code</span>
            <input
              name="roomCode"
              type="text"
              className="input-field"
            />
          </label>
          <button
            type="submit"
            disabled={viewState.mode === "joining" || isBusy}
            className="btn-outline"
          >
            {viewState.mode === "joining" || isBusy ? "Joining…" : "Join room"}
          </button>
        </form>
      </section>

      <section className="card-muted space-y-3 p-6 text-center">
        <button
          type="button"
          aria-expanded={isLearnMoreVisible}
          onClick={() => setIsLearnMoreVisible((value) => !value)}
          className="mx-auto text-base font-semibold text-brand-green hover:text-brand-gold"
        >
          Learn More
        </button>
        {isLearnMoreVisible ? (
          <p className="text-sm text-brand-ink-700">
            During a Gift Circle, participants share what they want to give and what
            they hope to receive. They then request to match each others&apos; offers
            and desires, and accept or decline those requests. Each participant ought to
            come prepared with meaningful offers and desires, a commitment to integrity,
            clear yes-or-no responses, and invitations without pressure so that the
            generosity keeps flowing long after the Gift Circle.
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}
