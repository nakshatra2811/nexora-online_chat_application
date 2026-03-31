"use client";

/**
 * CallWrapper.tsx — Client-only wrapper for the CallProvider.
 *
 * Next.js App Router requires that client-only components (those using
 * browser APIs like WebRTC, AudioContext, etc.) are NOT imported directly
 * into server components. This thin wrapper ensures the CallProvider is
 * only instantiated on the client side.
 */

import dynamic from "next/dynamic";

const CallProvider = dynamic(
  () => import("./CallProvider").then((mod) => ({ default: mod.CallProvider })),
  {
    ssr: false,
    loading: () => null,
  }
);

export function CallWrapper({ children }: { children: React.ReactNode }) {
  return <CallProvider>{children}</CallProvider>;
}
