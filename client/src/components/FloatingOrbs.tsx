"use client";

import { motion } from "framer-motion";

interface OrbConfig {
  size: number;
  x: string;
  y: string;
  color: string;
  duration: number;
  delay: number;
  blur: number;
}

const DEFAULT_ORBS: OrbConfig[] = [
  { size: 400, x: "-10%", y: "-10%", color: "#6c5ce7", duration: 12, delay: 0, blur: 100 },
  { size: 500, x: "60%", y: "10%", color: "#00d4ff", duration: 15, delay: 2, blur: 120 },
  { size: 350, x: "30%", y: "60%", color: "#ff006e", duration: 18, delay: 4, blur: 90 },
  { size: 300, x: "80%", y: "70%", color: "#ffbe0b", duration: 20, delay: 6, blur: 110 },
];

export function FloatingOrbs({ orbs = DEFAULT_ORBS, opacity = 0.12 }: { orbs?: OrbConfig[]; opacity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: orb.color,
            filter: `blur(${orb.blur}px)`,
            opacity,
            mixBlendMode: "multiply",
          }}
          animate={{
            x: [0, 30, -20, 0],
            y: [0, -25, 20, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
