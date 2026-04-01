"use client";

import { CallProvider } from "./CallProvider";

/**
 * CallWrapper.tsx — Global provider wrapper for calls.
 *
 * It must be a Client Component so it can use Context and state,
 * but it MUST NOT return null or skip wrapping children, because
 * sub-components (like ChatsPage) expect the CallContext to exist.
 */
export function CallWrapper({ children }: { children: React.ReactNode }) {
  return (
    <CallProvider>
      {children}
    </CallProvider>
  );
}
