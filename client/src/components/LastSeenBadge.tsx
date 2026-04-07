"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatLastSeen } from "@/lib/time";
import { Clock } from "lucide-react";

interface LastSeenBadgeProps {
  username: string;
  isOnline: boolean;
  lastVisit?: number | string | null;
  className?: string;
}

export const LastSeenBadge = ({ isOnline, lastVisit, className = "" }: LastSeenBadgeProps) => {
  const [phase, setPhase] = useState<"initial" | "scanning" | "final">("initial");

  // Privacy Rule: If hidden, show nothing at all
  if (!isOnline && !lastVisit) return null;

  useEffect(() => {
    if (isOnline) {
      setPhase("initial");
      return;
    }

    // Keep synchronization animations for premium feel
    const timer1 = setTimeout(() => setPhase("scanning"), 500);
    const timer2 = setTimeout(() => setPhase("final"), 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOnline]);

  if (isOnline) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ed573] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2ed573]"></span>
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#2ed573]">Online</span>
      </div>
    );
  }

  return (
    <div className={`relative h-6 flex flex-col justify-center items-end overflow-hidden ${className}`}>
      <AnimatePresence mode="wait">
        {phase === "initial" && (
          <motion.div
            key="p1"
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            className="flex items-center gap-1"
          >
             <Clock className="w-2.5 h-2.5 text-zinc-500" />
             <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Syncing</span>
          </motion.div>
        )}

        {phase === "scanning" && (
          <motion.div
            key="p2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-24 h-[1px] bg-white/5 relative overflow-hidden"
          >
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-transparent via-[#6c5ce7] to-transparent"
            />
          </motion.div>
        )}

        {phase === "final" && (
          <motion.div
            key="p3"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-end"
          >
            <span className="text-[9px] font-bold uppercase tracking-tight text-white/40">
              {formatLastSeen(lastVisit).toUpperCase()}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
