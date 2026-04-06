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

export const LastSeenBadge = ({ isOnline, lastVisit, className = "", username }: LastSeenBadgeProps) => {
  const [phase, setPhase] = useState<"initial" | "scanning" | "final">("initial");

  // Format exact IST target with robust parsing
  const exactTime = useMemo(() => {
    if (!lastVisit) return "";
    let ts = lastVisit;
    // Handle stringified numbers (e.g. from Postgres)
    if (typeof lastVisit === 'string' && /^\d+$/.test(lastVisit)) {
      ts = parseInt(lastVisit, 10);
    }
    const date = new Date(ts);
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

    // Sequence for protocol synchronization feel
    const timer1 = setTimeout(() => setPhase("scanning"), 600);
    const timer2 = setTimeout(() => setPhase("final"), 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOnline]);

  if (isOnline) {
    return (
      <div className={`flex flex-col items-end gap-0.5 ${className}`}>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ed573] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2ed573]"></span>
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#2ed573]">Active Protocol</span>
        </div>
        <div className="text-[7px] font-bold opacity-30 uppercase tracking-[0.2em]">Identity Synced</div>
      </div>
    );
  }

  return (
    <div className={`relative h-8 flex flex-col justify-center items-end overflow-hidden min-w-[140px] ${className}`}>
      <AnimatePresence mode="wait">
        {phase === "initial" && (
          <motion.div
            key="p1"
            initial={{ opacity: 0, x: 5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            className="flex items-center gap-1.5"
          >
             <Clock className="w-2.5 h-2.5 text-zinc-500" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Syncing...</span>
          </motion.div>
        )}

        {phase === "scanning" && (
          <motion.div
            key="p2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-32 h-[1px] bg-white/5 relative overflow-hidden"
          >
            <motion.div 
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
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
             {!lastVisit ? (
               <div className="flex flex-col items-end opacity-80 group hover:opacity-100 transition-opacity">
                 <div className="flex items-center gap-1.5 mb-0.5">
                   <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">Identity Idle</span>
                 </div>
                 <span className="text-[7px] font-bold opacity-40 uppercase tracking-widest whitespace-nowrap">Encryption Active (IST)</span>
               </div>
             ) : (
               <div className="flex flex-col items-end group">
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tight text-white/90">
                     LAST SEEN <span className="text-[#6c5ce7]">
                       {formatLastSeen(lastVisit).toUpperCase()}
                     </span> 
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="text-[7px] font-bold opacity-30 uppercase tracking-[0.1em]">Protocol Synced</div>
                    {exactTime && <div className="text-[7px] font-black text-[#6c5ce7]/60">{exactTime} IST</div>}
                  </div>
               </div>
             )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
