"use client";

import { SWRConfig } from "swr";
import { ReactNode } from "react";

export function IdentityProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>;
}
