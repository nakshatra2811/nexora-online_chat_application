"use client";

import { useState } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Shield, Zap, EyeOff, Lock, MessageSquare, Video, ArrowRight, X, CheckCircle, UserPlus, LogIn, ChevronDown, ChevronRight } from "lucide-react";
import { APP_LOGO } from "@/lib/config";
import { FloatingOrbs } from "@/components/FloatingOrbs";
import { Scene3D } from "@/components/Scene3D";
import { Tilt3DCard } from "@/components/Tilt3DCard";

const FEATURES = [
  { icon: Lock, title: "Secure Protocol", desc: "Every byte is protected before it leaves your account. Zero knowledge on the server.", color: "from-[#6c5ce7] to-[#a29bfe]", glow: "#6c5ce7" },
  { icon: Shield, title: "Zero-Trust System", desc: "Our servers are blind relays — we cannot read, store, or sell your communications.", color: "from-[#ff006e] to-[#ffbe0b]", glow: "#ff006e" },
  { icon: EyeOff, title: "Private Vault", desc: "Advanced local-first storage for ultra-sensitive data. Requires PIN authentication to access.", color: "from-[#00d4ff] to-[#2ed573]", glow: "#00d4ff", comingSoon: true },
  { icon: Zap, title: "Real-Time Speed", desc: "Sub-50ms secure WebSocket tunnels. Fast without compromising on privacy.", color: "from-[#2ed573] to-[#1e90ff]", glow: "#2ed573" },
  { icon: MessageSquare, title: "Ephemeral Snaps", desc: "24-hour self-destructing media payloads. Built for ephemeral private communication.", color: "from-[#a29bfe] to-[#fd79a8]", glow: "#a29bfe" },
  { icon: Video, title: "Private Streams", desc: "Synchronized secure video streaming over a private peer-to-peer channel.", color: "from-[#ffbe0b] to-[#ff006e]", glow: "#ffbe0b" },
];

const fadeUp: any = {
  hidden: { opacity: 0, y: 60 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] } }),
};

export default function LandingPage() {
  const router = useRouter();
  const [showWhitepaper, setShowWhitepaper] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 800], [0, 200]);
  const heroOpacity = useTransform(scrollY, [0, 350], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 350], [1, 0.95]);

  return (
    <>
      <div className="min-h-screen w-full overflow-x-hidden bg-[#f0f2f5] text-[#1a1a2e]">

        {/* Global ambient orbs */}
        <FloatingOrbs opacity={0.1} />

        {/* Floating 3D geometry (pinned) */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Scene3D />
        </div>

        {/* === NAV — Stitch Glassmorphic === */}
        <motion.nav
          initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-0 w-full z-50 px-5 md:px-12 py-3 sm:py-4 flex justify-between items-center"
          style={{
            background: "var(--bg-surface)",
            backdropFilter: "blur(40px) saturate(1.8)",
            WebkitBackdropFilter: "blur(40px) saturate(1.8)",
            borderBottom: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-glass)",
          }}
        >
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => router.push("/")}>
            <img src={APP_LOGO} alt="Nexora Logo" className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 object-contain drop-shadow-lg rounded-[10px]" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tighter select-none" style={{ color: "var(--text-primary)" }}>Nexora</h1>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            <span className="cursor-pointer hover:text-[#00d4ff] transition-colors" onClick={() => router.push("/blog")}>Blog</span>

            {/* Download Dropdown */}
            <div
              className="relative group"
              onMouseEnter={() => setShowDownloadMenu(true)}
              onMouseLeave={() => setShowDownloadMenu(false)}
            >
              <div className="flex items-center gap-1 cursor-pointer hover:text-[#6c5ce7] transition-colors py-2">
                Download <ChevronDown className="w-4 h-4" />
              </div>

              <AnimatePresence>
                {showDownloadMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a2e] text-white rounded-xl shadow-2xl border border-white/10 overflow-hidden py-2"
                  >
                    <div className="px-5 py-3 hover:bg-white/10 cursor-pointer text-sm font-bold transition-colors" onClick={() => window.dispatchEvent(new CustomEvent("nexora-toast", { detail: { message: "Android App Coming Soon", type: "info" } }))}>Android (APK)</div>
                    <div className="px-5 py-3 hover:bg-white/10 cursor-pointer text-sm font-bold transition-colors" onClick={() => window.dispatchEvent(new CustomEvent("nexora-toast", { detail: { message: "Windows App Coming Soon", type: "info" } }))}>Windows (EXE)</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/auth")}
              className="px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-bold transition-all"
              style={{ color: "var(--text-secondary)", background: "rgba(255,255,255,0.05)" }}
            >
              Log In
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(108,92,231,0.5)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/auth?mode=signup")}
              className="px-5 sm:px-8 py-2 sm:py-3 rounded-full text-xs sm:text-sm font-bold bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white shadow-xl neon-glow active:opacity-90 cursor-pointer"
            >
              Join Nexora
            </motion.button>
          </div>
        </motion.nav>

        {/* === HERO === */}
        <section className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] px-6 text-center pt-6 sm:pt-24">
          <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="max-w-5xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-1 sm:mb-2 inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full glass-panel text-[10px] sm:text-xs md:text-sm font-bold text-[#6c5ce7] border border-[#6c5ce7]/20 shadow-md backdrop-blur-md max-w-full"
            >
              <Shield className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight">Military-Grade Privacy Protocol • Zero Knowledge</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl sm:text-6xl md:text-8xl font-extrabold leading-[1.05] tracking-tighter text-[#1a1a2e] mb-1.5 sm:mb-3"
            >
              The Ultimate<br />
              <span className="gradient-text">Private Protocol</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.5 }}
              className="text-base sm:text-lg md:text-xl text-[#64748b] max-w-2xl mx-auto mb-5 sm:mb-8 leading-relaxed"
            >
              Secure real-time communication. Premium glassmorphic design. Private vault storage. Built for the next generation of private accounts.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <motion.button
                whileHover={{ scale: 1.06, boxShadow: "0 0 40px rgba(108,92,231,0.5)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/auth")}
                className="px-10 py-4 rounded-full font-extrabold text-lg bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white shadow-xl flex items-center justify-center gap-3"
              >
                Launch Nexora <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowWhitepaper(true)}
                className="px-10 py-4 rounded-full font-bold text-lg glass-panel text-[#1a1a2e] border border-white/60 cursor-pointer"
              >
                Read Whitepaper
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2.2 }}
            style={{ opacity: heroOpacity }}
            className="absolute bottom-10 text-[#94a3b8] text-sm font-semibold flex flex-col items-center gap-2"
          >
            <span>Scroll to explore</span>
            <div className="w-px h-8 bg-gradient-to-b from-[#94a3b8] to-transparent" />
          </motion.div>
        </section>

        <section className="relative z-10 py-20 sm:py-32 px-5 md:px-12 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="text-center mb-12 sm:mb-20"
          >
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#1a1a2e] mb-4">
              Built Different.
            </h2>
            <p className="text-[#64748b] text-base sm:text-lg max-w-xl mx-auto">
              Every feature is designed around a single principle: your data belongs to you.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <Tilt3DCard key={i} glowColor={feature.glow} depth={12} className="group">
                <motion.div
                  custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                  className="h-full glass-panel p-6 sm:p-8 bg-white/60 shadow-lg rounded-3xl border border-white/50 hover:shadow-xl transition-all overflow-hidden relative"
                >
                  {/* BG gradient blob */}
                  <div className={`absolute -top-10 -right-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br ${feature.color} opacity-10 blur-2xl group-hover:opacity-25 transition-opacity duration-500`} />

                  <div className={`inline-flex p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br ${feature.color} shadow-lg mb-5 sm:mb-6`}>
                    <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg sm:text-xl font-extrabold text-[#1a1a2e]">{feature.title}</h3>
                    {feature.comingSoon && (
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-[#6c5ce7]/10 text-[#6c5ce7] border border-[#6c5ce7]/20">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-[#64748b] text-xs sm:text-sm leading-relaxed">{feature.desc}</p>

                  <motion.div
                    className={`mt-6 h-1 w-0 rounded-full bg-gradient-to-r ${feature.color} group-hover:w-full transition-all duration-500`}
                  />
                </motion.div>
              </Tilt3DCard>
            ))}
          </div>
        </section>

        {/* === CTA SECTION === */}
        <section className="relative z-10 py-32 px-4">
          <Tilt3DCard className="max-w-4xl mx-auto group" depth={8}>
            <div className="glass-panel p-16 text-center bg-gradient-to-br from-[#1a1a2e] to-[#2d3436] text-white rounded-3xl relative overflow-hidden shadow-2xl">
              <FloatingOrbs opacity={0.15} orbs={[
                { size: 300, x: "-10%", y: "-10%", color: "#6c5ce7", duration: 10, delay: 0, blur: 80 },
                { size: 250, x: "70%", y: "50%", color: "#00d4ff", duration: 13, delay: 2, blur: 90 },
              ]} />
              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">Ready to enter the void?</h2>
                <p className="text-[#94a3b8] text-lg mb-10 max-w-lg mx-auto">Join thousands of privacy-first accounts communicating without compromise.</p>
                <motion.button
                  whileHover={{ scale: 1.06, boxShadow: "0 0 50px rgba(108,92,231,0.6)" }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => router.push("/auth")}
                  className="px-12 py-4 rounded-full font-extrabold text-xl bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white shadow-2xl flex items-center gap-3 mx-auto"
                >
                  Start Free Now <ArrowRight className="w-6 h-6" />
                </motion.button>
              </div>
            </div>
          </Tilt3DCard>
        </section>

        {/* Footer */}
        <footer className="relative z-10 py-12 px-6 flex flex-col md:flex-row justify-between items-center gap-6 text-[#94a3b8] text-sm font-semibold border-t border-white/30"
          style={{ background: "rgba(255,255,255,0.3)", backdropFilter: "blur(10px)" }}>
          <div className="flex items-center gap-3">
            <img src={APP_LOGO} alt="Nexora Logo" className="w-6 h-6 opacity-60" />
            <p>&copy; 2026 Nexora Systems. Secure &bull; Privacy by Design.</p>
          </div>
          <div className="flex items-center gap-6">
            <motion.a whileHover={{ color: "#6c5ce7", scale: 1.05 }} onClick={() => router.push("/policies")} className="hover:underline transition-all cursor-pointer">Privacy Policy</motion.a>
            <motion.a whileHover={{ color: "#6c5ce7", scale: 1.05 }} onClick={() => router.push("/policies")} className="hover:underline transition-all cursor-pointer">Terms of Service</motion.a>
            <motion.a whileHover={{ color: "#00d4ff", scale: 1.05 }} onClick={() => router.push("/policies")} className="hover:underline transition-all cursor-pointer">Disclaimer</motion.a>
          </div>
        </footer>

      </div>

      {/* === WHITEPAPER MODAL === */}
      <AnimatePresence mode="wait">
        {showWhitepaper && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowWhitepaper(false)}
              className="absolute inset-0 bg-[#0c0c14]/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-panel bg-white/95 shadow-2xl rounded-[32px] border border-white/50 custom-scrollbar"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowWhitepaper(false)}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 transition-colors z-20 cursor-pointer"
              >
                <X className="w-6 h-6 text-[#1a1a2e]" />
              </button>

              <div className="p-8 sm:p-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] shadow-lg">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-[#1a1a2e]">Nexora Protocol</h2>
                    <p className="text-[#6c5ce7] font-bold text-sm uppercase tracking-widest">v1.2 // Technical Whitepaper</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-left">
                  {/* Left: Features */}
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-[#ffbe0b]" /> Core Features
                      </h3>
                      <div className="space-y-4">
                        {[
                          { t: "Real-Time Communication", d: "Ultra-low latency WebSocket tunnels for instant messaging and state synchronization." },
                          { t: "Private Vault Storage", d: "Local-first secure storage for media and sensitive documents with biometric/PIN locks." },
                          { t: "Synchronized Streams", d: "Peer-to-peer WebRTC video and audio streaming with bit-perfect synchronization." },
                          { t: "Ephemeral Payloads", d: "Self-destructing message structures that erase traces from all accounts after consumption." },
                        ].map((f, i) => (
                          <div key={i} className="flex gap-3">
                            <CheckCircle className="w-5 h-5 text-[#2ed573] shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold text-sm text-[#1a1a2e]">{f.t}</p>
                              <p className="text-xs text-[#64748b] leading-relaxed">{f.d}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-[#6c5ce7]/5 border border-[#6c5ce7]/10 text-sm">
                      <p className="font-bold text-[#6c5ce7] mb-2 uppercase tracking-tighter">Authorized Account Extension</p>
                      "Exclusive role for protocol observers and high-clearance administrators. Requires manual verification and administrative clearance."
                    </div>
                  </div>

                  {/* Right: User Guide */}
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-xl font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-[#6c5ce7]" /> New Account Onboarding
                      </h3>
                      <div className="bg-[#f8fafc] p-6 rounded-3xl border border-[#e2e8f0] space-y-6">
                        <div className="relative">
                          <div className="absolute left-3 top-0 bottom-0 w-px bg-[#cbd5e1]" />
                          <div className="space-y-6 relative">
                            <div className="flex gap-4">
                              <div className="w-6 h-6 rounded-full bg-[#6c5ce7] text-white text-[10px] font-bold flex items-center justify-center shrink-0 z-10">1</div>
                              <p className="text-xs font-semibold text-[#1a1a2e]">
                                Click <span className="text-[#6c5ce7]">"Join Voice"</span> on the home page.
                              </p>
                            </div>
                            <div className="flex gap-4">
                              <div className="w-6 h-6 rounded-full bg-[#6c5ce7] text-white text-[10px] font-bold flex items-center justify-center shrink-0 z-10">2</div>
                              <p className="text-xs font-semibold text-[#1a1a2e]">
                                Switch the toggle to <span className="text-[#6c5ce7]">"Sign Up"</span> mode.
                              </p>
                            </div>
                            <div className="flex gap-4">
                              <div className="w-6 h-6 rounded-full bg-[#6c5ce7] text-white text-[10px] font-bold flex items-center justify-center shrink-0 z-10">3</div>
                              <p className="text-xs font-semibold text-[#1a1a2e]">
                                Enter your <span className="text-[#00d4ff]">Protocol Identity</span> (Username) and secure password.
                              </p>
                            </div>
                            <div className="flex gap-4">
                              <div className="w-6 h-6 rounded-full bg-[#6c5ce7] text-white text-[10px] font-bold flex items-center justify-center shrink-0 z-10">4</div>
                              <p className="text-xs font-semibold text-[#1a1a2e]">
                                Optional: Request <span className="text-[#ff006e]">"Clearance Status"</span> for advanced authorized account access.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-[#1a1a2e] mb-4 flex items-center gap-2">
                        <LogIn className="w-5 h-5 text-[#00d4ff]" /> Accessing Your Account
                      </h3>
                      <p className="text-sm text-[#64748b] leading-relaxed px-1">
                        Simply toggle to <span className="font-bold text-[#1a1a2e]">Log In</span>, provide your credentials, and you will be automatically linked to your private dashboard.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-[#e2e8f0] text-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    onClick={() => { setShowWhitepaper(false); router.push("/auth?mode=signup"); }}
                    className="px-8 py-3 rounded-full bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white font-bold text-sm shadow-xl cursor-pointer"
                  >
                    Initialize Connection Now
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
