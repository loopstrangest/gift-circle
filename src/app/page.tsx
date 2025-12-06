"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createRoom, joinRoom } from "@/lib/rooms-client";
import { useIdentity } from "@/lib/identity-client";

type ViewState =
  | { mode: "idle" }
  | { mode: "creating" }
  | { mode: "joining"; code: string };

type RoomAction = "host" | "join";

export default function HomePage() {
  const { identity, setDisplayName, refresh } = useIdentity();
  const [viewState, setViewState] = useState<ViewState>({ mode: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const [selectedAction, setSelectedAction] = useState<RoomAction | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSelectAction(action: RoomAction) {
    setSelectedAction(action);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

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

      <section className="card space-y-6 p-6 text-brand-ink-700">
        <p>
          A Gift Circle is a gathering where people share gifts with each other in a spirit of generosity. It&apos;s a way to build community, support one another, and create a culture of abundance.
        </p>

        <p>
          To participate in a Gift Circle, please bring a list of OFFERS and a list of DESIRES U would be delighted to give and receive.
        </p>

        <p>
          For example: a massage, an hour to be listened to, a friend to go on a road trip, money for a project... U are limited only by your imagination!
        </p>

        <div className="space-y-2">
          <p className="font-bold text-brand-ink-900">The Format:</p>
          <ol className="list-none space-y-1 pl-4">
            <li>
              1.{" "}
              <a
                href="https://tasshin.com/blog/the-value-of-emotional-check-ins/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-brand-green hover:text-brand-gold hover:underline"
              >
                Check-Ins
              </a>
            </li>
            <li>2. <span className="font-bold">Welcoming and Guidelines</span></li>
            <li>3. <span className="font-bold">Desires Round</span> - <em>&quot;This is what I&apos;d like to receive...&quot;</em></li>
            <li>4. <span className="font-bold">Offers Round</span> - <em>&quot;This is what I&apos;d like to give...&quot;</em></li>
            <li>5. <span className="font-bold">Lightning Connections Round 1:</span> <em>&quot;Mary, I want to take you up on a Listening Session, and Johnny, I want to give you $20 to buy a book.&quot;</em></li>
            <li>6. <span className="font-bold">Lightning Connection Round 2:</span> Replies - <em>&quot;Yes, I&apos;ll be happy to give you a back massage, and actually, no thanks to the brand new guitar...&quot;</em></li>
            <li>7. <span className="font-bold">Check-outs</span></li>
          </ol>
        </div>

        <p>
          This web app is designed to make it smoother for hosts and participants of Gift Circles to track which gifts are given by whom, to whom. We hope it makes it easier and more enjoyable for U to participate in Gift Circles—and that it inspires more people to do them!
        </p>

        <p>
          It was created by{" "}
          <a
            href="https://strangestloop.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green hover:text-brand-gold hover:underline"
          >
            Loopy
          </a>
          , in collaboration with the{" "}
          <a
            href="https://serviceguild.fun/empowerment/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green hover:text-brand-gold hover:underline"
          >
            Empowerment Department
          </a>
          {" "}of{" "}
          <a
            href="https://serviceguild.fun/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green hover:text-brand-gold hover:underline"
          >
            The Service Guild
          </a>
          . We learned about Gift Circles through the WEALTH community, led by Carolyn Elliot.
        </p>
      </section>

      <section className="space-y-6">
        <div className="text-center">
          <p className="mb-4 text-lg text-brand-ink-700">Would U like to host or join a room?</p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => handleSelectAction("host")}
              className={`rounded-xl px-6 py-3 font-semibold transition-colors ${
                selectedAction === "host"
                  ? "bg-brand-green text-white"
                  : "bg-brand-sand-100 text-brand-ink-700 hover:bg-brand-sand-200"
              }`}
            >
              Host a room
            </button>
            <button
              type="button"
              onClick={() => handleSelectAction("join")}
              className={`rounded-xl px-6 py-3 font-semibold transition-colors ${
                selectedAction === "join"
                  ? "bg-brand-green text-white"
                  : "bg-brand-sand-100 text-brand-ink-700 hover:bg-brand-sand-200"
              }`}
            >
              Join a room
            </button>
          </div>
        </div>

        {selectedAction === "host" && (
          <form
            ref={formRef}
            onSubmit={handleCreate}
            className="card mx-auto flex max-w-md flex-col gap-5 border-brand-sand-100/70 p-6"
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
              {viewState.mode === "creating" || isBusy ? "Creating..." : "Host room"}
            </button>
          </form>
        )}

        {selectedAction === "join" && (
          <form
            ref={formRef}
            onSubmit={handleJoin}
            className="card mx-auto flex max-w-md flex-col gap-5 border-brand-sand-100/70 p-6"
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
              className="btn-emerald"
            >
              {viewState.mode === "joining" || isBusy ? "Joining..." : "Join room"}
            </button>
          </form>
        )}
      </section>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </main>
  );
}
