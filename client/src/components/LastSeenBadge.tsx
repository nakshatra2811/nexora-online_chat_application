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

    // High performance animation sequence
    const timer1 = setTimeout(() => setPhase("scanning"), 600);
    const timer2 = setTimeout(() => setPhase("final"), 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isOnline, lastVisit]);

  if (isOnline) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4ff] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00d4ff]"></span>
        </span>
        <span className="text-[10px] font-black uppercase tracking-widest text-[#00d4ff] underline decoration-[#00d4ff]/20 underline-offset-4">Node Active</span>
      </div>
    );
  }

  // If no lastVisit, show a more descriptive placeholder
  if (!lastVisit) {
    return (
      <div className={`flex items-center gap-2 opacity-50 ${className}`}>
        <Clock className="w-3.5 h-3.5 text-[#6c5ce7]" />
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-[0.1em]">Archive Active</span>
          <span className="text-[8px] font-bold opacity-60 uppercase tracking-widest -mt-0.5 whitespace-nowrap">Calibrating IST Pulse...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-6 flex items-center overflow-hidden min-w-[150px] ${className}`}>
      <AnimatePresence mode="wait">
        {phase === "initial" && (
          <motion.div
            key="p1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 0.8, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex items-center gap-1.5"
          >
             <Clock className="w-3 h-3 text-[#6c5ce7]" />
             <span className="text-[10px] font-black uppercase tracking-widest">Protocol Sync</span>
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
            <div className="w-full h-[2px] bg-white/5 relative rounded-full overflow-hidden">
               <motion.div 
                 initial={{ x: "-100%" }}
                 animate={{ x: "100%" }}
                 transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                 className="absolute top-0 left-0 h-full w-1/2 bg-gradient-to-r from-transparent via-[#6c5ce7] to-transparent"
               />
            </div>
          </motion.div>
        )}

        {phase === "final" && (
          <motion.div
            key="p3"
            initial={{ opacity: 0, scale: 0.9, y: 3 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex items-center gap-2"
          >
             <div className="flex flex-col border-l-2 border-[#6c5ce7]/30 pl-2">
                <div className="flex flex-wrap items-center gap-1 text-[10px] font-black uppercase tracking-tight text-[#6c5ce7]">
                   LAST SEEN <span className="text-white/95">
                     {(() => {
                        const str = formatLastSeen(lastVisit).toLowerCase();
                        if (str.includes("today")) return "TODAY";
                        if (str.includes("yesterday")) return "YESTERDAY";
                        if (str.includes("just now")) return "TODAY";
                        return str.split(" at ")[0];
                     })()} 
                     <span className="ml-1">{exactTime}</span>
                   </span> 
                   <span className="text-[7px] opacity-40 ml-0.5">IST</span>
                </div>
                <div className="text-[7px] font-bold opacity-30 uppercase tracking-[0.2em] mt-0.5">Identity Synced</div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
