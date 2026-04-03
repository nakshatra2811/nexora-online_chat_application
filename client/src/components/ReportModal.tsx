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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    setErrorMsg(null);
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
        setTimeout(onClose, 2500);
      } else {
        setErrorMsg("Failed to relay report. Please try again.");
      }
    } catch (e) {
      console.error("Report failed:", e);
      setErrorMsg("Network error. Protocol submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-slate-200 rounded-[2.5rem] shadow-[0_32px_128px_rgba(0,0,0,0.1)] overflow-hidden"
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <Flag className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Report @{targetUser}</h2>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Community Safety Center</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-slate-900"><X className="w-5 h-5" /></button>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center justify-center text-center space-y-4"
              >
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center border border-green-100">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Report Received</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-[280px]">Our safety team will review this user for protocol violations. Thank you for keeping Nexora safe.</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm text-slate-600 mb-6 font-medium">Why are you reporting this user? Your report helps maintain a secure and respectful environment.</p>
                
                {/* Evidence Warning */}
                <div className="mb-6 p-4 rounded-2xl bg-orange-50 border border-orange-100 flex gap-4 items-center">
                  <Shield className="w-5 h-5 text-orange-600 shrink-0" />
                  <p className="text-[10px] font-black text-orange-800 leading-relaxed uppercase tracking-wider">
                    Protocol Notice: Reporting will share the last 5 messages for verification.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-2.5 mb-8">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left ${
                        selectedReason === reason.id 
                          ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/10" 
                          : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100 hover:border-slate-200"
                      }`}
                    >
                      <span className="text-xl">{reason.icon}</span>
                      <span className="text-sm font-bold uppercase tracking-tight">{reason.label}</span>
                    </button>
                  ))}
                </div>

                <div className="mb-8 p-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Additional Context (Optional)</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Provide specific details about the behavior..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 transition-all min-h-[120px] resize-none font-medium"
                  />
                </div>

                {errorMsg && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-bold text-red-500 mb-4 text-center">{errorMsg}</motion.p>
                )}

                <div className="flex gap-4">
                  <button 
                    onClick={onClose}
                    className="flex-1 py-4.5 text-xs font-black text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmit}
                    disabled={!selectedReason || isSubmitting}
                    className={`flex-1 py-4.5 text-xs font-black text-white rounded-2xl transition-all uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-2 ${
                      !selectedReason || isSubmitting 
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                        : "bg-red-600 hover:bg-red-700 active:scale-95 shadow-red-600/20"
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

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                <Lock className="w-3 h-3" /> Secure Ethics Enforcement Protocol
            </p>
        </div>
      </motion.div>
    </div>
  );
};
