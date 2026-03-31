"use client";

import { motion } from "framer-motion";
import { APP_LOGO } from "@/lib/config";

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-[#0a0a0f]">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#6c5ce7] opacity-10 blur-[120px] rounded-full" />
      
      <div className="relative flex flex-col items-center gap-12">
        {/* Animated Logo Container */}
        <motion.div
           initial={{ scale: 0.8, opacity: 0 }}
           animate={{ 
             scale: [0.8, 1.1, 1],
             opacity: 1,
             rotate: [0, 5, -5, 0]
           }}
           transition={{ 
             duration: 1.5,
             repeat: Infinity,
             repeatType: "reverse",
             ease: "easeInOut"
           }}
           className="relative"
        >
          <div className="absolute inset-0 bg-[#6c5ce7] blur-2xl opacity-20 rounded-full animate-pulse" />
          <img 
            src={APP_LOGO} 
            alt="Nexora" 
            className="w-24 h-24 relative z-10 drop-shadow-[0_0_20px_rgba(108,92,231,0.5)] rounded-[25%]" 
          />
        </motion.div>

        {/* Loading Text & Progress */}
        <div className="flex flex-col items-center gap-4">
           <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-black tracking-tighter text-white italic"
           >
             NEXORA<span className="text-[#6c5ce7]">.</span>
           </motion.h2>
           
           <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden relative">
              <motion.div 
                initial={{ x: "-100%" }}
                animate={{ x: "200%" }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[#6c5ce7] to-transparent w-1/2"
              />
           </div>
           
           <motion.p 
             initial={{ opacity: 0 }}
             animate={{ opacity: [0.4, 0.8, 0.4] }}
             transition={{ duration: 2, repeat: Infinity }}
             className="text-[10px] uppercase font-black tracking-[0.3em] text-[#6c5ce7]"
           >
             Initializing Secure Protocol
           </motion.p>
        </div>
      </div>

      {/* Decorative Binary/Code lines */}
      <div className="absolute bottom-12 left-12 text-[8px] font-mono text-[#6c5ce7]/20 uppercase tracking-widest hidden md:block">
        Encrypted Tunnel Check: OK <br />
        Identity Hash: Verified <br />
        Nexus Link: ESTABLISHED
      </div>
      
      <div className="absolute top-12 right-12 text-[8px] font-mono text-[#6c5ce7]/20 uppercase tracking-widest hidden md:block text-right">
        UI V3.1.0 ANTI <br />
        STABILITY: 100% <br />
        LATENCY: 0.02ms
      </div>
    </div>
  );
}
