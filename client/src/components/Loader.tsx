"use client";

import { motion } from "framer-motion";

export const Loader = ({ size = "md", text }: { size?: "sm" | "md" | "lg", text?: string }) => {
  const sizeMap = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className={`${sizeMap[size]} border-t-[#6c5ce7] border-r-transparent border-b-[#00d4ff] border-l-transparent rounded-full drop-shadow-lg`}
      />
      {text && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm font-medium tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

export const OverlayLoader = ({ text }: { text?: string }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 rounded-inherit overflow-hidden">
      <Loader size="lg" text={text || "Loading..."} />
    </div>
  );
};

export const ButtonLoader = ({ size = "sm" }: { size?: "sm" | "md" }) => {
  const sizeMap = {
    sm: "w-5 h-5 border-2",
    md: "w-6 h-6 border-2",
  };
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      className={`inline-block ${sizeMap[size]} border-t-white border-r-transparent border-b-white/50 border-l-transparent rounded-full`}
    />
  );
};
