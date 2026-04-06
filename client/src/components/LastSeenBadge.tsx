"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatLastSeen, INDIAN_LOCALE, MUMBAI_TIMEZONE } from "@/lib/time";
import { Clock } from "lucide-react";

interface LastSeenBadgeProps {
  username: string;
  isOnline: boolean;
  lastVisit?: number | string | null;
  className?: string;
}

export const LastSeenBadge = ({ isOnline, lastVisit, className = "" }: LastSeenBadgeProps) => {
  const [phase, setPhase] = useState<"initial" | "scanning" | "final">("initial");

  // Format exact IST target
  const exactTime = useMemo(() => {
    if (!lastVisit) return "";
    const date = new Date(Number(lastVisit));
    if (isNaN(date.getTime())) return "";
    
    return date.toLocaleTimeString(INDIAN_LOCALE, {
      timeZone: MUMBAI_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).toUpperCase();
  }, [lastVisit]);

  useEffect(() => {
    if (isOnline) {
      setPhase("initial");
      return;
    }

    // Animation sequence for offline status
    const timer1 = setTimeout(() => setPhase("scanning"), 2000);
    const timer2 = setTimeout(() => setPhase("final"), 4500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOnline, lastVisit]);

  if (isOnline) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-green-500/80">Online</span>
      </div>
    );
  }

  if (!lastVisit) {
    return (
      <div className={`flex items-center gap-1.5 opacity-40 ${className}`}>
        <Clock className="w-3 h-3" />
        <span className="text-[10px] font-bold uppercase tracking-widest italic">Last seen recently</span>
      </div>
    );
  }

  return (
    <div className={`relative h-5 flex items-center overflow-hidden min-w-[120px] ${className}`}>
      <AnimatePresence mode="wait">
        {phase === "initial" && (
          <motion.div
            key="p1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 0.5, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-1.5"
          >
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Last visited</span>
          </motion.div>
        )}

        {phase === "scanning" && (
          <motion.div
            key="p2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex items-center px-1"
          >
            <div className="w-full h-[1px] bg-white/10 relative overflow-hidden">
               <motion.div 
                 initial={{ x: "-100%" }}
                 animate={{ x: "100%" }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                 className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-[#6c5ce7] to-transparent"
               />
            </div>
          </motion.div>
        )}

        {phase === "final" && (
          <motion.div
            key="p3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5"
          >
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-tight text-[#6c5ce7]">
                  Visited at {exactTime}
                </span>
                <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest -mt-0.5">
                  {formatLastSeen(lastVisit)}
                </span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
