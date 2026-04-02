"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Shield, Lock, Gavel, Scale } from "lucide-react";

export const LegalInfo = ({ isOpen, onClose, tab = "privacy" }: { isOpen: boolean; onClose: () => void; tab?: "privacy" | "terms" | "disclaimer" }) => {
  const [activeTab, setActiveTab] = useState(tab);

  if (!isOpen) return null;

  const content = {
    privacy: {
      title: "Privacy Policy",
      icon: <Shield className="w-5 h-5 text-green-500" />,
      text: (
        <div className="space-y-4 text-sm opacity-80 leading-relaxed">
          <p><strong>Nexora Private Protocol</strong> is built on a Zero-Knowledge architecture. This means your privacy is the default state, not a feature.</p>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">1. End-To-End Encryption</h4>
            <p>Every message, media, and call is encrypted on your device. Only you and the recipient hold the keys. Nexora servers <strong>cannot</strong> read your messages.</p>
          </section>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">2. Metadata Collection</h4>
            <p>We collect minimal metadata (IP address, device type, connection timestamps) to ensure the technical stability of the protocol. This data is never linked to your identity for marketing.</p>
          </section>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">3. Zero Storage</h4>
            <p>Once a message is delivered to all your devices, it is removed from our relay servers. We do not maintain long-term archives of your conversations.</p>
          </section>
        </div>
      ),
    },
    terms: {
      title: "Terms of Service",
      icon: <Gavel className="w-5 h-5 text-orange-500" />,
      text: (
        <div className="space-y-4 text-sm opacity-80 leading-relaxed">
          <p>By using Nexora, you agree to these legal terms. Our mission is safety and privacy, but abuse is not tolerated.</p>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">1. Prohibited Conduct</h4>
            <p>You may not use Nexora for illegal activities, including but not limited to: terrorism, harassment, distribution of illegal imagery, or coordinated criminal acts.</p>
          </section>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">2. Accountability</h4>
            <p>While we cannot see your content, users can <strong>report</strong> accounts. If Nexora receives multiple credible reports of illegal activity, we reserve the right to suspend the offending account's access to the protocol.</p>
          </section>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">3. Protocol Integrity</h4>
            <p>Any attempt to reverse-engineer the protocol or compromise its security for other users will result in an immediate and permanent ban.</p>
          </section>
        </div>
      ),
    },
    disclaimer: {
      title: "Legal Disclaimer",
      icon: <Scale className="w-5 h-5 text-blue-500" />,
      text: (
        <div className="space-y-4 text-sm opacity-80 leading-relaxed">
          <p><strong>NEXORA IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND.</strong></p>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">1. User Responsibility</h4>
            <p>Nexora is a tool. We are not responsible for how it is used. Users are solely responsible for their communications and any legal consequences thereof.</p>
          </section>
          <section>
            <h4 className="font-bold text-[#6c5ce7] mb-1">2. Service Continuity</h4>
            <p>As a highly experimental security protocol, we do not guarantee 100% uptime. Use Nexora at your own risk for mission-critical communications.</p>
          </section>
        </div>
      ),
    },
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#0a0a14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#6c5ce7]" />
            <h2 className="font-black text-white text-lg tracking-tight">Nexora Legal Center</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 text-white/50" /></button>
        </div>

        <div className="flex border-b border-white/5">
          {Object.keys(content).map((key) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 py-3 text-[10px] uppercase font-black tracking-widest transition-all ${
                activeTab === key ? "text-[#6c5ce7] border-b-2 border-[#6c5ce7]" : "text-white/40 hover:text-white/60"
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 text-white">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-white/5 rounded-xl">{content[activeTab].icon}</div>
            <h3 className="text-xl font-black">{content[activeTab].title}</h3>
          </div>
          {content[activeTab].text}
        </div>

        <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[#6c5ce7] hover:bg-[#5b4dbd] text-white text-xs font-bold rounded-lg transition-all active:scale-95"
          >
            I UNDERSTAND
          </button>
        </div>
      </motion.div>
    </div>
  );
};
