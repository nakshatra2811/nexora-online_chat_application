"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, UserCheck, Check, X, Users, Clock } from "lucide-react";
import { nexoraFetch } from "@/lib/config";

export type ConnectionStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "friends";

interface ConnectionButtonProps {
  targetUsername: string;
  initialStatus: ConnectionStatus;
  requestId?: number; // needed for accept/decline
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  onStatusChange?: (newStatus: ConnectionStatus, peerData?: any) => void;
  className?: string;
}

const sizeMap = {
  sm: { btn: "px-3 py-1.5 text-[9px] rounded-xl gap-1", icon: "w-2.5 h-2.5" },
  md: { btn: "px-4 py-2.5 text-[11px] rounded-2xl gap-1.5", icon: "w-3.5 h-3.5" },
  lg: { btn: "px-6 py-4 text-[13px] rounded-2xl gap-2", icon: "w-4 h-4" },
};

export function ConnectionButton({
  targetUsername,
  initialStatus,
  requestId,
  size = "md",
  fullWidth = false,
  onStatusChange,
  className = "",
}: ConnectionButtonProps) {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingReqId, setPendingReqId] = useState<number | undefined>(requestId);
  const [showCancelHint, setShowCancelHint] = useState(false);

  const sz = sizeMap[size];
  const widthCls = fullWidth ? "w-full justify-center" : "";

  const updateStatus = useCallback(
    (next: ConnectionStatus, peerData?: any) => {
      setStatus(next);
      onStatusChange?.(next, peerData);
    },
    [onStatusChange]
  );

  // ─── Send Request ───────────────────────────────────────────────────────────
  const handleRequest = async () => {
    if (isLoading) return;
    setIsLoading(true);
    // Optimistic update
    updateStatus("pending_sent");
    try {
      const me = typeof window !== "undefined"
        ? localStorage.getItem("nexora_signup_username") || ""
        : "";
      const fromName = typeof window !== "undefined"
        ? localStorage.getItem("nexora_signup_name") || me
        : me;
      const fromColor = typeof window !== "undefined"
        ? localStorage.getItem("nexora_signup_color") || "#6c5ce7"
        : "#6c5ce7";

      const res = await nexoraFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({ to: targetUsername, fromName, fromColor }),
      });

      if (res?.status === "accepted") {
        // Auto-accepted (mutual / bidirectional request)
        updateStatus("friends", res);
      } else if (res?.status === "already_connected") {
        updateStatus("friends");
      } else if (!res || (res.status !== "sent" && res.status !== "already_sent")) {
        // Rollback on genuine failure
        updateStatus("none");
      }
    } catch {
      updateStatus("none");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Cancel Request ─────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (isLoading || !pendingReqId) return;
    setIsLoading(true);
    updateStatus("none"); // optimistic
    try {
      await nexoraFetch(`/api/connections/request/${pendingReqId}`, {
        method: "DELETE",
      });
    } catch {
      updateStatus("pending_sent"); // rollback
    } finally {
      setIsLoading(false);
      setShowCancelHint(false);
    }
  };

  // ─── Accept ─────────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (isLoading || !pendingReqId) return;
    setIsLoading(true);
    updateStatus("friends"); // optimistic
    try {
      const res = await nexoraFetch("/api/connections/respond", {
        method: "POST",
        body: JSON.stringify({ requestId: pendingReqId, action: "accept" }),
      });
      if (res?.status !== "accepted") {
        updateStatus("pending_received"); // rollback
      }
    } catch {
      updateStatus("pending_received");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Decline ────────────────────────────────────────────────────────────────
  const handleDecline = async () => {
    if (isLoading || !pendingReqId) return;
    setIsLoading(true);
    updateStatus("none"); // optimistic — remove from list
    try {
      await nexoraFetch("/api/connections/respond", {
        method: "POST",
        body: JSON.stringify({ requestId: pendingReqId, action: "decline" }),
      });
    } catch {
      updateStatus("pending_received"); // rollback
    } finally {
      setIsLoading(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER — animated state transitions
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* ── NONE: Request button ── */}
      {status === "none" && (
        <motion.button
          key="request"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRequest}
          disabled={isLoading}
          className={`flex items-center font-black uppercase tracking-widest transition-all text-white shadow-lg shadow-[#6c5ce7]/25 disabled:opacity-60 ${sz.btn} ${widthCls} ${className}`}
          style={{ background: "linear-gradient(135deg, #6c5ce7, #8271ff)" }}
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
              className={`border-2 border-white/30 border-t-white rounded-full ${sz.icon}`}
            />
          ) : (
            <UserPlus className={sz.icon} />
          )}
          <span>Request</span>
        </motion.button>
      )}

      {/* ── PENDING SENT: Request Sent (with cancel on hover) ── */}
      {status === "pending_sent" && (
        <motion.div
          key="pending-sent"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          className={`relative ${widthCls}`}
          onMouseEnter={() => pendingReqId && setShowCancelHint(true)}
          onMouseLeave={() => setShowCancelHint(false)}
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={showCancelHint && pendingReqId ? handleCancel : undefined}
            disabled={isLoading}
            className={`flex items-center font-black uppercase tracking-widest border transition-all disabled:opacity-60 ${sz.btn} ${widthCls} ${className}`}
            style={{
              background: showCancelHint && pendingReqId
                ? "rgba(255,0,110,0.08)"
                : "rgba(255,190,11,0.08)",
              color: showCancelHint && pendingReqId ? "#ff006e" : "#ffbe0b",
              borderColor: showCancelHint && pendingReqId
                ? "rgba(255,0,110,0.25)"
                : "rgba(255,190,11,0.25)",
            }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {showCancelHint && pendingReqId ? (
                <motion.span
                  key="cancel-lbl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <X className={sz.icon} />
                  <span>Cancel</span>
                </motion.span>
              ) : (
                <motion.span
                  key="sent-lbl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1"
                >
                  <Clock className={sz.icon} />
                  <span>Request Sent</span>
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>
      )}

      {/* ── PENDING RECEIVED: Accept / Decline ── */}
      {status === "pending_received" && (
        <motion.div
          key="pending-received"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          className={`flex gap-2 ${widthCls}`}
        >
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAccept}
            disabled={isLoading}
            className={`flex-1 flex items-center font-black uppercase tracking-widest text-white shadow-md shadow-[#2ed573]/20 disabled:opacity-60 ${sz.btn} justify-center`}
            style={{ background: "linear-gradient(135deg, #2ed573, #00b894)" }}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                className={`border-2 border-white/30 border-t-white rounded-full ${sz.icon}`}
              />
            ) : (
              <Check className={sz.icon} />
            )}
            <span>Accept</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDecline}
            disabled={isLoading}
            className={`flex items-center font-black uppercase tracking-widest border disabled:opacity-60 ${sz.btn} justify-center`}
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "var(--text-secondary)",
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <X className={sz.icon} />
            <span>Decline</span>
          </motion.button>
        </motion.div>
      )}

      {/* ── FRIENDS: Connected badge ── */}
      {status === "friends" && (
        <motion.div
          key="friends"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.18 }}
          className={`flex items-center font-black uppercase tracking-widest border ${sz.btn} ${widthCls} ${className}`}
          style={{
            background: "rgba(46,213,115,0.08)",
            color: "#2ed573",
            borderColor: "rgba(46,213,115,0.2)",
          }}
        >
          <Users className={sz.icon} />
          <span>Friends</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
