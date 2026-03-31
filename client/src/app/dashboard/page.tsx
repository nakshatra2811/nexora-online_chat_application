"use client";

import { useRouter } from "next/navigation";
import { Mail, ShieldCheck, HelpCircle } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();

  const handleLogout = () => {
    router.push("/");
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto z-10 relative">
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[500px]">
        <div className="glass-panel p-12 text-center max-w-2xl w-full relative shadow-2xl">
          {/* Soft decorative spheres */}
          <div className="absolute -left-10 -top-20 h-64 w-64 rounded-full bg-[#6c5ce7] opacity-10 blur-3xl mix-blend-multiply flex-shrink-0 z-0"></div>
          <div className="absolute left-20 top-10 h-72 w-72 rounded-full bg-[#00d4ff] opacity-10 blur-3xl mix-blend-multiply flex-shrink-0 z-0"></div>

          <div className="relative z-10">
            <h1 className="text-4xl font-extrabold gradient-text tracking-tighter mb-4">Nexora Dashboard</h1>
            <p className="text-[#64748b] leading-relaxed mb-8 font-medium">
              Welcome to the void. This represents the main unified communication hub. 
              The full Chat, Stories, Calls, and Vault UI will be implemented here.
            </p>

            <button
              onClick={handleLogout}
              className="rounded-2xl bg-white/50 backdrop-blur-md px-8 py-3 text-sm font-extrabold text-[#6c5ce7] shadow-[0_0_15px_rgba(108,92,231,0.15)] border border-[#6c5ce7]/10 transition-all hover:scale-105 active:scale-95"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* FULL DASHBOARD FOOTER */}
      <footer className="w-full pt-16 pb-12 mt-auto border-t backdrop-blur-xl relative z-10"
              style={{ borderColor: "rgba(108,92,231,0.15)", background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 items-start text-left mb-12">
          {/* Logo and About */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.svg" alt="Nexora" className="w-8 h-8 drop-shadow-lg" />
              <span className="font-extrabold text-2xl tracking-tighter text-[#1a1a2e] dark:text-white">Nexora.</span>
            </div>
            <p className="text-sm font-medium leading-relaxed max-w-md text-[#64748b]">
              Nexora respects your privacy above all else. We provide the tools, but your conversations remain strictly yours. Use the platform responsibly and help us keep the void secure.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-[#6c5ce7]">Quick Links</h4>
            <ul className="space-y-2 text-sm font-bold text-[#475569] dark:text-[#94a3b8]">
              <li onClick={() => router.push("/dashboard/chats")} className="cursor-pointer hover:text-[#00d4ff] transition-colors">Chat Interface</li>
              <li onClick={() => router.push("/dashboard/stories")} className="cursor-pointer hover:text-[#00d4ff] transition-colors">Stories</li>
              <li onClick={() => router.push("/dashboard/vault")} className="cursor-pointer hover:text-[#00d4ff] transition-colors">Secure Vault</li>
              <li onClick={() => router.push("/policies")} className="cursor-pointer hover:text-[#00d4ff] transition-colors">Legal & Privacy</li>
            </ul>
          </div>

          {/* Disclaimer & Transparency */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-[#6c5ce7]">Disclaimer</h4>
            <ul className="space-y-2 text-sm font-bold text-[#475569] dark:text-[#94a3b8]">
              <li onClick={() => router.push("/policies")} className="cursor-pointer hover:text-[#00d4ff] transition-colors flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Data Transparency
              </li>
              <li onClick={() => router.push("/policies")} className="cursor-pointer hover:text-[#00d4ff] transition-colors flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Usage Disclaimer
              </li>
              <li className="cursor-pointer hover:text-[#00d4ff] transition-colors flex items-center gap-2">
                <HelpCircle className="w-4 h-4" /> Support Void
              </li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto px-6 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4" style={{ borderColor: "rgba(108,92,231,0.08)" }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#94a3b8]">
            &copy; 2026 Nexora Systems. Deeply Encrypted &bull; Privacy by Design.
          </p>
          <div className="flex items-center gap-6">
             <span onClick={() => router.push("/policies")} className="text-[11px] font-bold cursor-pointer hover:text-[#6c5ce7] transition-colors text-[#64748b]">Privacy Policy</span>
             <span onClick={() => router.push("/policies")} className="text-[11px] font-bold cursor-pointer hover:text-[#6c5ce7] transition-colors text-[#64748b]">Terms of Service</span>
             <span onClick={() => router.push("/policies")} className="text-[11px] font-bold cursor-pointer hover:text-[#6c5ce7] transition-colors text-[#64748b]">Disclaimer</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
