"use client";

import { motion } from "framer-motion";

// A purely CSS-driven 3D geometric scene using perspective transforms
// No external 3D library required — native browser GPU compositing

interface Shape {
  type: "sphere" | "cube" | "ring" | "pyramid";
  color: string;
  size: number;
  x: string;
  y: string;
  duration: number;
  delay: number;
  rotateAxis?: "X" | "Y" | "Z";
}

const DEFAULT_SHAPES: Shape[] = [
  { type: "sphere", color: "from-[#6c5ce7] to-[#00d4ff]", size: 80, x: "15%", y: "20%", duration: 8, delay: 0 },
  { type: "ring", color: "from-[#ff006e] to-[#ffbe0b]", size: 60, x: "75%", y: "15%", duration: 10, delay: 1, rotateAxis: "Y" },
  { type: "cube", color: "from-[#2ed573] to-[#1e90ff]", size: 50, x: "80%", y: "65%", duration: 12, delay: 2, rotateAxis: "X" },
  { type: "sphere", color: "from-[#a29bfe] to-[#fd79a8]", size: 40, x: "55%", y: "75%", duration: 9, delay: 3 },
  { type: "ring", color: "from-[#00d4ff] to-[#6c5ce7]", size: 70, x: "25%", y: "70%", duration: 14, delay: 1.5, rotateAxis: "Z" },
];

function Sphere({ shape }: { shape: Shape }) {
  return (
    <motion.div
      className={`absolute rounded-full bg-gradient-to-br ${shape.color} shadow-2xl`}
      style={{
        width: shape.size,
        height: shape.size,
        left: shape.x,
        top: shape.y,
        filter: "drop-shadow(0 0 20px currentColor)",
      }}
      animate={{ y: [0, -18, 0], rotateZ: [0, 360] }}
      transition={{ duration: shape.duration, delay: shape.delay, repeat: Infinity, ease: "easeInOut", rotateZ: { duration: shape.duration * 2, repeat: Infinity, ease: "linear" } }}
    />
  );
}

function Ring({ shape }: { shape: Shape }) {
  return (
    <motion.div
      className={`absolute rounded-full border-[6px] border-transparent`}
      style={{
        width: shape.size,
        height: shape.size,
        left: shape.x,
        top: shape.y,
        borderImage: "none",
        background: `linear-gradient(white, white) padding-box, linear-gradient(135deg, #6c5ce7, #00d4ff) border-box`,
        opacity: 0.8,
      }}
      animate={{
        y: [0, -12, 0],
        rotateX: shape.rotateAxis === "X" ? [0, 360] : 0,
        rotateY: shape.rotateAxis === "Y" ? [0, 360] : 0,
        rotateZ: shape.rotateAxis === "Z" ? [0, 360] : 0,
      }}
      transition={{ duration: shape.duration, delay: shape.delay, repeat: Infinity, ease: "easeInOut", rotate: { duration: shape.duration, repeat: Infinity, ease: "linear" } }}
    />
  );
}

function Cube({ shape }: { shape: Shape }) {
  return (
    <motion.div
      className={`absolute bg-gradient-to-br ${shape.color} opacity-70`}
      style={{ width: shape.size, height: shape.size, left: shape.x, top: shape.y, borderRadius: "12px" }}
      animate={{ y: [0, -14, 0], rotate: [0, 90, 180, 270, 360] }}
      transition={{ duration: shape.duration, delay: shape.delay, repeat: Infinity, ease: "easeInOut", rotate: { duration: shape.duration * 1.5, repeat: Infinity, ease: "linear" } }}
    />
  );
}

export function Scene3D({ shapes = DEFAULT_SHAPES, className = "" }: { shapes?: Shape[]; className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ perspective: "1000px" }}>
      {shapes.map((shape, i) => {
        if (shape.type === "ring") return <Ring key={i} shape={shape} />;
        if (shape.type === "cube") return <Cube key={i} shape={shape} />;
        return <Sphere key={i} shape={shape} />;
      })}
    </div>
  );
}
