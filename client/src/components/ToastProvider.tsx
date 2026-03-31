"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, AlertTriangle, Info } from "lucide-react";

export function ToastProvider() {
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "error" | "info" }[]>([]);

  useEffect(() => {
    // Save original alert just in case
    const originalAlert = window.alert;

    // Override window.alert globally
    window.alert = (message?: any) => {
      const msgStr = String(message || "");
      if (!msgStr) return;

      // Determine type based on keywords
      const lowerMsg = msgStr.toLowerCase();
      let type: "success" | "error" | "info" = "info";
      
      if (lowerMsg.includes("error") || lowerMsg.includes("fail") || lowerMsg.includes("denied") || lowerMsg.includes("invalid") || lowerMsg.includes("incorrect") || lowerMsg.includes("taken") || lowerMsg.includes("unauthorized")) {
        type = "error";
      } else if (lowerMsg.includes("success") || lowerMsg.includes("live") || lowerMsg.includes("sent") || lowerMsg.includes("created") || lowerMsg.includes("granted") || lowerMsg.includes("copied")) {
        type = "success";
      }

      addToast(msgStr, type);
    };

    return () => {
      window.alert = originalAlert; // Restore on unmount (though this is a global provider so it rarely unmounts)
    };
  }, []);

  // Listen to custom event for manual toast firing with explicit types
  useEffect(() => {
    const handleCustomToast = (e: any) => {
        if (e.detail) {
           addToast(e.detail.message, e.detail.type || "info");
        }
    };
    window.addEventListener("nexora-toast", handleCustomToast);
    return () => window.removeEventListener("nexora-toast", handleCustomToast);
  }, []);

  const addToast = (message: string, type: "success" | "error" | "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className={`px-4 py-2 rounded-full shadow-2xl backdrop-blur-md text-sm font-bold flex items-center gap-2 border pointer-events-auto ${
              toast.type === "success"
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : toast.type === "error"
                ? "bg-red-500/20 text-red-500 border-red-500/30"
                : "bg-blue-500/20 text-blue-400 border-blue-500/30"
            }`}
          >
            {toast.type === "success" && <Check className="w-4 h-4" />}
            {toast.type === "error" && <AlertTriangle className="w-4 h-4" />}
            {toast.type === "info" && <Info className="w-4 h-4" />}
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
