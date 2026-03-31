"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Camera, Mic, Bell, Globe, Sparkles, X, CheckCircle2 } from "lucide-react";

const PERMISSIONS_LIST = [
  { id: 'media', name: 'Camera & Microphone', icon: Camera, sub: 'For secure P2P Video/Voice calling.', desc: 'Encrypted peer-to-peer streaming.' },
  { id: 'notifications', name: 'Direct Notifications', icon: Bell, sub: 'Instant message alerts.', desc: 'Never miss a secure transmission.' },
  { id: 'location', name: 'Zero-Trace Location', icon: Globe, sub: 'Proximity matching (optional).', desc: 'Find nearby protocol nodes.' },
];

export function PermissionsManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [granted, setGranted] = useState<string[]>([]);

  useEffect(() => {
    const hasSeen = localStorage.getItem("nexora_permissions_initial_prompt");
    if (!hasSeen) {
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleGrant = async (id: string) => {
    try {
      if (id === 'media') {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop());
      } else if (id === 'notifications') {
        await Notification.requestPermission();
      } else if (id === 'location') {
        await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject));
      }
      setGranted(prev => [...prev, id]);
    } catch (err) {
      console.warn("Permission blocked for:", id);
      setGranted(prev => [...prev, id]); // Still move to next for UX
    }
  };

  const complete = () => {
    localStorage.setItem("nexora_permissions_initial_prompt", "true");
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-lg glass-panel p-0 overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.5)] border-white/10"
          >
            {/* Header */}
            <div className="p-8 pb-4 text-center relative">
               <div className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors cursor-pointer" onClick={() => setIsOpen(false)}>
                  <X size={20} />
               </div>
               <div className="w-16 h-16 bg-[#6c5ce7]/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(108,92,231,0.3)]">
                  <Shield size={32} className="text-[#6c5ce7]" />
               </div>
               <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Protocol Access</h2>
               <p className="text-[#94a3b8] text-sm font-bold max-w-sm mx-auto leading-relaxed">
                  To establish full connectivity, Nexora requires permission to access critical hardware and network interfaces.
               </p>
            </div>

            {/* List */}
            <div className="px-8 py-6 space-y-4">
               {PERMISSIONS_LIST.map((p, i) => (
                  <div 
                    key={p.id}
                    className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-[#6c5ce7]/30 transition-all cursor-pointer relative overflow-hidden"
                    onClick={() => !granted.includes(p.id) && handleGrant(p.id)}
                  >
                     <div className="flex items-center gap-4 relative z-10">
                        <div className={`p-3 rounded-xl ${granted.includes(p.id) ? 'bg-[#2ed573]/20 text-[#2ed573]' : 'bg-[#6c5ce7]/10 text-[#6c5ce7]'} group-hover:scale-110 transition-transform`}>
                           <p.icon size={20} />
                        </div>
                        <div className="text-left">
                           <h4 className="text-sm font-black text-white">{p.name}</h4>
                           <p className="text-[10px] uppercase font-bold tracking-widest text-[#64748b] group-hover:text-[#6c5ce7] transition-colors">{p.sub}</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        {granted.includes(p.id) ? (
                           <CheckCircle2 size={24} className="text-[#2ed573]" />
                        ) : (
                           <div className="text-[10px] font-black text-[#6c5ce7] px-3 py-1 rounded-full bg-[#6c5ce7]/10 border border-[#6c5ce7]/20 uppercase tracking-widest">Enable</div>
                        )}
                     </div>
                  </div>
               ))}
            </div>

            {/* Footer */}
            <div className="p-8 pt-4">
               <button 
                  onClick={granted.length >= PERMISSIONS_LIST.length ? complete : () => {
                     PERMISSIONS_LIST.forEach(p => handleGrant(p.id));
                     setTimeout(complete, 1000);
                  }}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#6c5ce7] to-[#8271ff] text-white font-black text-lg shadow-[0_20px_40px_rgba(108,92,231,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
               >
                  {granted.length >= PERMISSIONS_LIST.length ? "PROTOCOL ESTABLISHED" : "AUTHORIZE ACCESS"}
                  <Sparkles size={20} />
               </button>
               <p className="text-[10px] text-center mt-6 font-bold text-[#64748b] uppercase tracking-[0.2em] leading-relaxed opacity-50">
                  Nexora does not store raw data. All access is strictly used for real-time synchronization.
               </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
