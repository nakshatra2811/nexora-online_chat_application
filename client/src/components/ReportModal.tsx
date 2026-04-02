"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Shield, Lock, Gavel, Scale, Flag, CheckCircle } from "lucide-react";
import { nexoraFetch } from "@/lib/config";

const REPORT_REASONS = [
  { id: "harassment", label: "Harassment or Bullying", icon: "😠" },
  { id: "illegal", label: "Illegal Activity / Drugs / Weapons", icon: "⚖️" },
  { id: "spam", label: "Spam or Scams", icon: "📧" },
  { id: "hate", label: "Hate Speech or Extremism", icon: "🚫" },
  { id: "other", label: "Other Policy Violation", icon: "💬" },
];

export const ReportModal = ({ 
  isOpen, 
  onClose, 
  targetUser, 
  reporterUser,
  evidenceMessages = []
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  targetUser: string; 
  reporterUser: string;
  evidenceMessages?: any[];
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    try {
      const res = await nexoraFetch("/api/report", {
        method: "POST",
        body: JSON.stringify({
          reporter: reporterUser,
          target: targetUser,
          reason: context || "No additional context provided",
          category: selectedReason,
          evidence: evidenceMessages.map(m => ({ from: m.from, text: m.text || "Media/Encrypted" }))
        })
      });
      if (res && res.success) {
        setIsSuccess(true);
        setTimeout(onClose, 2000);
      }
    } catch (e) {
      console.error("Report failed:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#0f0f1a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 rounded-2xl">
                <Flag className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Report @{targetUser}</h2>
                <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mt-0.5">Community Safety Center</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-all opacity-40 hover:opacity-100"><X className="w-5 h-5 text-white" /></button>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Report Received</h3>
                  <p className="text-sm text-white/50 mt-1 max-w-[250px]">Our safety team will review this user for protocol violations. Thank you for keeping Nexora safe.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm text-white/70 mb-3 px-1">Why are you reporting this user? Your report is anonymous and helps secure the network.</p>
                
                {/* Evidence Warning */}
                <div className="mb-5 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex gap-3 items-center">
                  <Shield className="w-5 h-5 text-orange-500 shrink-0" />
                  <p className="text-[10px] font-bold text-orange-200/70 leading-relaxed uppercase tracking-wider">
                    Protocol Notice: Reporting will share the last 5 messages of this chat with our safety team for verification.
                  </p>
                </div>
                
                <div className="space-y-2 mb-6">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all duration-300 text-left ${
                        selectedReason === reason.id 
                          ? "bg-[#6c5ce7]/20 border-[#6c5ce7] text-white" 
                          : "bg-white/5 border-transparent text-white/60 hover:bg-white/10"
                      }`}
                    >
                      <span className="text-lg">{reason.icon}</span>
                      <span className="text-sm font-bold">{reason.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mb-6 px-1">
                  <label className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 ml-1">Additional Context (Optional)</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Provide details about the illegal or abusive activity..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#6c5ce7] transition-all min-h-[100px] resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={onClose}
                    className="flex-1 py-4 text-xs font-bold text-white/50 hover:text-white transition-all uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={!selectedReason || isSubmitting}
                    className={`flex-1 py-4 text-xs font-black text-white rounded-2xl transition-all uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 ${
                      !selectedReason || isSubmitting ? "bg-white/10 opacity-50 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 active:scale-95"
                    }`}
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>SUBMIT REPORT</>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 bg-black/40 text-center">
            <p className="text-[9px] text-white/20 font-medium uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                <Lock className="w-3 h-3" /> Secure Ethics Enforcement Protocol
            </p>
        </div>
      </motion.div>
    </div>
  );
};
