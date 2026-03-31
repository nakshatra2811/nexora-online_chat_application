"use client";

import { motion } from "framer-motion";
import { Video, Film, Headphones, Rocket, Star } from "lucide-react";
import { FloatingOrbs } from "@/components/FloatingOrbs";
import { Scene3D } from "@/components/Scene3D";

export default function CinemaPage() {
  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full p-6 overflow-hidden">
      <FloatingOrbs opacity={0.08} />
      <Scene3D shapes={[
        { type: "sphere", color: "from-[#6c5ce7] to-[#a29bfe]", size: 100, x: "5%", y: "10%", duration: 9, delay: 0 },
        { type: "ring", color: "from-[#00d4ff] to-[#6c5ce7]", size: 80, x: "85%", y: "10%", duration: 11, delay: 1, rotateAxis: "Y" },
        { type: "cube", color: "from-[#ff006e] to-[#ffbe0b]", size: 55, x: "80%", y: "70%", duration: 13, delay: 2, rotateAxis: "X" },
      ]} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 glass-panel p-14 max-w-2xl w-full text-center shadow-2xl bg-white/60"
      >
        {/* Decorative grid */}
        <div className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:28px_28px] z-0" />

        <div className="relative z-10">
          {/* 3 animated icon bubbles */}
          <div className="flex justify-center gap-5 mb-10">
            {[
              { icon: Video, color: "from-[#6c5ce7] to-[#00d4ff]", delay: 0 },
              { icon: Film, color: "from-[#ff006e] to-[#ffbe0b]", delay: 0.15 },
              { icon: Headphones, color: "from-[#2ed573] to-[#1e90ff]", delay: 0.3 },
            ].map(({ icon: Icon, color, delay }, i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 2.2 + i * 0.2, delay, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.15, rotate: 5 }}
                className={`w-18 h-18 p-5 rounded-2xl bg-gradient-to-br ${color} text-white shadow-xl cursor-pointer`}
              >
                <Icon className="w-8 h-8" />
              </motion.div>
            ))}
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
            className="text-5xl font-extrabold gradient-text mb-4"
          >
            Cinema Together
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
            className="text-[#64748b] text-base mb-10 max-w-md mx-auto leading-relaxed"
          >
            Synchronized WebRTC encrypted streaming. Watch anything, together, with zero surveillance.
          </motion.p>

          {/* Feature list */}
          <div className="grid grid-cols-2 gap-3 mb-10 text-left">
            {["E2E Video Tunnels", "Sync Playback Engine", "Screen Share Vault", "Private Watch Rooms"].map((f, i) => (
              <motion.div
                key={f} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-2 p-3 bg-white/60 rounded-xl text-sm font-semibold text-[#1a1a2e]"
              >
                <Star className="w-4 h-4 text-[#6c5ce7] shrink-0" /> {f}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: "spring" }}
            className="inline-flex items-center gap-3 px-8 py-3 rounded-full bg-gradient-to-r from-[#1a1a2e] to-[#2d3436] text-white font-bold text-sm shadow-xl"
          >
            <Rocket className="w-5 h-5 text-[#00d4ff]" />
            Coming Soon &bull; Phase 6 WebRTC
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
