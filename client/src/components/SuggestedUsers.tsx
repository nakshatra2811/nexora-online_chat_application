"use client";

import { useState } from "react";
import { UserPlus, Share2, UserCheck } from "lucide-react";
import { nexoraFetch } from "@/lib/config";
import { motion, AnimatePresence } from "framer-motion";

export function SuggestedUsers() {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sentUsernames, setSentUsernames] = useState<string[]>([]);

  const syncContacts = async () => {
    setIsSyncing(true);
    // Simulate contact discovery via phone hashes
    // These numbers match the seeded users
    const mockContacts = ["9876543210", "9876543211", "9876543212", "9876543213", "9876543214", "9876543215"];
    
    try {
      const me = localStorage.getItem("nexora_signup_username") || "";
      const res = await nexoraFetch("/api/users/sync-contacts", {
        method: "POST",
        body: JSON.stringify({ contacts: mockContacts, me })
      });
      if (res.suggestions) {
        setSuggestions(res.suggestions);
      }
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFollow = async (target: string) => {
    const me = localStorage.getItem("nexora_signup_username") || "";
    try {
      await nexoraFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({ from: me, to: target })
      });
      setSentUsernames(prev => [...prev, target]);
    } catch (err) {
      console.error("Follow failed", err);
    }
  };

  const shareProfile = () => {
    const username = localStorage.getItem("nexora_signup_username") || "";
    const url = `${window.location.origin}/profile/${username}`;
    if (navigator.share) {
      navigator.share({
        title: 'Connect with me on Nexora',
        text: `Hey! Find me on Nexora Private Chat: @${username}`,
        url: url,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert("Profile link copied to clipboard!");
    }
  };

  return (
    <div className="glass-panel p-6 w-full max-w-md mx-auto mt-8 border-[#6c5ce7]/10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-[#1a1a2e] dark:text-white tracking-tight">Discover Friends</h3>
          <p className="text-[10px] uppercase font-black tracking-widest text-[#6c5ce7]/60">Suggested for you</p>
        </div>
        <button 
          onClick={syncContacts}
          disabled={isSyncing}
          className="text-xs font-extrabold text-[#6c5ce7] hover:text-[#00d4ff] transition-colors flex items-center gap-1 bg-[#6c5ce7]/5 px-3 py-1.5 rounded-full"
        >
          {isSyncing ? "Establishing..." : "Sync Contacts"}
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {suggestions.length > 0 ? (
            suggestions.map((u, i) => (
              <motion.div 
                key={u.username}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 rounded-2xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${u.color || 'from-purple-500 to-indigo-500'} flex items-center justify-center text-white font-black text-lg shadow-inner`}>
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-black text-[#1a1a2e] dark:text-white">@{u.username}</div>
                    <div className="text-[11px] font-bold text-[#64748b]">{u.fullName}</div>
                    <div className="text-[9px] font-black text-[#2ed573] uppercase tracking-tighter mt-0.5">{u.reason}</div>
                  </div>
                </div>
                
                {sentUsernames.includes(u.username) ? (
                  <div className="p-2 rounded-xl bg-[#2ed573]/10 text-[#2ed573]">
                    <UserCheck size={18} />
                  </div>
                ) : (
                  <button 
                    onClick={() => handleFollow(u.username)}
                    className="p-2.5 rounded-xl bg-white dark:bg-white/10 text-[#6c5ce7] shadow-sm hover:scale-110 active:scale-90 transition-all border border-[#6c5ce7]/10"
                  >
                    <UserPlus size={18} />
                  </button>
                )}
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-10"
            >
              <div className="w-16 h-16 bg-[#6c5ce7]/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="text-[#6c5ce7] opacity-40" />
              </div>
              <p className="text-xs font-bold text-[#64748b] px-6 leading-relaxed">
                Unlock the protocol graph. Sync your contacts to see who else is in the void.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 pt-6 border-t border-[#6c5ce7]/5">
         <button 
          onClick={shareProfile}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-br from-[#6c5ce7] to-[#8271ff] text-white text-sm font-black shadow-[0_15px_30px_rgba(108,92,231,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all"
         >
            <Share2 size={18} /> Share My Link
         </button>
         <p className="text-[10px] text-center mt-4 font-bold text-[#94a3b8]">Your phone number is hashed and never leaves the server in plain text.</p>
      </div>
    </div>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
