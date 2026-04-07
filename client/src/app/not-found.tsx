"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full blur-[120px] pointer-events-none"
        style={{ background: "rgba(108,92,231,0.2)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/3 w-64 h-64 rounded-full blur-[120px] pointer-events-none"
        style={{ background: "rgba(0,212,255,0.12)" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center max-w-md"
      >
        {/* Icon */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="w-24 h-24 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,212,255,0.10))",
            border: "1px solid rgba(108,92,231,0.2)",
            backdropFilter: "blur(20px)",
          }}
        >
          <Shield className="w-12 h-12 text-[#6c5ce7]" />
        </motion.div>

        {/* Error Code */}
        <h1
          className="text-7xl font-black tracking-tighter mb-3"
          style={{
            background: "linear-gradient(135deg, #6c5ce7, #00d4ff)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          404
        </h1>

        <h2
          className="text-2xl font-extrabold tracking-tight mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Route Not Found
        </h2>

        <p
          className="text-sm font-medium leading-relaxed mb-8 max-w-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          The requested protocol endpoint does not exist or has been relocated.
          Please navigate back to a secure section.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.back()}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm transition-all"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/dashboard/chats")}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-extrabold text-sm text-white shadow-xl"
            style={{
              background: "linear-gradient(135deg, #6c5ce7, #00d4ff)",
              boxShadow: "0 8px 30px rgba(108,92,231,0.3)",
            }}
          >
            <Home className="w-4 h-4" />
            Home
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
