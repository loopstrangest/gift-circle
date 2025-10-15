import useSWR from "swr";

type IdentityPayload = {
  userId: string;
  displayName: string | null;
};

async function fetchIdentity(): Promise<IdentityPayload> {
  const response = await fetch("/api/identity", {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Failed to resolve identity: ${response.status}`);
  }
  return (await response.json()) as IdentityPayload;
}

async function submitIdentity({
  displayName,
  reset,
}: {
  displayName: string | null;
  reset?: boolean;
}): Promise<IdentityPayload> {
  const response = await fetch("/api/identity", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName, reset }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update identity: ${response.status}`);
  }
  return (await response.json()) as IdentityPayload;
}

export function useIdentity() {
  const { data, error, isLoading, mutate } = useSWR("identity", fetchIdentity, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const setDisplayName = async (
    displayName: string | null,
    options?: { reset?: boolean }
  ) => {
    const trimmed = displayName?.trim() || null;
    const payload = await submitIdentity({
      displayName: trimmed,
      reset: options?.reset,
    });
    await mutate(payload, { revalidate: false });
    return payload;
  };

  return {
    identity: data,
    isLoading,
    error,
    setDisplayName,
    refresh: () => mutate(),
  } as const;
}
