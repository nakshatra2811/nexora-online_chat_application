"use client";

/**
 * CallProvider.tsx — Nexora Global Call System
 *
 * ISOLATED: This file is the single source of truth for all voice/video call
 * state across the entire app. Changes here do NOT affect the chats page,
 * dashboard, layout, or server code.
 *
 * The chats page (and any other consumer) uses the useCall() hook.
 * The API contract of useCall() is fixed — no chats page changes required.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { AnimatePresence } from "framer-motion";
import { socketService } from "@/lib/socket";
import { webRTCService, CallType } from "@/lib/webrtc";
import { syntheticRingtone } from "@/lib/ringtone";
import { IncomingCallOverlay } from "./IncomingCallOverlay";
import { CallInterface } from "./CallInterface";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CallState {
  isActive: boolean;
  isIncoming: boolean;
  status: "idle" | "ringing" | "accepted" | "ended";
  type: CallType;
  remoteUser: {
    username: string;
    name: string;
    color: string;
  } | null;
  duration: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isFullscreen: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  facingMode: "user" | "environment";
}

interface CallContextType {
  startCall: (
    targetUserId: string,
    type: CallType,
    metadata: { name: string; color: string }
  ) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  flipCamera: () => void;
  minimize: () => void;
  maximize: () => void;
  callState: CallState;
}

// ─── Context ────────────────────────────────────────────────────────────────

const CallContext = createContext<CallContextType | null>(null);

export const useCall = (): CallContextType => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
};

// ─── Default State ───────────────────────────────────────────────────────────

const IDLE_STATE: CallState = {
  isActive: false,
  isIncoming: false,
  status: "idle",
  type: "voice",
  remoteUser: null,
  duration: "00:00",
  isMuted: false,
  isVideoOff: false,
  isFullscreen: true,
  localStream: null,
  remoteStream: null,
  facingMode: "user",
};

// ─── Pending Incoming Call (stored outside React to avoid stale closures) ───

let _pendingOffer: RTCSessionDescriptionInit | null = null;
let _pendingFrom: string = "";
let _pendingCallType: CallType = "voice";

// ─── Provider ───────────────────────────────────────────────────────────────

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [callState, setCallState] = useState<CallState>(IDLE_STATE);

  // Timer ref
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSecondsRef = useRef(0);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
      .toString()
      .padStart(2, "0")}`;

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerSecondsRef.current = 0;
    timerRef.current = setInterval(() => {
      timerSecondsRef.current++;
      setCallState((prev) => ({
        ...prev,
        duration: fmt(timerSecondsRef.current),
      }));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerSecondsRef.current = 0;
  }, []);

  const stopRingtone = () => {
    syntheticRingtone?.pause();
  };

  const resetState = useCallback(() => {
    stopTimer();
    stopRingtone();
    _pendingOffer = null;
    _pendingFrom = "";
    setCallState(IDLE_STATE);
  }, [stopTimer]);

  // ── Shared WebRTC event handlers ─────────────────────────────────────────

  const buildCallEvents = useCallback(
    () => ({
      onLocalStream: (stream: MediaStream) => {
        setCallState((prev) => ({ ...prev, localStream: stream }));
      },
      onRemoteStream: (stream: MediaStream) => {
        setCallState((prev) => ({ ...prev, remoteStream: stream }));
      },
      onCallConnected: () => {
        startTimer();
        setCallState((prev) => ({ ...prev, status: "accepted" }));
        stopRingtone();
      },
      onCallEnded: (_reason: string) => {
        resetState();
      },
      onCallRejected: () => {
        resetState();
      },
    }),
    [startTimer, resetState]
  );

  // ── Initialize socket listeners once ─────────────────────────────────────

  useEffect(() => {
    // Wait for socket to be connected before attaching
    const attachWhenReady = () => {
      const socket = socketService.getSocket();
      if (!socket) return;

      webRTCService.attachListeners();

      webRTCService.onIncomingCall((data) => {
        console.log("[CallProvider] Incoming call from:", data.from, "type:", data.callType);
        _pendingOffer = data.sdp;
        _pendingFrom = data.from;
        _pendingCallType = data.callType;

        // Look up caller display info from local saved connections
        const connections = JSON.parse(
          localStorage.getItem("nexora_secure_connections") || "[]"
        );
        const caller = connections.find(
          (c: any) =>
            c.username?.toLowerCase() === data.from?.toLowerCase()
        );

        setCallState((prev) => ({
          ...prev,
          isIncoming: true,
          isActive: false,
          status: "ringing",
          type: data.callType,
          remoteUser: {
            username: data.from,
            name:
              data.callerName ||
              caller?.name ||
              data.from,
            color:
              data.callerColor ||
              caller?.color ||
              "from-gray-700 to-black",
          },
        }));

        // Play ringtone
        syntheticRingtone?.play().catch(() => {});
      });
    };

    // Socket may already be connected
    attachWhenReady();

    // Also try again in case socket connects later
    const socket = socketService.getSocket();
    socket?.on("connect", attachWhenReady);

    return () => {
      webRTCService.detachListeners();
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────

  const startCall = useCallback(
    (
      targetUserId: string,
      type: CallType,
      metadata: { name: string; color: string }
    ) => {
      console.log("[CallProvider] Starting", type, "call to", targetUserId);

      setCallState((prev) => ({
        ...prev,
        isActive: true,
        isIncoming: false,
        status: "ringing",
        type,
        remoteUser: {
          username: targetUserId,
          name: metadata.name,
          color: metadata.color,
        },
        isFullscreen: true,
        duration: "00:00",
        localStream: null,
        remoteStream: null,
        facingMode: "user",
      }));

      webRTCService
        .startCall(targetUserId, type, buildCallEvents(), {
          callerName: metadata.name,
          callerColor: metadata.color,
        })
        .then((stream) => {
          setCallState((prev) => ({ ...prev, localStream: stream }));
        })
        .catch((err) => {
          console.error("[CallProvider] startCall failed:", err);
          resetState();
        });
    },
    [buildCallEvents, resetState]
  );

  const acceptCall = useCallback(() => {
    if (!_pendingOffer || !_pendingFrom) {
      console.error("[CallProvider] No pending incoming call to accept");
      return;
    }

    const from = _pendingFrom;
    const offer = _pendingOffer;
    const type = _pendingCallType;

    stopRingtone();
    setCallState((prev) => ({
      ...prev,
      isIncoming: false,
      isActive: true,
      status: "ringing",
      type,
      isFullscreen: true,
      facingMode: "user",
    }));

    webRTCService
      .acceptCall(from, offer, type, buildCallEvents())
      .then((stream) => {
        setCallState((prev) => ({ ...prev, localStream: stream }));
      })
      .catch((err) => {
        console.error("[CallProvider] acceptCall failed:", err);
        resetState();
      });
  }, [buildCallEvents, resetState]);

  const declineCall = useCallback(() => {
    if (_pendingFrom) {
      webRTCService.rejectCall(_pendingFrom);
    }
    resetState();
  }, [resetState]);

  const endCall = useCallback(() => {
    webRTCService.hangup();
    resetState();
  }, [resetState]);

  const toggleMute = useCallback(() => {
    const muted = webRTCService.toggleMute();
    setCallState((prev) => ({ ...prev, isMuted: muted }));
  }, []);

  const toggleVideo = useCallback(() => {
    const videoOff = webRTCService.toggleVideo();
    setCallState((prev) => ({ ...prev, isVideoOff: videoOff }));
  }, []);

  const flipCamera = useCallback(async () => {
    const newStream = await webRTCService.flipCamera();
    if (newStream) {
      setCallState((prev) => ({ 
        ...prev, 
        localStream: newStream,
        facingMode: webRTCService.currentFacingMode 
      }));
    }
  }, []);

  const minimize = useCallback(
    () => setCallState((prev) => ({ ...prev, isFullscreen: false })),
    []
  );
  const maximize = useCallback(
    () => setCallState((prev) => ({ ...prev, isFullscreen: true })),
    []
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <CallContext.Provider
      value={{
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
        flipCamera,
        minimize,
        maximize,
        callState,
      }}
    >
      {children}

      <AnimatePresence>
        {/* Incoming call overlay — shown when receiving a call and not yet in a call */}
        {callState.isIncoming && !callState.isActive && (
          <IncomingCallOverlay
            key="incoming-call"
            callerName={callState.remoteUser?.name || "Unknown"}
            callerColor={
              callState.remoteUser?.color || "from-gray-700 to-black"
            }
            callType={callState.type}
            onAccept={acceptCall}
            onDecline={declineCall}
          />
        )}

        {/* Active call interface */}
        {callState.isActive && (
          <CallInterface
            key="active-call"
            status={callState.status}
            type={callState.type}
            remoteName={callState.remoteUser?.name || "User"}
            remoteColor={
              callState.remoteUser?.color || "from-gray-700 to-black"
            }
            duration={callState.duration}
            isMuted={callState.isMuted}
            isVideoOff={callState.isVideoOff}
            isFullscreen={callState.isFullscreen}
            facingMode={callState.facingMode}
            localStream={callState.localStream}
            remoteStream={callState.remoteStream}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onFlipCamera={flipCamera}
            onEndCall={endCall}
            onMinimize={minimize}
            onMaximize={maximize}
          />
        )}
      </AnimatePresence>
    </CallContext.Provider>
  );
};
