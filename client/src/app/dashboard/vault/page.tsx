"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Lock, FileKey2, ShieldCheck, X, Layers, Eye } from "lucide-react";
import { useState } from "react";
import { vault } from "@/lib/vault";
import { FloatingOrbs } from "@/components/FloatingOrbs";
import { Scene3D } from "@/components/Scene3D";
import { Tilt3DCard } from "@/components/Tilt3DCard";

const LAYER_COUNT = 30; // Internal only — never exposed to UI

export default function VaultPage() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [secrets, setSecrets] = useState<any[]>([]);
  const [newSecret, setNewSecret] = useState("");
  const [isStoring, setIsStoring] = useState(false);
  const [activeLayer, setActiveLayer] = useState<string>("Deep");

  const fetchVault = async () => {
    try {
      const data = await vault.retrieveSecrets();
      setSecrets(data);
    } catch { setError("Decryption failed."); }
  };

  const handleUnlock = async () => {
    if (pin.length !== 4) return;
    try {
      await vault.init(pin);
      setIsUnlocked(true);
      setError("");
      await fetchVault();
    } catch { setError("Access Denied."); }
  };

  const handleStore = async () => {
    if (!newSecret.trim()) return;
    setIsStoring(true);
    await vault.storeSecret(`sec_${Date.now()}`, newSecret);
    setNewSecret("");
    await fetchVault();
    setIsStoring(false);
  };

  const handleLock = () => {
    vault.lock();
    setIsUnlocked(false);
    setPin("");
    setSecrets([]);
  };

  return (
    <div className="relative flex w-full h-full overflow-hidden">
      <FloatingOrbs opacity={0.06} orbs={[
        { size: 350, x: "60%", y: "0%", color: "#6c5ce7", duration: 12, delay: 0, blur: 100 },
        { size: 280, x: "0%", y: "50%", color: "#00d4ff", duration: 15, delay: 3, blur: 90 },
      ]} />
      <Scene3D shapes={[
        { type: "sphere", color: "from-[#6c5ce7] to-[#a29bfe]", size: 60, x: "90%", y: "5%", duration: 8, delay: 0 },
        { type: "ring", color: "from-[#ff006e] to-[#6c5ce7]", size: 50, x: "5%", y: "80%", duration: 10, delay: 1, rotateAxis: "Z" },
      ]} />

      <AnimatePresence mode="wait">
        {!isUnlocked ? (
          /* ─── LOCKED STATE ─── */
          <motion.div
            key="locked"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center justify-center w-full h-full p-6"
          >
            <Tilt3DCard depth={15} glowColor="#6c5ce7" className="w-full max-w-lg group">
              <div className="glass-panel p-12 text-center bg-white/70 shadow-2xl">
                {/* Animated Lock Icon */}
                <motion.div
                  animate={{ rotateY: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-24 h-24 mx-auto mb-8 rounded-3xl bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] flex items-center justify-center shadow-2xl shadow-[#6c5ce7]/30"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <Lock className="w-12 h-12 text-white" />
                </motion.div>

                <h1 className="text-4xl font-extrabold text-[#1a1a2e] mb-2">Secure Vault</h1>
                <p className="text-[#64748b] mb-8 text-sm max-w-xs mx-auto">
                  Your data is deeply encrypted with multi-layer isolation. Enter your 4-digit PIN to access.
                </p>

                {/* Security visual indicator */}
                <div className="flex justify-center gap-1 mb-8 flex-wrap">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.2, 0.6, 0.2] }}
                      transition={{ duration: 2, delay: i * 0.1, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-[#6c5ce7]"
                    />
                  ))}
                </div>

                <input
                  type="password" maxLength={4} value={pin}
                  onChange={e => { setPin(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleUnlock()}
                  autoFocus placeholder="• • • •"
                  className="neumorphic-input p-4 w-44 text-center text-4xl tracking-[0.8em] rounded-2xl outline-none font-bold text-[#1a1a2e] mb-2 bg-transparent block mx-auto"
                />
                <p className="text-red-500 font-bold text-sm h-5 mb-4">{error}</p>

                <motion.button
                  whileHover={{ scale: 1.04, boxShadow: "0 0 30px rgba(108,92,231,0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleUnlock}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white font-extrabold text-lg shadow-xl"
                >
                  Authenticate Account
                </motion.button>
              </div>
            </Tilt3DCard>
          </motion.div>

        ) : (
          /* ─── UNLOCKED STATE ─── */
          <motion.div
            key="unlocked"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 w-full h-full overflow-y-auto p-6"
          >
            <div className="max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}
                    className="p-3 rounded-2xl bg-gradient-to-br from-[#2ed573] to-[#1e90ff] shadow-lg"
                  >
                    <ShieldCheck className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <h1 className="text-3xl font-extrabold text-[#1a1a2e]">Vault Unlocked</h1>
                    <p className="text-[#2ed573] font-bold text-xs tracking-widest uppercase">Deep Access Granted</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={handleLock}
                  className="p-3 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors border border-red-200"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Layer selector */}
              <div className="glass-panel p-4 mb-6 bg-white/60">
                <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8] mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Isolation Partition
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Primary", "Secondary", "Deep"].map(layer => (
                    <motion.button
                      key={layer} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setActiveLayer(layer)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeLayer === layer
                        ? "bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white shadow-md"
                        : "bg-white text-[#64748b] border border-[#e2e8f0]"}`}
                    >
                      {layer}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Write */}
                <Tilt3DCard depth={8} glowColor="#6c5ce7">
                  <div className="glass-panel p-7 bg-white/60 h-full">
                    <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2 text-[#1a1a2e]">
                      <FileKey2 className="w-5 h-5 text-[#6c5ce7]" /> Encode Payload
                    </h3>
                    <textarea
                      className="neumorphic-input w-full h-32 p-4 rounded-2xl outline-none resize-none text-[#1a1a2e] text-sm bg-transparent placeholder:text-[#94a3b8]"
                      placeholder="Paste sensitive keys, tokens, or notes..."
                      value={newSecret} onChange={e => setNewSecret(e.target.value)}
                    />
                    <motion.button
                      whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(108,92,231,0.3)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStore} disabled={isStoring}
                      className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white font-bold shadow-lg disabled:opacity-50"
                    >
                      {isStoring ? "Encrypting & Storing..." : `🔐 Encrypt & Store Securely`}
                    </motion.button>
                  </div>
                </Tilt3DCard>

                {/* Read */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-extrabold text-[#1a1a2e] flex items-center gap-2">
                    <Eye className="w-5 h-5 text-[#2ed573]" /> Decrypted Assets ({secrets.length})
                  </h3>
                  <div className="flex flex-col gap-3 max-h-72 overflow-y-auto pr-1">
                    {secrets.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-[#94a3b8] text-sm font-semibold">
                        Vault partition empty.
                      </div>
                    ) : (
                      secrets.map((s, idx) => (
                        <motion.div
                          key={s.id}
                          initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.08 }}
                          className="glass-panel p-4 bg-white border border-[#e2e8f0] rounded-2xl shadow-sm"
                        >
                          <p className="text-sm text-[#1a1a2e] break-words">{s.payload}</p>
                          <p className="text-[10px] text-[#94a3b8] mt-2 uppercase tracking-wider">
                            {new Date(s.timestamp).toLocaleTimeString()}
                          </p>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
