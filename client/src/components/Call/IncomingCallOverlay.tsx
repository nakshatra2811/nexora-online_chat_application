"use client";

/**
 * IncomingCallOverlay.tsx — Nexora Incoming Call Screen
 *
 * ISOLATED: This component is purely presentational. It receives props and
 * fires callbacks. Zero dependency on chats page or other pages.
 */

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Video, PhoneOff } from "lucide-react";

interface IncomingCallOverlayProps {
  callerName: string;
  callerColor: string;
  callType: "voice" | "video";
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  callerName,
  callerColor,
  callType,
  onAccept,
  onDecline,
}) => {
  // Prevent background scroll while overlay is shown
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[2000] bg-[#0c0c14]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center text-white overflow-hidden"
    >
      {/* Ambient blobs */}
      <div
        className={`absolute top-0 right-0 w-[60vw] h-[60vw] max-w-xl bg-gradient-to-br ${
          callerColor || "from-[#6c5ce7] to-[#00d4ff]"
        } opacity-20 rounded-full blur-[120px] animate-pulse`}
      />
      <div
        className={`absolute bottom-0 left-0 w-[60vw] h-[60vw] max-w-xl bg-gradient-to-tl ${
          callerColor || "from-[#00d4ff] to-blue-500"
        } opacity-20 rounded-full blur-[120px] animate-pulse`}
        style={{ animationDelay: "2s" }}
      />

      <div className="relative z-10 flex flex-col items-center w-full">
        {/* Avatar with pulsing ring */}
        <div className="relative mb-8">
          {/* Outer ping rings */}
          <div className="absolute inset-0 rounded-full animate-[ping_2s_ease-out_infinite] bg-white/10 border-2 border-white/20" />
          <div
            className="absolute inset-0 rounded-full animate-[ping_3s_ease-out_infinite] bg-white/5 border border-white/10"
            style={{ animationDelay: "0.5s" }}
          />

          {/* Avatar */}
          <div
            className={`w-44 h-44 rounded-full bg-gradient-to-tr ${
              callerColor || "from-[#6c5ce7] to-[#00d4ff]"
            } flex items-center justify-center text-7xl font-black text-white shadow-[0_0_100px_rgba(108,92,231,0.5)] border-[10px] border-[#0c0c14] relative z-10 select-none`}
          >
            {callerName?.[0]?.toUpperCase() || "?"}
          </div>
        </div>

        {/* Caller name */}
        <h2
          className="text-4xl md:text-5xl font-black tracking-tight mb-3 truncate max-w-[90vw]"
          style={{ textShadow: "0 4px 30px rgba(0,0,0,0.8)" }}
        >
          {callerName || "Unknown Caller"}
        </h2>

        {/* Call type badge */}
        <div className="flex items-center justify-center gap-3 mt-1 bg-white/10 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl shadow-black/40">
          {callType === "video" ? (
            <Video className="w-5 h-5 text-[#00d4ff]" />
          ) : (
            <Phone className="w-5 h-5 text-[#00d4ff]" />
          )}
          <p className="text-sm tracking-[0.2em] uppercase font-black text-[#00d4ff]">
            Incoming {callType} Call
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="relative z-10 flex flex-row items-center justify-center gap-16 md:gap-24 mt-[12vh]">
        {/* Decline */}
        <div className="flex flex-col items-center gap-5">
          <motion.button
            whileHover={{ scale: 1.15, rotate: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={onDecline}
            className="w-20 h-20 rounded-full bg-[#ff4757] flex items-center justify-center text-white shadow-[0_0_50px_rgba(255,71,87,0.6)] relative"
          >
            <PhoneOff className="w-9 h-9 relative z-10 drop-shadow-lg" />
            <div className="absolute inset-0 rounded-full border-4 border-[#ff4757]/80 animate-ping opacity-40" />
          </motion.button>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-[#ff4757] drop-shadow-md">
            Decline
          </span>
        </div>

        {/* Accept */}
        <div className="flex flex-col items-center gap-5">
          <motion.button
            whileHover={{ scale: 1.15, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={onAccept}
            className="w-20 h-20 rounded-full bg-[#2ed573] flex items-center justify-center text-white shadow-[0_0_50px_rgba(46,213,115,0.6)] relative overflow-hidden"
          >
            {callType === "video" ? (
              <Video className="w-9 h-9 relative z-10 drop-shadow-lg" />
            ) : (
              <Phone className="w-9 h-9 relative z-10 drop-shadow-lg" />
            )}
            <div className="absolute inset-0 rounded-full border-[4px] border-[#2ed573]/80 animate-[ping_1.5s_ease-out_infinite]" />
          </motion.button>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-[#2ed573] drop-shadow-md">
            Accept
          </span>
        </div>
      </div>

      {/* Audio visualizer bars */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none opacity-20 gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <motion.div
            key={i}
            animate={{ height: [2, 14, 2] }}
            transition={{
              repeat: Infinity,
              duration: 0.7 + i * 0.05,
              delay: i * 0.08,
            }}
            className="w-1.5 bg-[#00d4ff] rounded-full"
          />
        ))}
      </div>
    </motion.div>
  );
};
