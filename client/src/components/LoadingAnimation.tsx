"use client";

import { motion } from "framer-motion";

interface LoadingAnimationProps {
  variant?: "pulse" | "dots" | "spinner";
  color?: string;
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function LoadingAnimation({
  variant = "pulse",
  color = "#6c5ce7",
  size = "md",
  text,
  className = "",
}: LoadingAnimationProps) {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const dotSizeMap = {
    sm: "w-1.5 h-1.5",
    md: "w-2.5 h-2.5",
    lg: "w-4 h-4",
  };

  const containerSizes = {
    sm: "gap-1",
    md: "gap-2",
    lg: "gap-3",
  };

  // Pulse Variant (Soft glowing orb)
  if (variant === "pulse") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
            boxShadow: [
              `0 0 0px ${color}00`,
              `0 0 20px ${color}80`,
              `0 0 0px ${color}00`,
            ],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`${sizeMap[size]} rounded-full`}
          style={{ background: color }}
        />
        {text && (
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-xs font-bold uppercase tracking-widest text-center"
            style={{ color }}
          >
            {text}
          </motion.p>
        )}
      </div>
    );
  }

  // Dots Variant (Bouncing dots)
  if (variant === "dots") {
    return (
      <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
        <div className={`flex items-center justify-center ${containerSizes[size]}`}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                y: ["0%", "-50%", "0%"],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
              className={`${dotSizeMap[size]} rounded-full`}
              style={{ background: color }}
            />
          ))}
        </div>
        {text && (
          <p className="text-xs font-bold uppercase tracking-widest text-center opacity-70" style={{ color: "var(--text-muted)" }}>
            {text}
          </p>
        )}
      </div>
    );
  }

  // Spinner Variant (Modern segmented spinner)
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className={`${sizeMap[size]} rounded-full border-2 border-t-transparent`}
        style={{ borderColor: `${color}40`, borderTopColor: color }}
      />
      {text && (
         <p className="text-xs font-semibold text-center" style={{ color: "var(--text-muted)" }}>{text}</p>
      )}
    </div>
  );
}
